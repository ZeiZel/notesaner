import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { NOTIFICATION_CLEANUP_QUEUE } from '../notifications.constants';
import type { CleanupJobData, CleanupJobResult } from '../notifications.types';

/**
 * CleanupProcessor — BullMQ worker that deletes notifications older than a
 * configurable threshold (default: 90 days).
 *
 * Runs as a cron job registered by NotificationsModule.onModuleInit().
 */
@Processor(NOTIFICATION_CLEANUP_QUEUE)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<CleanupJobResult> {
    const startMs = Date.now();
    const { maxAgeDays } = job.data;

    this.logger.log(
      `Starting notification cleanup: deleting notifications older than ${maxAgeDays} days`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      const durationMs = Date.now() - startMs;

      this.logger.log(
        `Notification cleanup completed: ${result.count} notifications deleted (${durationMs}ms)`,
      );

      return {
        deletedCount: result.count,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Notification cleanup failed: ${message}`);
      throw err;
    }
  }
}
