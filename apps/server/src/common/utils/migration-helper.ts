/**
 * Migration Helper Utilities
 *
 * Provides pre-migration health checks, distributed migration locking via ValKey,
 * and rollback tracking for safe zero-downtime database migrations.
 *
 * These utilities are designed to be used by the `migrate-safe.ts` runner script,
 * NOT within Prisma migration SQL files themselves.
 */

import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const logger = new Logger('MigrationHelper');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  healthy: boolean;
  database: { connected: boolean; latencyMs: number };
  valkey: { connected: boolean; latencyMs: number };
  errors: string[];
}

export interface MigrationLock {
  acquired: boolean;
  lockId: string;
  holder: string;
  acquiredAt: string;
}

export interface MigrationSnapshot {
  timestamp: string;
  appliedMigrations: string[];
  schemaVersion: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIGRATION_LOCK_KEY = 'notesaner:migration:lock';
const MIGRATION_LOCK_TTL_SECONDS = 600; // 10 minutes — generous for long migrations
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// ─── Health Check ────────────────────────────────────────────────────────────

/**
 * Performs a pre-migration health check against PostgreSQL and ValKey.
 *
 * The migration runner should REFUSE to proceed if this check fails.
 * A healthy database means:
 *   - PostgreSQL responds to a simple query within the timeout
 *   - ValKey responds to PING within the timeout
 *
 * @returns Health check result with per-service status and latency
 */
export async function checkPreMigrationHealth(
  prisma: PrismaClient,
  valkeyUrl: string,
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: true,
    database: { connected: false, latencyMs: 0 },
    valkey: { connected: false, latencyMs: 0 },
    errors: [],
  };

  // ── Database check ─────────────────────────────────────────────────────
  try {
    const dbStart = Date.now();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Database health check timed out')),
        HEALTH_CHECK_TIMEOUT_MS,
      ),
    );
    await Promise.race([prisma.$queryRaw`SELECT 1 as health_check`, timeoutPromise]);
    result.database.latencyMs = Date.now() - dbStart;
    result.database.connected = true;
    logger.log(`Database health check passed (${result.database.latencyMs}ms)`);
  } catch (error) {
    result.healthy = false;
    result.database.connected = false;
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Database: ${message}`);
    logger.error(`Database health check failed: ${message}`);
  }

  // ── ValKey check ───────────────────────────────────────────────────────
  let redis: Redis | null = null;
  try {
    const vkStart = Date.now();
    redis = new Redis(valkeyUrl, {
      connectTimeout: HEALTH_CHECK_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
    const pong = await redis.ping();
    result.valkey.latencyMs = Date.now() - vkStart;
    result.valkey.connected = pong === 'PONG';
    if (!result.valkey.connected) {
      throw new Error(`ValKey responded with "${pong}" instead of PONG`);
    }
    logger.log(`ValKey health check passed (${result.valkey.latencyMs}ms)`);
  } catch (error) {
    result.healthy = false;
    result.valkey.connected = false;
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`ValKey: ${message}`);
    logger.error(`ValKey health check failed: ${message}`);
  } finally {
    if (redis) {
      try {
        redis.disconnect();
      } catch {
        // Ignore disconnect errors during health check
      }
    }
  }

  return result;
}

// ─── Distributed Migration Lock ──────────────────────────────────────────────

/**
 * Acquires a distributed migration lock via ValKey.
 *
 * Uses SET NX EX (atomic set-if-not-exists with TTL) to ensure only one
 * migration process runs at a time across all application instances.
 *
 * The lock auto-expires after MIGRATION_LOCK_TTL_SECONDS to prevent
 * deadlocks if the migration runner crashes.
 *
 * @param valkeyUrl - ValKey connection URL
 * @param holder    - Identifier for the lock holder (e.g. hostname + PID)
 * @returns Lock acquisition result
 */
export async function acquireMigrationLock(
  valkeyUrl: string,
  holder?: string,
): Promise<MigrationLock> {
  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const lockHolder = holder ?? `${getHostname()}:${process.pid}`;
  const lockValue = JSON.stringify({
    lockId,
    holder: lockHolder,
    acquiredAt: new Date().toISOString(),
  });

  const redis = new Redis(valkeyUrl, {
    connectTimeout: HEALTH_CHECK_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const result = await redis.set(
      MIGRATION_LOCK_KEY,
      lockValue,
      'EX',
      MIGRATION_LOCK_TTL_SECONDS,
      'NX',
    );

    if (result === 'OK') {
      logger.log(`Migration lock acquired by ${lockHolder} (id: ${lockId})`);
      return {
        acquired: true,
        lockId,
        holder: lockHolder,
        acquiredAt: new Date().toISOString(),
      };
    }

    // Lock already held — read current holder for diagnostics
    const existing = await redis.get(MIGRATION_LOCK_KEY);
    let existingHolder = 'unknown';
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as { holder?: string };
        existingHolder = parsed.holder ?? 'unknown';
      } catch {
        // Corrupt lock value
      }
    }

    logger.warn(`Migration lock already held by ${existingHolder}`);
    return {
      acquired: false,
      lockId: '',
      holder: existingHolder,
      acquiredAt: '',
    };
  } finally {
    redis.disconnect();
  }
}

/**
 * Releases the migration lock. Only the holder of the lock (identified by lockId)
 * can release it, preventing accidental release by a different process.
 *
 * Uses a Lua script for atomic compare-and-delete.
 */
export async function releaseMigrationLock(valkeyUrl: string, lockId: string): Promise<boolean> {
  const redis = new Redis(valkeyUrl, {
    connectTimeout: HEALTH_CHECK_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  // Lua: only delete the key if it contains our lockId
  const luaScript = `
    local val = redis.call("GET", KEYS[1])
    if val == false then
      return 0
    end
    local ok, parsed = pcall(cjson.decode, val)
    if not ok then
      return 0
    end
    if parsed.lockId == ARGV[1] then
      redis.call("DEL", KEYS[1])
      return 1
    end
    return 0
  `;

  try {
    await redis.connect();
    const result = await redis.eval(luaScript, 1, MIGRATION_LOCK_KEY, lockId);
    const released = result === 1;

    if (released) {
      logger.log(`Migration lock released (id: ${lockId})`);
    } else {
      logger.warn(`Failed to release migration lock (id: ${lockId}) — lock may have expired`);
    }

    return released;
  } finally {
    redis.disconnect();
  }
}

// ─── Migration Snapshot ──────────────────────────────────────────────────────

/**
 * Captures a snapshot of the current migration state.
 *
 * This is used before running migrations so we can identify what changed
 * and support manual rollback if needed.
 */
export async function captureMigrationSnapshot(prisma: PrismaClient): Promise<MigrationSnapshot> {
  try {
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at ASC`;

    const applied = migrations.filter((m) => m.finished_at !== null).map((m) => m.migration_name);

    // The schema version is the name of the latest applied migration
    const schemaVersion = applied.length > 0 ? applied[applied.length - 1] : null;

    return {
      timestamp: new Date().toISOString(),
      appliedMigrations: applied,
      schemaVersion,
    };
  } catch {
    // _prisma_migrations table may not exist on first run
    return {
      timestamp: new Date().toISOString(),
      appliedMigrations: [],
      schemaVersion: null,
    };
  }
}

