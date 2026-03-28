import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { ACTIVITY_CLEANUP_QUEUE } from '../activity.constants';
import type { ActivityCleanupJobData, ActivityCleanupJobResult } from '../activity.types';

/**
 * ActivityCleanupProcessor - BullMQ worker that deletes activity log entries
 * older than a configurable threshold (default: 90 days).
 *
 * Runs as a cron job registered by ActivityModule.onModuleInit().
 */
@Processor(ACTIVITY_CLEANUP_QUEUE)
export class ActivityCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityCleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ActivityCleanupJobData>): Promise<ActivityCleanupJobResult> {
    const startMs = Date.now();
    const { maxAgeDays } = job.data;

    this.logger.log(
      `Starting activity cleanup: deleting activity logs older than ${maxAgeDays} days`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    try {
      const result = await this.prisma.activityLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      const durationMs = Date.now() - startMs;

      this.logger.log(
        `Activity cleanup completed: ${result.count} activity logs deleted (${durationMs}ms)`,
      );

      return {
        deletedCount: result.count,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Activity cleanup failed: ${message}`);
      throw err;
    }
  }
}
