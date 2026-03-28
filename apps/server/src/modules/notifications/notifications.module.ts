import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailModule } from '../email/email.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { DigestProcessor } from './processors/digest.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import {
  NOTIFICATION_DIGEST_QUEUE,
  NOTIFICATION_CLEANUP_QUEUE,
  DAILY_DIGEST_JOB,
  WEEKLY_DIGEST_JOB,
  CLEANUP_JOB,
  DAILY_DIGEST_CRON,
  WEEKLY_DIGEST_CRON,
  CLEANUP_CRON,
  NOTIFICATION_MAX_AGE_DAYS,
} from './notifications.constants';
import type { DigestJobData, CleanupJobData } from './notifications.types';

/**
 * NotificationsModule — in-app notifications with email digest support.
 *
 * Features:
 *   - CRUD endpoints for user notifications
 *   - Per-type channel preferences (in-app, email, both, none)
 *   - Daily and weekly email digest via BullMQ cron jobs
 *   - WebSocket push for real-time notification delivery
 *   - Auto-delete notifications older than 90 days (BullMQ cron)
 *   - Rate limiting: max 100 notifications per user per hour (ValKey)
 *   - Integration with EmailModule for sending
 *
 * The module registers BullMQ queues and schedules repeatable cron jobs
 * for daily (08:00 UTC) and weekly (Monday 08:00 UTC) digest emails,
 * and a daily (03:00 UTC) cleanup job for old notifications.
 *
 * @example
 * // Inject NotificationsService in other modules:
 * @Module({ imports: [NotificationsModule] })
 * export class CommentsModule {}
 *
 * constructor(private readonly notifications: NotificationsService) {}
 * await notifications.create({
 *   userId: '...',
 *   type: 'COMMENT_MENTION',
 *   title: 'You were mentioned',
 *   body: 'Alice mentioned you in a comment',
 *   noteId: '...',
 *   metadata: { noteId: '...', commentId: '...' },
 * });
 */
@Module({
  imports: [
    EmailModule,
    BullModule.registerQueue({
      name: NOTIFICATION_DIGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 20 },
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_CLEANUP_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, DigestProcessor, CleanupProcessor],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(
    @InjectQueue(NOTIFICATION_DIGEST_QUEUE)
    private readonly digestQueue: Queue<DigestJobData>,
    @InjectQueue(NOTIFICATION_CLEANUP_QUEUE)
    private readonly cleanupQueue: Queue<CleanupJobData>,
  ) {}

  /**
   * Register repeatable cron jobs for digests and cleanup.
   * BullMQ deduplicates repeatables with the same scheduler key.
   */
  async onModuleInit(): Promise<void> {
    try {
      // ── Digest cron jobs ──────────────────────────────────────────────
      await this.digestQueue.upsertJobScheduler(
        'digest-daily-scheduler',
        { pattern: DAILY_DIGEST_CRON },
        {
          name: DAILY_DIGEST_JOB,
          data: { frequency: 'DAILY' },
        },
      );

      await this.digestQueue.upsertJobScheduler(
        'digest-weekly-scheduler',
        { pattern: WEEKLY_DIGEST_CRON },
        {
          name: WEEKLY_DIGEST_JOB,
          data: { frequency: 'WEEKLY' },
        },
      );

      // ── Cleanup cron job ──────────────────────────────────────────────
      await this.cleanupQueue.upsertJobScheduler(
        'cleanup-notifications-scheduler',
        { pattern: CLEANUP_CRON },
        {
          name: CLEANUP_JOB,
          data: { maxAgeDays: NOTIFICATION_MAX_AGE_DAYS },
        },
      );

      this.logger.log(
        `Registered notification cron jobs: ` +
          `daily-digest=${DAILY_DIGEST_CRON}, ` +
          `weekly-digest=${WEEKLY_DIGEST_CRON}, ` +
          `cleanup=${CLEANUP_CRON} (max-age=${NOTIFICATION_MAX_AGE_DAYS}d)`,
      );
    } catch (err) {
      this.logger.error(`Failed to register notification cron jobs: ${String(err)}`);
    }
  }
}
