import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { MigrationService } from './migration.service';

/**
 * Terminus health indicator for database migration state.
 *
 * Reports:
 *  - "up" when all migrations are applied and the last run succeeded (or was skipped).
 *  - "down" when there are pending migrations OR the last deploy failed.
 *
 * Used by the health module's readiness probe so that Kubernetes (or any other
 * orchestrator) will not route traffic to a pod until its schema is fully up to date.
 *
 * Example response when healthy:
 * ```json
 * {
 *   "migrations": {
 *     "status": "up",
 *     "schemaVersion": "20260328000000_add_activity_table",
 *     "appliedCount": 42,
 *     "pendingMigrations": [],
 *     "lastRunStatus": "success"
 *   }
 * }
 * ```
 *
 * Example response when unhealthy:
 * ```json
 * {
 *   "migrations": {
 *     "status": "down",
 *     "schemaVersion": "20260327000000_previous",
 *     "appliedCount": 41,
 *     "pendingMigrations": ["20260328000000_add_activity_table"],
 *     "lastRunStatus": "skipped",
 *     "error": "1 pending migration(s) detected"
 *   }
 * }
 * ```
 */
@Injectable()
export class MigrationHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(MigrationHealthIndicator.name);

  private static readonly KEY = 'migrations';

  constructor(private readonly migrationService: MigrationService) {
    super();
  }

  /**
   * Checks migration health. Throws HealthCheckError if unhealthy.
   *
   * @throws {HealthCheckError} if there are pending migrations or last deploy failed.
   */
  async isHealthy(): Promise<HealthIndicatorResult> {
    let status;

    try {
      status = await this.migrationService.getMigrationStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch migration status: ${message}`);

      const result = this.getStatus(MigrationHealthIndicator.KEY, false, {
        error: `Failed to retrieve migration status: ${message}`,
      });

      throw new HealthCheckError('Migration health check failed', result);
    }

    const details: Record<string, unknown> = {
      schemaVersion: status.schemaVersion,
      appliedCount: status.appliedCount,
      pendingMigrations: status.pendingMigrations,
      lastRunStatus: status.lastRunStatus,
    };

    // Determine health:
    // - 'failed' run is always unhealthy
    // - Pending migrations are unhealthy (schema drift)
    // - 'pending' status means service has not bootstrapped yet — treat as degraded but not fatal
    if (status.lastRunStatus === 'failed') {
      details['error'] = status.lastRunError ?? 'Migration deploy failed';
      const result = this.getStatus(MigrationHealthIndicator.KEY, false, details);
      throw new HealthCheckError('Migration deploy failed', result);
    }

    if (status.hasPendingMigrations) {
      details['error'] = `${status.pendingMigrations.length} pending migration(s) detected`;
      const result = this.getStatus(MigrationHealthIndicator.KEY, false, details);
      throw new HealthCheckError('Pending migrations detected', result);
    }

    return this.getStatus(MigrationHealthIndicator.KEY, true, details);
  }
}