/**
 * Lists pending migrations that have not been applied yet.
 *
 * Compares the filesystem migration directories against the _prisma_migrations
 * table to identify what will be applied on the next `prisma migrate deploy`.
 */
export async function listPendingMigrations(
  prisma: PrismaClient,
  migrationsDir: string,
): Promise<string[]> {
  const fs = await import('node:fs/promises');

  // Read filesystem migrations
  let fsMigrations: string[] = [];
  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    fsMigrations = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  // Read applied migrations from database
  const snapshot = await captureMigrationSnapshot(prisma);
  const appliedSet = new Set(snapshot.appliedMigrations);

  return fsMigrations.filter((name) => !appliedSet.has(name)).sort();
}

// ─── Destructive Operation Detection ─────────────────────────────────────────

/**
 * Scans a migration SQL file for potentially destructive operations.
 *
 * Returns an array of warnings. An empty array means the migration is safe.
 * This is used by CI to flag migrations that need manual review.
 */
export async function detectDestructiveOperations(sqlFilePath: string): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const warnings: string[] = [];

  let sql: string;
  try {
    sql = await fs.readFile(sqlFilePath, 'utf-8');
  } catch {
    return [`Could not read migration file: ${sqlFilePath}`];
  }

  const normalised = sql.toUpperCase();

  // Drop table
  if (/DROP\s+TABLE/.test(normalised)) {
    warnings.push('DROP TABLE detected — this will delete data permanently');
  }

  // Drop column
  if (/DROP\s+COLUMN/.test(normalised)) {
    warnings.push('DROP COLUMN detected — this may cause data loss');
  }

  // Truncate
  if (/TRUNCATE/.test(normalised)) {
    warnings.push('TRUNCATE detected — this will delete all rows');
  }

  // Rename table (breaks existing queries until app is redeployed)
  if (/ALTER\s+TABLE\s+.*\s+RENAME\s+TO/.test(normalised)) {
    warnings.push('RENAME TABLE detected — may break running application instances');
  }

  // Rename column
  if (/RENAME\s+COLUMN/.test(normalised)) {
    warnings.push('RENAME COLUMN detected — may break running application instances');
  }

  // NOT NULL without DEFAULT (on existing column)
  if (/SET\s+NOT\s+NULL/.test(normalised) && !/DEFAULT/.test(normalised)) {
    warnings.push('SET NOT NULL without DEFAULT — may fail if existing rows have NULLs');
  }

  // ALTER TYPE (column type change)
  if (/ALTER\s+.*\s+TYPE\s/.test(normalised)) {
    warnings.push('ALTER TYPE detected — column type change may require data migration');
  }

  // DROP INDEX (may affect query performance)
  if (/DROP\s+INDEX/.test(normalised)) {
    warnings.push('DROP INDEX detected — may degrade query performance');
  }

  return warnings;
}

// ─── Connection Health for Ongoing Monitoring ────────────────────────────────

/**
 * Checks the number of active database connections.
 *
 * Useful to verify connection count before and after migrations.
 * A spike in connections during migration may indicate connection leaks.
 */
export async function getActiveConnectionCount(prisma: PrismaClient): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
  `;
  return Number(result[0]?.count ?? 0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHostname(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:os').hostname();
  } catch {
    return 'unknown-host';
  }
}
