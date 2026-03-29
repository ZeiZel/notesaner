/**
 * Unit tests for MigrationHealthIndicator.
 *
 * Covers:
 * - isHealthy(): returns up result when no pending migrations and last run succeeded
 * - isHealthy(): returns up result when run was skipped (no RUN_MIGRATIONS)
 * - isHealthy(): throws HealthCheckError when there are pending migrations
 * - isHealthy(): throws HealthCheckError when last run failed
 * - isHealthy(): throws HealthCheckError when getMigrationStatus() throws
 * - Result includes expected details (schemaVersion, appliedCount, lastRunStatus)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckError } from '@nestjs/terminus';
import { MigrationHealthIndicator } from '../database/migration.health-indicator';
import type { MigrationStatus } from '../database/migration.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildStatus(overrides: Partial<MigrationStatus> = {}): MigrationStatus {
  return {
    schemaVersion: '20260101000000_init',
    appliedCount: 5,
    pendingMigrations: [],
    hasPendingMigrations: false,
    checkedAt: new Date().toISOString(),
    lastRunStatus: 'success',
    lastRunError: null,
    ...overrides,
  };
}

function createMockMigrationService(statusOverrides: Partial<MigrationStatus> = {}) {
  return {
    getMigrationStatus: vi.fn().mockResolvedValue(buildStatus(statusOverrides)),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MigrationHealthIndicator', () => {
  let indicator: MigrationHealthIndicator;
  let mockService: ReturnType<typeof createMockMigrationService>;

  beforeEach(() => {
    mockService = createMockMigrationService();
    indicator = new MigrationHealthIndicator(mockService as never);
  });

  // ── Healthy cases ─────────────────────────────────────────────────────────

  describe('isHealthy() — healthy', () => {
    it('returns up when no pending migrations and last run succeeded', async () => {
      const result = await indicator.isHealthy();

      expect(result['migrations'].status).toBe('up');
      expect(result['migrations'].schemaVersion).toBe('20260101000000_init');
      expect(result['migrations'].appliedCount).toBe(5);
      expect(result['migrations'].lastRunStatus).toBe('success');
    });

    it('returns up when last run status is "skipped"', async () => {
      mockService = createMockMigrationService({ lastRunStatus: 'skipped' });
      indicator = new MigrationHealthIndicator(mockService as never);

      const result = await indicator.isHealthy();

      expect(result['migrations'].status).toBe('up');
      expect(result['migrations'].lastRunStatus).toBe('skipped');
    });

    it('returns up when last run status is "pending" and no pending migrations', async () => {
      mockService = createMockMigrationService({ lastRunStatus: 'pending' });
      indicator = new MigrationHealthIndicator(mockService as never);

      const result = await indicator.isHealthy();

      expect(result['migrations'].status).toBe('up');
    });

    it('result details include schemaVersion and appliedCount', async () => {
      const result = await indicator.isHealthy();

      expect(result['migrations']).toMatchObject({
        status: 'up',
        schemaVersion: '20260101000000_init',
        appliedCount: 5,
        pendingMigrations: [],
      });
    });
  });

  // ── Unhealthy cases ───────────────────────────────────────────────────────

  describe('isHealthy() — unhealthy', () => {
    it('throws HealthCheckError when there are pending migrations', async () => {
      mockService = createMockMigrationService({
        pendingMigrations: ['20260201000000_add_notes'],
        hasPendingMigrations: true,
        lastRunStatus: 'skipped',
      });
      indicator = new MigrationHealthIndicator(mockService as never);

      await expect(indicator.isHealthy()).rejects.toThrow(HealthCheckError);
    });

    it('thrown error contains pending migration details', async () => {
      mockService = createMockMigrationService({
        pendingMigrations: ['20260201000000_add_notes', '20260301000000_add_activity'],
        hasPendingMigrations: true,
        lastRunStatus: 'skipped',
      });
      indicator = new MigrationHealthIndicator(mockService as never);

      let caught: HealthCheckError | null = null;
      try {
        await indicator.isHealthy();
      } catch (error) {
        caught = error as HealthCheckError;
      }

      expect(caught).toBeInstanceOf(HealthCheckError);
      // The HealthCheckError causes object contains our status
      const causes = caught?.causes as Record<string, unknown> | undefined;
      expect(causes?.['migrations']).toBeDefined();
      const migrationsInfo = causes?.['migrations'] as Record<string, unknown>;
      expect(migrationsInfo?.status).toBe('down');
    });

    it('throws HealthCheckError when last run failed', async () => {
      mockService = createMockMigrationService({
        lastRunStatus: 'failed',
        lastRunError: 'P1001: Can not reach database server',
      });
      indicator = new MigrationHealthIndicator(mockService as never);

      await expect(indicator.isHealthy()).rejects.toThrow(HealthCheckError);
    });

    it('failed run includes error message in result', async () => {
      mockService = createMockMigrationService({
        lastRunStatus: 'failed',
        lastRunError: 'P3006: Migration failed',
        pendingMigrations: [],
        hasPendingMigrations: false,
      });
      indicator = new MigrationHealthIndicator(mockService as never);

      let caught: HealthCheckError | null = null;
      try {
        await indicator.isHealthy();
      } catch (error) {
        caught = error as HealthCheckError;
      }

      expect(caught).toBeInstanceOf(HealthCheckError);
      const causes = caught?.causes as Record<string, unknown> | undefined;
      const info = causes?.['migrations'] as Record<string, unknown>;
      expect(info?.status).toBe('down');
      expect(info?.error).toContain('P3006');
    });

    it('throws HealthCheckError when getMigrationStatus throws', async () => {
      mockService.getMigrationStatus.mockRejectedValue(new Error('Database unreachable'));
      indicator = new MigrationHealthIndicator(mockService as never);

      await expect(indicator.isHealthy()).rejects.toThrow(HealthCheckError);
    });

    it('service error is included in thrown error causes', async () => {
      mockService.getMigrationStatus.mockRejectedValue(new Error('ECONNREFUSED'));
      indicator = new MigrationHealthIndicator(mockService as never);

      let caught: HealthCheckError | null = null;
      try {
        await indicator.isHealthy();
      } catch (error) {
        caught = error as HealthCheckError;
      }

      const causes = caught?.causes as Record<string, unknown> | undefined;
      const info = causes?.['migrations'] as Record<string, unknown>;
      expect(String(info?.error)).toContain('ECONNREFUSED');
    });
  });
});
