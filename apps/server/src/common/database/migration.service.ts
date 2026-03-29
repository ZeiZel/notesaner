import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MigrationRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface AppliedMigration {
  migrationName: string;
  finishedAt: Date | null;
  startedAt: Date | null;
  logs: string | null;
}

export interface MigrationStatus {
  /** Schema version: name of the last applied migration, or null if none applied. */
  schemaVersion: string | null;
  /** Total applied migrations count. */
  appliedCount: number;
  /** Pending migration names (applied on filesystem but not in DB). */
  pendingMigrations: string[];
  /** Whether there are any pending migrations. */
  hasPendingMigrations: boolean;
  /** Last time migration status was fetched. */
  checkedAt: string;
  /** Run status from the last bootstrap migration attempt. */
  lastRunStatus: MigrationRunStatus;
  /** Error message from the last failed run, if any. */
  lastRunError: string | null;
}

// ─── Prisma migrations table row shape ───────────────────────────────────────

interface PrismaMigrationRow {
  migration_name: string;
  finished_at: Date | null;
  started_at: Date | null;
  logs: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * MigrationService manages Prisma migration lifecycle within the application.
 *
 * Responsibilities:
 *  - On bootstrap, optionally run `prisma migrate deploy` when RUN_MIGRATIONS=true.
 *  - Track migration version and last run status in memory.
 *  - Expose getMigrationStatus() for health indicators and admin endpoints.
 *
 * Design decisions:
 *  - Uses execSync intentionally: migration must complete before app accepts traffic.
 *    This ensures zero-downtime deployments: the new pod applies migrations and only
 *    then becomes ready; old pods keep running with backward-compatible schema.
 *  - Fails fast (throws) if migration deploy fails, preventing a bad pod from
 *    becoming healthy and handling requests with an incorrect schema.
 *  - Schema path is resolved relative to the Prisma schema directory at runtime
 *    so the service works in both development and container environments.
 */
@Injectable()
export class MigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationService.name);

  private lastRunStatus: MigrationRunStatus = 'pending';
  private lastRunError: string | null = null;

  /**
   * Resolved path to the Prisma schema file.
   *
   * Resolution order:
   *  1. PRISMA_SCHEMA_PATH env var (absolute or relative to cwd)
   *  2. Default: <project-root>/apps/server/prisma/schema.prisma
   *
   * When running inside a Docker container the default path resolves
   * correctly because the app is mounted at /app.
   */
  private readonly schemaPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const envSchemaPath = process.env['PRISMA_SCHEMA_PATH'];
    this.schemaPath = envSchemaPath
      ? path.resolve(process.cwd(), envSchemaPath)
      : path.resolve(__dirname, '..', '..', '..', '..', 'prisma', 'schema.prisma');
  }

  // ─── OnApplicationBootstrap ──────────────────────────────────────────────

  /**
   * Called by NestJS after all modules have been initialised but before the
   * application starts accepting incoming connections.
   *
   * If RUN_MIGRATIONS=true, runs `prisma migrate deploy` synchronously so that
   * any pending migrations are applied before the first request is served.
   * Throws on failure to prevent a misconfigured pod from becoming ready.
   */
  async onApplicationBootstrap(): Promise<void> {
    const runMigrations =
      this.config.get<string>('RUN_MIGRATIONS') === 'true' ||
      process.env['RUN_MIGRATIONS'] === 'true';

    if (!runMigrations) {
      this.logger.log('RUN_MIGRATIONS is not set — skipping automatic migration deploy');
      this.lastRunStatus = 'skipped';
      return;
    }

    this.logger.log('RUN_MIGRATIONS=true — running prisma migrate deploy...');
    this.lastRunStatus = 'running';

    try {
      this.runMigrateDeploy();
      this.lastRunStatus = 'success';
      this.lastRunError = null;
      this.logger.log('Prisma migrate deploy completed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastRunStatus = 'failed';
      this.lastRunError = message;
      this.logger.error(`Prisma migrate deploy FAILED: ${message}`);
      // Re-throw to prevent the application from starting with a bad schema.
      throw error;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current migration state by querying the
   * _prisma_migrations table directly. Safe to call at any time.
   *
   * Pending migrations are detected by comparing the `_prisma_migrations`
   * table (applied) against `prisma migrate status` output (known migrations).
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    const checkedAt = new Date().toISOString();

    let appliedMigrations: AppliedMigration[] = [];
    try {
      appliedMigrations = await this.fetchAppliedMigrations();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not read _prisma_migrations table: ${message}`);
    }

    const schemaVersion =
      appliedMigrations.length > 0
        ? (appliedMigrations[appliedMigrations.length - 1]?.migrationName ?? null)
        : null;

    const pendingMigrations = this.getPendingMigrationsFromStatus();

    return {
      schemaVersion,
      appliedCount: appliedMigrations.length,
      pendingMigrations,
      hasPendingMigrations: pendingMigrations.length > 0,
      checkedAt,
      lastRunStatus: this.lastRunStatus,
      lastRunError: this.lastRunError,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Executes `prisma migrate deploy` synchronously.
   *
   * Captured stdout/stderr are logged; a non-zero exit code causes execSync to
   * throw an Error which is re-thrown by the caller.
   */
  private runMigrateDeploy(): void {
    const command = `npx prisma migrate deploy --schema="${this.schemaPath}"`;
    this.logger.debug(`Executing: ${command}`);

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: process.cwd(),
      });

      if (output.trim()) {
        this.logger.log(`prisma migrate deploy output:\n${output.trim()}`);
      }
    } catch (rawError) {
      // execSync throws an object with stdout/stderr when the process exits non-zero
      const execError = rawError as { stderr?: string; stdout?: string; message?: string };
      const details = [execError.stderr?.trim(), execError.stdout?.trim()]
        .filter(Boolean)
        .join('\n');
      const message = details || execError.message || 'prisma migrate deploy failed';
      throw new Error(message);
    }
  }

  /**
   * Queries the `_prisma_migrations` table and returns all applied migrations
   * in chronological order.
   *
   * Returns an empty array if the table does not yet exist (fresh database).
   */
  private async fetchAppliedMigrations(): Promise<AppliedMigration[]> {
    const rows = await this.prisma.$queryRaw<PrismaMigrationRow[]>`
      SELECT migration_name, finished_at, started_at, logs
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY started_at ASC
    `;

    return rows.map((row) => ({
      migrationName: row.migration_name,
      finishedAt: row.finished_at,
      startedAt: row.started_at,
      logs: row.logs,
    }));
  }

  /**
   * Runs `prisma migrate status` synchronously and parses its output to find
   * the list of pending (unapplied) migrations.
   *
   * Returns an empty array on any error (e.g. DB unreachable) to avoid
   * blocking health checks.
   *
   * Parsing strategy: lines matching "[ ]  migrationName" (unapplied) are
   * extracted. Prisma uses different markers:
   *   "Database migrations status" header
   *   "(•) some_migration" — applied
   *   "[ ] some_migration" — pending / not applied
   */
  private getPendingMigrationsFromStatus(): string[] {
    try {
      const output = execSync(`npx prisma migrate status --schema="${this.schemaPath}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: process.cwd(),
        // Do not throw on non-zero exit — pending migrations cause exit code 1
      });

      return this.parsePendingFromStatusOutput(output);
    } catch (rawError) {
      // execSync throws when exit code is non-zero. The output may still contain
      // status information — attempt to parse it.
      const execError = rawError as { stdout?: string; stderr?: string };
      const combined = [execError.stdout, execError.stderr].filter(Boolean).join('\n');

      if (combined) {
        try {
          return this.parsePendingFromStatusOutput(combined);
        } catch {
          // Fall through to empty array
        }
      }

      this.logger.debug('Could not determine pending migrations from prisma migrate status');
      return [];
    }
  }

  /**
   * Parses the text output of `prisma migrate status` to extract pending
   * migration names.
   *
   * Prisma status output format (approximate):
   *   "Following migrations have not yet been applied:"
   *   "  20260101000000_add_users"
   *   "  20260102000000_add_notes"
   *
   * Also handles the table-style format:
   *   "[ ] 20260101000000_add_users"
   */
  private parsePendingFromStatusOutput(output: string): string[] {
    const pending: string[] = [];
    const lines = output.split('\n');

    // Pattern 1: "[ ] migration_name" (unapplied checkbox)
    const checkboxPattern = /^\s*\[\s*\]\s+(\S+)/;

    // Pattern 2: Lines after "Following migrations have not yet been applied:"
    let inPendingSection = false;
    const pendingSectionMarker = /following migrations have not yet been applied/i;
    const migrationNamePattern = /^\s{2,}(\d{4,}_\S+)\s*$/;

    for (const line of lines) {
      if (checkboxPattern.test(line)) {
        const match = checkboxPattern.exec(line);
        if (match?.[1]) {
          pending.push(match[1]);
        }
        continue;
      }

      if (pendingSectionMarker.test(line)) {
        inPendingSection = true;
        continue;
      }

      if (inPendingSection) {
        const match = migrationNamePattern.exec(line);
        if (match?.[1]) {
          pending.push(match[1]);
        } else if (line.trim().length > 0 && !/^-+$/.test(line.trim())) {
          // Non-empty line that doesn't look like a migration name — end of section
          inPendingSection = false;
        }
      }
    }

    // Deduplicate while preserving order
    return [...new Set(pending)];
  }
}
