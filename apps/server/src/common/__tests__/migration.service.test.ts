/**
 * Unit tests for MigrationService.
 *
 * Covers:
 * - onApplicationBootstrap(): skips migration when RUN_MIGRATIONS is not set
 * - onApplicationBootstrap(): skips migration when RUN_MIGRATIONS is "false"
 * - onApplicationBootstrap(): runs deploy when RUN_MIGRATIONS=true via env
 * - onApplicationBootstrap(): runs deploy when config provides RUN_MIGRATIONS=true
 * - onApplicationBootstrap(): records failed status and re-throws on deploy error
 * - onApplicationBootstrap(): uses stdout as error message when stderr is empty
 * - onApplicationBootstrap(): uses error.message as fallback when no stdout/stderr
 * - getMigrationStatus(): returns correct status with applied migrations
 * - getMigrationStatus(): returns null schemaVersion when no migrations applied
 * - getMigrationStatus(): handles _prisma_migrations table absence (fresh DB)
 * - getMigrationStatus(): detects pending migrations via checkbox format
 * - getMigrationStatus(): detects pending migrations via "following migrations" section
 * - getMigrationStatus(): returns empty pending list when migrate status fails with no output
 * - getMigrationStatus(): includes checkedAt timestamp in ISO format
 * - getMigrationStatus(): reflects lastRunStatus from a prior failed deploy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock child_process before import ────────────────────────────────────────

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { MigrationService, MigrationStatus } from '../database/migration.service';

const mockExecSync = vi.mocked(execSync);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockPrisma(rows: unknown[] = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
}

function createMockConfig(overrides: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string) => overrides[key]),
  };
}

/** Build a MigrationService with clean mocks. */
function buildService(
  prismaRows: unknown[] = [],
  configOverrides: Record<string, string | undefined> = {},
) {
  const prisma = createMockPrisma(prismaRows);
  const config = createMockConfig(configOverrides);
  const svc = new MigrationService(prisma as never, config as never);
  return { svc, prisma, config };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MigrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['RUN_MIGRATIONS'];
  });

  afterEach(() => {
    delete process.env['RUN_MIGRATIONS'];
  });

  // ── onApplicationBootstrap ───────────────────────────────────────────────

  describe('onApplicationBootstrap', () => {
    it('skips migration when RUN_MIGRATIONS is not set', async () => {
      const { svc } = buildService();

      await svc.onApplicationBootstrap();

      expect(mockExecSync).not.toHaveBeenCalled();

      // Status reflects skip
      mockExecSync.mockReturnValueOnce('' as never);
      const status = await svc.getMigrationStatus();
      expect(status.lastRunStatus).toBe('skipped');
    });

    it('skips migration when RUN_MIGRATIONS is "false"', async () => {
      process.env['RUN_MIGRATIONS'] = 'false';
      const { svc } = buildService();

      await svc.onApplicationBootstrap();

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('runs migrate deploy when RUN_MIGRATIONS=true via env', async () => {
      process.env['RUN_MIGRATIONS'] = 'true';
      const { svc } = buildService();
      // deploy call
      mockExecSync.mockReturnValueOnce('Applied 0 migration(s)' as never);

      await svc.onApplicationBootstrap();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('prisma migrate deploy'),
        expect.any(Object),
      );

      // status call for verification
      mockExecSync.mockReturnValueOnce('' as never);
      const status = await svc.getMigrationStatus();
      expect(status.lastRunStatus).toBe('success');
      expect(status.lastRunError).toBeNull();
    });

    it('runs migrate deploy when config provides RUN_MIGRATIONS=true', async () => {
      const { svc } = buildService([], { RUN_MIGRATIONS: 'true' });
      mockExecSync.mockReturnValueOnce('' as never);

      await svc.onApplicationBootstrap();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('prisma migrate deploy'),
        expect.any(Object),
      );
    });

    it('records failed status and re-throws on deploy error with stderr', async () => {
      process.env['RUN_MIGRATIONS'] = 'true';
      const { svc } = buildService();
      const deployError = Object.assign(new Error('execSync failed'), {
        stderr: 'ERROR: P1001 Can not reach database server',
        stdout: '',
      });
      mockExecSync.mockImplementationOnce(() => {
        throw deployError;
      });

      await expect(svc.onApplicationBootstrap()).rejects.toThrow(
        'ERROR: P1001 Can not reach database server',
      );

      // Now check status — need to mock the status call
      mockExecSync.mockReturnValueOnce('' as never);
      const status = await svc.getMigrationStatus();
      expect(status.lastRunStatus).toBe('failed');
      expect(status.lastRunError).toContain('P1001');
    });

    it('uses stdout as error message when stderr is empty', async () => {
      process.env['RUN_MIGRATIONS'] = 'true';
      const { svc } = buildService();
      const deployError = Object.assign(new Error('execSync failed'), {
        stderr: '',
        stdout: 'Migration failed to apply cleanly.',
      });
      mockExecSync.mockImplementationOnce(() => {
        throw deployError;
      });

      await expect(svc.onApplicationBootstrap()).rejects.toThrow(
        'Migration failed to apply cleanly.',
      );
    });

    it('uses error.message as fallback when no stdout/stderr', async () => {
      process.env['RUN_MIGRATIONS'] = 'true';
      const { svc } = buildService();
      const deployError = new Error('Unknown migration error');
      mockExecSync.mockImplementationOnce(() => {
        throw deployError;
      });

      await expect(svc.onApplicationBootstrap()).rejects.toThrow('Unknown migration error');
    });
  });

  // ── getMigrationStatus ───────────────────────────────────────────────────

  describe('getMigrationStatus', () => {
    it('returns correct status with applied migrations', async () => {
      const now = new Date();
      const { svc } = buildService([
        { migration_name: '20260101000000_init', finished_at: now, started_at: now, logs: null },
        {
          migration_name: '20260201000000_add_notes',
          finished_at: now,
          started_at: now,
          logs: null,
        },
      ]);
      // migrate status — no pending
      mockExecSync.mockReturnValueOnce('Database schema is up to date!' as never);

      const status: MigrationStatus = await svc.getMigrationStatus();

      expect(status.schemaVersion).toBe('20260201000000_add_notes');
      expect(status.appliedCount).toBe(2);
      expect(status.pendingMigrations).toEqual([]);
      expect(status.hasPendingMigrations).toBe(false);
      expect(status.lastRunStatus).toBe('pending');
      expect(status.checkedAt).toBeTruthy();
    });

    it('returns null schemaVersion when no migrations applied', async () => {
      const { svc } = buildService([]);
      mockExecSync.mockReturnValueOnce('' as never);

      const status = await svc.getMigrationStatus();

      expect(status.schemaVersion).toBeNull();
      expect(status.appliedCount).toBe(0);
      expect(status.hasPendingMigrations).toBe(false);
    });

    it('handles _prisma_migrations table absence gracefully (fresh DB)', async () => {
      const { svc, prisma } = buildService([]);
      prisma.$queryRaw.mockRejectedValue(new Error('relation "_prisma_migrations" does not exist'));
      mockExecSync.mockReturnValueOnce('' as never);

      const status = await svc.getMigrationStatus();

      expect(status.appliedCount).toBe(0);
      expect(status.schemaVersion).toBeNull();
    });

    it('detects pending migrations from checkbox format in status output', async () => {
      const { svc } = buildService([]);
      // execSync throws with exit code 1 when there are pending migrations
      const statusError = Object.assign(new Error('has not been applied'), {
        stdout: '[ ] 20260201000000_add_notes\n(•) 20260101000000_init\n',
        stderr: '',
      });
      mockExecSync.mockImplementationOnce(() => {
        throw statusError;
      });

      const status = await svc.getMigrationStatus();

      expect(status.pendingMigrations).toEqual(['20260201000000_add_notes']);
      expect(status.hasPendingMigrations).toBe(true);
    });

    it('detects pending migrations from "following migrations" section format', async () => {
      const { svc } = buildService([]);
      const statusOutput = [
        'The following migrations have not yet been applied:',
        '',
        '  20260301000000_add_activity',
        '  20260302000000_add_webhooks',
        '',
        'Run prisma migrate deploy to apply pending migrations.',
      ].join('\n');
      mockExecSync.mockImplementationOnce(() => {
        throw Object.assign(new Error('pending'), { stdout: statusOutput, stderr: '' });
      });

      const status = await svc.getMigrationStatus();

      expect(status.pendingMigrations).toContain('20260301000000_add_activity');
      expect(status.pendingMigrations).toContain('20260302000000_add_webhooks');
      expect(status.hasPendingMigrations).toBe(true);
    });

    it('returns empty pending list when migrate status fails with no output', async () => {
      const { svc } = buildService([]);
      mockExecSync.mockImplementationOnce(() => {
        throw Object.assign(new Error('ENOENT prisma not found'), { stdout: '', stderr: '' });
      });

      const status = await svc.getMigrationStatus();

      expect(status.pendingMigrations).toEqual([]);
    });

    it('includes checkedAt timestamp in ISO format', async () => {
      const { svc } = buildService([]);
      mockExecSync.mockReturnValueOnce('' as never);

      const before = new Date().toISOString();
      const status = await svc.getMigrationStatus();
      const after = new Date().toISOString();

      expect(status.checkedAt >= before).toBe(true);
      expect(status.checkedAt <= after).toBe(true);
    });

    it('reflects lastRunStatus from a prior failed deploy', async () => {
      process.env['RUN_MIGRATIONS'] = 'true';
      const { svc, prisma } = buildService([]);

      // Bootstrap: deploy fails
      mockExecSync.mockImplementationOnce(() => {
        throw Object.assign(new Error('exec failed'), { stderr: 'DB error', stdout: '' });
      });
      await svc.onApplicationBootstrap().catch(() => undefined);

      // getMigrationStatus: the status call
      prisma.$queryRaw.mockResolvedValue([]);
      mockExecSync.mockReturnValueOnce('' as never);

      const status = await svc.getMigrationStatus();

      expect(status.lastRunStatus).toBe('failed');
      expect(status.lastRunError).toBe('DB error');
    });
  });
});
