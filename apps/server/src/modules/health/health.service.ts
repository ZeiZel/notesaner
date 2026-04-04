import { Injectable, OnModuleInit } from '@nestjs/common';
import { HealthCheckError } from '@nestjs/terminus';
import { MigrationHealthIndicator } from '../../common/database';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { ValkeyHealthIndicator } from './indicators/valkey.health-indicator';
import { HealthCheckResult, MigrationServiceHealth, ServiceStatus } from './health.types';

@Injectable()
export class HealthService implements OnModuleInit {
  private initialized = false;

  constructor(
    private readonly dbIndicator: DatabaseHealthIndicator,
    private readonly valkeyIndicator: ValkeyHealthIndicator,
    private readonly migrationHealth: MigrationHealthIndicator,
  ) {}

  onModuleInit(): void {
    this.initialized = true;
  }

  async getComprehensiveHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();

    if (!this.initialized) {
      return {
        status: 'start',
        timestamp,
        services: {
          database: { status: 'start' },
          valkey: { status: 'start' },
          migrations: { status: 'start' },
        },
      };
    }

    const [database, valkey, migrations] = await Promise.all([
      this.dbIndicator.check(),
      this.valkeyIndicator.check(),
      this.checkMigrations(),
    ]);

    const statuses = [database.status, valkey.status, migrations.status];
    const overall = this.computeOverallStatus(statuses);

    return { status: overall, timestamp, services: { database, valkey, migrations } };
  }

  private async checkMigrations(): Promise<MigrationServiceHealth> {
    const start = Date.now();
    try {
      const result = await this.migrationHealth.isHealthy();
      const data = result['migrations'] as Record<string, unknown>;
      return {
        status: 'alive',
        latency_ms: Date.now() - start,
        schemaVersion: data?.['schemaVersion'] as string | null,
        appliedCount: data?.['appliedCount'] as number,
        pendingMigrations: data?.['pendingMigrations'] as string[],
      };
    } catch (error: unknown) {
      const causes = error instanceof HealthCheckError ? error.causes : undefined;
      const data = causes?.['migrations'] as Record<string, unknown> | undefined;
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        schemaVersion: data?.['schemaVersion'] as string | null | undefined,
        appliedCount: data?.['appliedCount'] as number | undefined,
        pendingMigrations: data?.['pendingMigrations'] as string[] | undefined,
      };
    }
  }

  private computeOverallStatus(statuses: ServiceStatus[]): ServiceStatus {
    if (statuses.some((s) => s === 'error')) return 'error';
    if (statuses.some((s) => s === 'pending')) return 'pending';
    return 'alive';
  }
}
