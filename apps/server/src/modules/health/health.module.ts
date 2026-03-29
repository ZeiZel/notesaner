import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MigrationModule } from '../../common/database';

@Module({
  imports: [TerminusModule, MigrationModule],
  controllers: [HealthController],
})
export class HealthModule {}
