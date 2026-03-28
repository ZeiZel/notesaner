#!/usr/bin/env ts-node
/**
 * Safe Migration Runner
 *
 * A wrapper around `prisma migrate deploy` that adds:
 *   1. Pre-migration health check (DB + ValKey)
 *   2. Distributed lock via ValKey (prevents concurrent migration runs)
 *   3. Migration snapshot capture (for rollback reference)
 *   4. Destructive operation detection and confirmation
 *   5. Post-migration validation
 *
 * Usage:
 *   npx ts-node scripts/migrate-safe.ts                 # normal run
 *   npx ts-node scripts/migrate-safe.ts --dry-run       # preview only
 *   npx ts-node scripts/migrate-safe.ts --skip-lock     # skip ValKey lock
 *   npx ts-node scripts/migrate-safe.ts --force         # skip destructive op warnings
 *
 * Exit codes:
 *   0 — migrations applied successfully (or no pending migrations)
 *   1 — pre-flight check failed
 *   2 — lock acquisition failed
 *   3 — migration execution failed
 *   4 — post-migration validation failed
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  checkPreMigrationHealth,
  acquireMigrationLock,
  releaseMigrationLock,
  captureMigrationSnapshot,
  listPendingMigrations,
  detectDestructiveOperations,
  getActiveConnectionCount,
  type MigrationSnapshot,
} from '../src/common/utils/migration-helper';

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_LOCK = args.includes('--skip-lock');
const FORCE = args.includes('--force');

// ─── Configuration ───────────────────────────────────────────────────────────

const DATABASE_URL = process.env['DATABASE_URL'];
const VALKEY_URL =
  process.env['VALKEY_URL'] ??
  `redis://${process.env['REDIS_HOST'] ?? 'localhost'}:${process.env['REDIS_PORT'] ?? '6379'}/${process.env['REDIS_DB'] ?? '0'}`;

const PRISMA_SCHEMA_PATH = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');
const SNAPSHOTS_DIR = path.resolve(__dirname, '..', 'prisma', '.migration-snapshots');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function logError(message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
}

function saveSnapshot(snapshot: MigrationSnapshot, label: string): void {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
  const filename = `${label}-${snapshot.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(SNAPSHOTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  log(`Snapshot saved: ${filepath}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('=== Notesaner Safe Migration Runner ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  if (!DATABASE_URL) {
    logError('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let lockId = '';

  try {
    // ── Step 1: Pre-migration health check ─────────────────────────────
    log('');
    log('Step 1: Pre-migration health check...');
    const health = await checkPreMigrationHealth(prisma, VALKEY_URL);

    if (!health.healthy) {
      logError('Pre-migration health check FAILED:');
      for (const err of health.errors) {
        logError(`  - ${err}`);
      }
      process.exit(1);
    }

    log(`  Database: OK (${health.database.latencyMs}ms)`);
    log(`  ValKey:   OK (${health.valkey.latencyMs}ms)`);

    const connCount = await getActiveConnectionCount(prisma);
    log(`  Active DB connections: ${connCount}`);

    // ── Step 2: Check pending migrations ───────────────────────────────
    log('');
    log('Step 2: Checking pending migrations...');
    const pending = await listPendingMigrations(prisma, MIGRATIONS_DIR);

    if (pending.length === 0) {
      log('  No pending migrations. Nothing to do.');
      return;
    }

    log(`  ${pending.length} pending migration(s):`);
    for (const name of pending) {
      log(`    - ${name}`);
    }

    // ── Step 3: Destructive operation scan ──────────────────────────────
    log('');
    log('Step 3: Scanning for destructive operations...');
    let hasDestructive = false;

    for (const name of pending) {
      const sqlPath = path.join(MIGRATIONS_DIR, name, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const warnings = await detectDestructiveOperations(sqlPath);
      if (warnings.length > 0) {
        hasDestructive = true;
        log(`  [WARNING] ${name}:`);
        for (const w of warnings) {
          log(`    - ${w}`);
        }
      }
    }

    if (hasDestructive && !FORCE) {
      logError(
        'Destructive operations detected. Review the warnings above.\n' +
          '  Use --force to proceed anyway, or fix the migration.',
      );
      process.exit(1);
    }

    if (!hasDestructive) {
      log('  No destructive operations detected.');
    }

    // ── Step 4: Capture pre-migration snapshot ─────────────────────────
    log('');
    log('Step 4: Capturing pre-migration snapshot...');
    const preMigrationSnapshot = await captureMigrationSnapshot(prisma);
    saveSnapshot(preMigrationSnapshot, 'pre-migration');
    log(`  Current schema version: ${preMigrationSnapshot.schemaVersion ?? '(none)'}`);
    log(`  Applied migrations: ${preMigrationSnapshot.appliedMigrations.length}`);

    if (DRY_RUN) {
      log('');
      log('=== DRY RUN COMPLETE ===');
      log('No migrations were applied. Remove --dry-run to apply.');
      return;
    }

    // ── Step 5: Acquire distributed lock ───────────────────────────────
    if (!SKIP_LOCK) {
      log('');
      log('Step 5: Acquiring migration lock...');
      const lock = await acquireMigrationLock(VALKEY_URL);

      if (!lock.acquired) {
        logError(
          `Migration lock held by ${lock.holder}. Another migration may be running.\n` +
            '  Use --skip-lock to bypass (only if you are sure no other migration is running).',
        );
        process.exit(2);
      }

      lockId = lock.lockId;
      log(`  Lock acquired (id: ${lockId})`);
    } else {
      log('');
      log('Step 5: Skipping lock acquisition (--skip-lock)');
    }

    // ── Step 6: Run Prisma migrate deploy ──────────────────────────────
    log('');
    log('Step 6: Running prisma migrate deploy...');

    try {
      const output = execSync(`npx prisma migrate deploy --schema="${PRISMA_SCHEMA_PATH}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DATABASE_URL },
        cwd: path.resolve(__dirname, '..'),
      });
      log(output.trim());
    } catch (error) {
      const execError = error as { stderr?: string; stdout?: string; message?: string };
      logError('Migration execution failed:');
      if (execError.stderr) logError(execError.stderr);
      if (execError.stdout) log(execError.stdout);

      // Capture post-failure snapshot for diagnosis
      const failureSnapshot = await captureMigrationSnapshot(prisma);
      saveSnapshot(failureSnapshot, 'post-failure');

      process.exit(3);
    }

    // ── Step 7: Post-migration validation ──────────────────────────────
    log('');
    log('Step 7: Post-migration validation...');

    const postMigrationSnapshot = await captureMigrationSnapshot(prisma);
    saveSnapshot(postMigrationSnapshot, 'post-migration');

    const newMigrations = postMigrationSnapshot.appliedMigrations.filter(
      (m) => !preMigrationSnapshot.appliedMigrations.includes(m),
    );

    if (newMigrations.length === 0) {
      logError('No new migrations were applied. This may indicate an issue.');
      process.exit(4);
    }

    log(`  ${newMigrations.length} migration(s) applied:`);
    for (const name of newMigrations) {
      log(`    - ${name}`);
    }

    log(`  New schema version: ${postMigrationSnapshot.schemaVersion}`);

    // Verify DB health after migration
    const postHealth = await checkPreMigrationHealth(prisma, VALKEY_URL);
    if (!postHealth.healthy) {
      logError('Post-migration health check FAILED:');
      for (const err of postHealth.errors) {
        logError(`  - ${err}`);
      }
      process.exit(4);
    }

    const postConnCount = await getActiveConnectionCount(prisma);
    log(`  Post-migration active connections: ${postConnCount}`);

    log('');
    log('=== Migration completed successfully ===');
  } finally {
    // ── Release lock ───────────────────────────────────────────────────
    if (lockId && !SKIP_LOCK) {
      try {
        await releaseMigrationLock(VALKEY_URL, lockId);
        log('Migration lock released.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(`Failed to release migration lock: ${message}`);
      }
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
