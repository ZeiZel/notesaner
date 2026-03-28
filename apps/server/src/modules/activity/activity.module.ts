import { Module, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityGateway } from './activity.gateway';
import { ActivityCleanupProcessor } from './processors/cleanup.processor';
import {
  ACTIVITY_CLEANUP_QUEUE,
  ACTIVITY_CLEANUP_JOB,
  ACTIVITY_CLEANUP_CRON,
  ACTIVITY_MAX_AGE_DAYS,
} from './activity.constants';
import type { ActivityCleanupJobData } from './activity.types';

/**
 * ActivityModule - workspace activity feed and note follow subscriptions.
 *
 * Features:
 *   - REST endpoints for workspace and per-note activity feeds
 *   - Note follow/unfollow for activity subscriptions
 *   - @mention detection in note content
 *   - WebSocket push for real-time activity delivery
 *   - Auto-delete activity logs older than 90 days (BullMQ cron)
 *   - Integrates with NotificationsModule for follower notifications
 *
 * The module registers a BullMQ cleanup cron job that runs daily at 04:00 UTC
 * to remove activity logs older than 90 days.
 */
@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    BullModule.registerQueue({
      name: ACTIVITY_CLEANUP_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    }),
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityGateway, ActivityCleanupProcessor],
  exports: [ActivityService, ActivityGateway],
})
export class ActivityModule implements OnModuleInit {
  private readonly logger = new Logger(ActivityModule.name);

  constructor(
    @InjectQueue(ACTIVITY_CLEANUP_QUEUE)
    private readonly cleanupQueue: Queue<ActivityCleanupJobData>,
  ) {}

  /**
   * Register the cleanup cron job on module initialization.
   * BullMQ deduplicates repeatables with the same scheduler key.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.cleanupQueue.upsertJobScheduler(
        'cleanup-activity-scheduler',
        { pattern: ACTIVITY_CLEANUP_CRON },
        {
          name: ACTIVITY_CLEANUP_JOB,
          data: { maxAgeDays: ACTIVITY_MAX_AGE_DAYS },
        },
      );

      this.logger.log(
        `Registered activity cleanup cron: ${ACTIVITY_CLEANUP_CRON} (max-age=${ACTIVITY_MAX_AGE_DAYS}d)`,
      );
    } catch (err) {
      this.logger.error(`Failed to register activity cleanup cron: ${String(err)}`);
    }
  }
}
