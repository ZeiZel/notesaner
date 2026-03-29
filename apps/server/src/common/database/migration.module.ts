import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { MigrationHealthIndicator } from './migration.health-indicator';

/**
 * MigrationModule
 *
 * Provides:
 *  - MigrationService  — bootstrap migration runner + status API
 *  - MigrationHealthIndicator — Terminus health indicator for migration state
 *
 * Import this module in HealthModule so the readiness probe can report
 * whether the database schema is up to date.
 *
 * MigrationService depends on PrismaService which is provided globally by
 * PrismaModule, so no explicit import of PrismaModule is needed here.
 */
@Module({
  providers: [MigrationService, MigrationHealthIndicator],
  exports: [MigrationService, MigrationHealthIndicator],
})
export class MigrationModule {}
