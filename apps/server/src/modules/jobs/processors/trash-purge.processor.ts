import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TrashService, TRASH_RETENTION_DAYS } from '../../notes/trash.service';
import { TRASH_PURGE_JOB, TRASH_PURGE_QUEUE } from '../jobs.constants';
import type { TrashPurgeJobData, TrashPurgeJobResult } from '../jobs.types';

/**
 * BullMQ processor for daily trash purge.
 *
 * Runs on a cron schedule (configured in JobsModule at 02:00 UTC) and:
 *   1. Calls TrashService.purgeExpired() to delete notes trashed longer than retentionDays.
 *   2. Returns the count of purged notes and elapsed time.
 *
 * Errors are caught and logged — the job does NOT throw on purge failure
 * to avoid endless retry loops for transient filesystem issues.
 */
@Processor(TRASH_PURGE_QUEUE)
export class TrashPurgeProcessor extends WorkerHost {
  private readonly logger = new Logger(TrashPurgeProcessor.name);

  constructor(private readonly trashService: TrashService) {
    super();
  }

  async process(job: Job<TrashPurgeJobData>): Promise<TrashPurgeJobResult> {
    if (job.name !== TRASH_PURGE_JOB) {
      this.logger.warn(`Received unexpected job name "${job.name}" — skipping`);
      return { purgedCount: 0, retentionDays: TRASH_RETENTION_DAYS, durationMs: 0 };
    }

    const start = Date.now();
    const retentionDays = job.data.retentionDays ?? TRASH_RETENTION_DAYS;

    this.logger.log(`Starting trash purge (retention: ${retentionDays} days)`);

    let purgedCount = 0;

    try {
      purgedCount = await this.trashService.purgeExpired(retentionDays);
    } catch (err) {
      // Log but do not rethrow — a purge failure should not fill the dead-letter queue
      this.logger.error(`Trash purge failed: ${String(err)}`);
    }

    await job.updateProgress(100);

    const durationMs = Date.now() - start;

    this.logger.log(`Trash purge complete: ${purgedCount} note(s) purged in ${durationMs}ms`);

    return { purgedCount, retentionDays, durationMs };
  }
}
