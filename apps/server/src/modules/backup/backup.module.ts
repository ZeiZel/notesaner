import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BACKUP_QUEUE } from './backup.constants';
import { BackupService } from './backup.service';
import { BackupRetentionService } from './backup-retention.service';
import { BackupProcessor } from './backup.processor';
import { BackupController } from './backup.controller';
import { EmailModule } from '../email/email.module';

/**
 * BackupModule — automated backup and disaster recovery.
 *
 * Provides:
 *   - Scheduled PostgreSQL backups via pg_dump (daily/weekly/monthly)
 *   - Filesystem backup of workspace note directories
 *   - AES-256-GCM encryption of all backup archives
 *   - Configurable destination: local filesystem or S3-compatible storage
 *   - Retention policy enforcement (7 daily, 4 weekly, 3 monthly)
 *   - Weekly restore verification tests
 *   - SMTP alerts on backup failure
 *   - Admin API for manual triggers and status monitoring
 *
 * Configuration via environment variables:
 *   BACKUP_ENABLED, BACKUP_LOCAL_PATH, BACKUP_ENCRYPTION_KEY,
 *   BACKUP_ALERT_EMAIL, BACKUP_PG_DUMP_PATH, BACKUP_S3_*, etc.
 */
@Module({
  imports: [
    EmailModule,
    BullModule.registerQueue({
      name: BACKUP_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    }),
  ],
  controllers: [BackupController],
  providers: [
    BackupService,
    BackupRetentionService,
    {
      provide: BackupProcessor,
      useClass: BackupProcessor,
    },
  ],
  exports: [BackupService],
})
export class BackupModule {}
