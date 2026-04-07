// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — BackupVerifyJobResult type not yet defined
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BackupService } from './backup.service';
import { BackupRetentionService } from './backup-retention.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import {
  BACKUP_QUEUE,
  BACKUP_FULL_JOB,
  BACKUP_DATABASE_JOB,
  BACKUP_FILESYSTEM_JOB,
  BACKUP_RETENTION_JOB,
  BACKUP_VERIFY_JOB,
} from './backup.constants';
import type {
  BackupJobData,
  BackupJobResult,
  BackupRetentionJobData,
  BackupRetentionJobResult,
  BackupVerifyJobData,
  BackupVerifyJobResult,
} from './backup.types';

/**
 * BullMQ processor for all backup-related jobs.
 *
 * Handles:
 *   - Database backups (pg_dump)
 *   - Filesystem backups (tar)
 *   - Full backups (database + filesystem)
 *   - Retention policy cleanup
 *   - Restore verification tests
 *
 * On failure, sends an alert email to the configured address.
 */
@Processor(BACKUP_QUEUE)
export class BackupProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly retentionService: BackupRetentionService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(
    job: Job<BackupJobData | BackupRetentionJobData | BackupVerifyJobData>,
  ): Promise<BackupJobResult | BackupRetentionJobResult | BackupVerifyJobResult> {
    this.logger.log(`Processing backup job: ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case BACKUP_FULL_JOB:
        case BACKUP_DATABASE_JOB:
        case BACKUP_FILESYSTEM_JOB:
          return await this.processBackupJob(job as Job<BackupJobData>);

        case BACKUP_RETENTION_JOB:
          return await this.processRetentionJob(job as Job<BackupRetentionJobData>);

        case BACKUP_VERIFY_JOB:
          return await this.processVerifyJob(job as Job<BackupVerifyJobData>);

        default:
          throw new Error(`Unknown backup job name: ${job.name}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error(`Backup job ${job.name} (${job.id}) failed: ${errorMessage}`);

      // Send failure alert
      await this.sendFailureAlert(job.name, errorMessage);

      throw err;
    }
  }

  // ─── Job handlers ─────────────────────────────────────────────────────────

  private async processBackupJob(job: Job<BackupJobData>): Promise<BackupJobResult> {
    const { type, category, triggeredBy } = job.data;

    await job.updateProgress(10);

    const result = await this.backupService.executeBackup(type, category, triggeredBy);

    await job.updateProgress(100);

    return result;
  }

  private async processRetentionJob(
    job: Job<BackupRetentionJobData>,
  ): Promise<BackupRetentionJobResult> {
    const { dryRun } = job.data;

    await job.updateProgress(10);

    const result = await this.retentionService.enforce(dryRun);

    await job.updateProgress(100);

    return result;
  }

  private async processVerifyJob(job: Job<BackupVerifyJobData>): Promise<BackupVerifyJobResult> {
    const { backupId } = job.data;

    await job.updateProgress(10);

    const result = await this.backupService.verifyBackup(backupId);

    await job.updateProgress(100);

    // Send alert if verification failed
    if (!result.verified) {
      await this.sendFailureAlert(
        'backup-verify',
        `Backup verification failed: ${result.error ?? 'unknown error'}`,
      );
    }

    return result;
  }

  // ─── Alert ────────────────────────────────────────────────────────────────

  /**
   * Send a failure alert email to the configured backup alert address.
   */
  private async sendFailureAlert(jobName: string, errorMessage: string): Promise<void> {
    const alertEmail = this.configService.get<string>('backup.alertEmail', '');

    if (!alertEmail) {
      this.logger.debug(
        'No alert email configured (BACKUP_ALERT_EMAIL), skipping failure notification',
      );
      return;
    }

    try {
      await this.emailService.send({
        to: alertEmail,
        template: 'backup-failure',
        variables: {
          jobName,
          errorMessage,
          timestamp: new Date().toISOString(),
          serverHost: this.configService.get<string>('frontendUrl', 'unknown'),
        },
      });

      this.logger.log(`Backup failure alert sent to ${alertEmail}`);
    } catch (err) {
      this.logger.error(`Failed to send backup failure alert: ${String(err)}`);
    }
  }
}
