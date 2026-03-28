import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailModule } from '../email/email.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DigestProcessor } from './processors/digest.processor';
import {
  NOTIFICATION_DIGEST_QUEUE,
  DAILY_DIGEST_JOB,
  WEEKLY_DIGEST_JOB,
  DAILY_DIGEST_CRON,
  WEEKLY_DIGEST_CRON,
} from './notifications.constants';
import type { DigestJobData } from './notifications.types';

/**
 * NotificationsModule — in-app notifications with email digest support.
 *
 * Features:
 *   - CRUD endpoints for user notifications
 *   - Per-type channel preferences (in-app, email, both, none)
 *   - Daily and weekly email digest via BullMQ cron jobs
 *   - Integration with EmailModule for sending
 *
 * The module registers a BullMQ queue and schedules repeatable cron jobs
 * for daily (08:00 UTC) and weekly (Monday 08:00 UTC) digest emails.
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
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, DigestProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(
    @InjectQueue(NOTIFICATION_DIGEST_QUEUE)
    private readonly digestQueue: Queue<DigestJobData>,
  ) {}

  /**
   * Register repeatable cron jobs for daily and weekly digests.
   * BullMQ deduplicates repeatables with the same scheduler key.
   */
  async onModuleInit(): Promise<void> {
    try {
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

      this.logger.log(
        `Registered digest cron jobs: daily=${DAILY_DIGEST_CRON}, weekly=${WEEKLY_DIGEST_CRON}`,
      );
    } catch (err) {
      this.logger.error(`Failed to register digest cron jobs: ${String(err)}`);
    }
  }
}
