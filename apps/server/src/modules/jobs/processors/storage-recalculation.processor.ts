import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { StorageQuotaService } from '../../workspaces/storage-quota.service';
import { STORAGE_RECALCULATION_JOB, STORAGE_RECALCULATION_QUEUE } from '../jobs.constants';
import type { StorageRecalculationJobData, StorageRecalculationJobResult } from '../jobs.types';

/**
 * BullMQ processor for workspace storage recalculation.
 *
 * Runs on a cron schedule (daily at 03:00 UTC) and:
 *   1. Iterates over all workspaces (or a single workspace if specified).
 *   2. Recalculates storage stats from database aggregates.
 *   3. Reports progress as it processes each workspace.
 *
 * This provides an accurate "ground truth" baseline that corrects any
 * drift in the incremental counters updated on CRUD operations.
 */
@Processor(STORAGE_RECALCULATION_QUEUE)
export class StorageRecalculationProcessor extends WorkerHost {
  private readonly logger = new Logger(StorageRecalculationProcessor.name);

  constructor(private readonly storageQuotaService: StorageQuotaService) {
    super();
  }

  async process(job: Job<StorageRecalculationJobData>): Promise<StorageRecalculationJobResult> {
    if (job.name !== STORAGE_RECALCULATION_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    return this.processRecalculation(job);
  }

  private async processRecalculation(
    job: Job<StorageRecalculationJobData>,
  ): Promise<StorageRecalculationJobResult> {
    const start = Date.now();
    const { workspaceId } = job.data;

    this.logger.log(
      workspaceId
        ? `Starting storage recalculation for workspace ${workspaceId}`
        : 'Starting daily storage recalculation for all workspaces',
    );

    if (workspaceId) {
      try {
        await this.storageQuotaService.recalculate(workspaceId);
        await job.updateProgress(100);

        const durationMs = Date.now() - start;
        this.logger.log(
          `Storage recalculation complete for workspace ${workspaceId} in ${durationMs}ms`,
        );

        return {
          workspacesProcessed: 1,
          errors: 0,
          durationMs,
        };
      } catch (err) {
        this.logger.error(
          `Storage recalculation failed for workspace ${workspaceId}: ${String(err)}`,
        );
        return {
          workspacesProcessed: 1,
          errors: 1,
          durationMs: Date.now() - start,
        };
      }
    }

    // Recalculate all workspaces
    const result = await this.storageQuotaService.recalculateAll();
    await job.updateProgress(100);

    const durationMs = Date.now() - start;

    this.logger.log(
      `Storage recalculation complete: ${result.workspacesProcessed} workspace(s), ` +
        `${result.errors} error(s) in ${durationMs}ms`,
    );

    return {
      workspacesProcessed: result.workspacesProcessed,
      errors: result.errors,
      durationMs,
    };
  }
}
