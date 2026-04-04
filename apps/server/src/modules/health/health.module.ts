import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { ValkeyHealthIndicator } from './indicators/valkey.health-indicator';
import { MigrationModule } from '../../common/database';

@Module({
  imports: [TerminusModule, MigrationModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    DatabaseHealthIndicator,
    ValkeyHealthIndicator,
  ],
})
export class HealthModule {}
