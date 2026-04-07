export type ServiceStatus = 'start' | 'pending' | 'alive' | 'error';

export interface ServiceHealth {
  status: ServiceStatus;
  latency_ms?: number;
  error?: string;
}

export interface MigrationServiceHealth extends ServiceHealth {
  schemaVersion?: string | null;
  appliedCount?: number;
  pendingMigrations?: string[];
}

export interface HealthCheckResult {
  status: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    valkey: ServiceHealth;
    migrations: MigrationServiceHealth;
  };
}
