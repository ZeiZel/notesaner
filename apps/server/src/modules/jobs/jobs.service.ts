import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  INDEX_DEBOUNCE_MS,
  INDEX_NOTE_JOB,
  NOTE_INDEX_QUEUE,
  REINDEX_WORKSPACE_JOB,
} from './jobs.constants';
import type { IndexNoteJobData, ReindexWorkspaceJobData } from './jobs.types';

/**
 * Facade for enqueueing BullMQ jobs.
 *
 * Provides:
 *   - scheduleNoteIndex: debounced per-note indexing (deduplicates via jobId)
 *   - scheduleWorkspaceReindex: batch reindex for all notes in a workspace
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(NOTE_INDEX_QUEUE)
    private readonly noteIndexQueue: Queue<
      IndexNoteJobData | ReindexWorkspaceJobData
    >,
  ) {}

  /**
   * Schedule a debounced full-text-search index update for a single note.
   *
   * The job is keyed by noteId so that rapid successive saves do not pile up
   * in the queue — the delay is reset each time this is called, and only one
   * job per note will ever be waiting.
   *
   * @param noteId     UUID of the note
   * @param workspaceId UUID of the owning workspace
   * @param filePath   Absolute path to the note's .md file on disk
   */
  async scheduleNoteIndex(
    noteId: string,
    workspaceId: string,
    filePath: string,
  ): Promise<void> {
    const jobId = `index-note:${noteId}`;
    const data: IndexNoteJobData = { noteId, workspaceId, filePath };

    // Remove existing waiting/delayed job before adding the new one.
    // This achieves debouncing without needing a separate Redis key.
    const existingJob = await this.noteIndexQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existingJob.remove();
      }
    }

    await this.noteIndexQueue.add(INDEX_NOTE_JOB, data, {
      jobId,
      delay: INDEX_DEBOUNCE_MS,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });

    this.logger.debug(
      `Scheduled index for note ${noteId} with ${INDEX_DEBOUNCE_MS}ms debounce`,
    );
  }

  /**
   * Schedule a full reindex of all notes in a workspace.
   * Used by the admin batch reindex endpoint.
   *
   * @param workspaceId UUID of the workspace to reindex
   * @returns BullMQ job ID for status tracking
   */
  async scheduleWorkspaceReindex(workspaceId: string): Promise<string> {
    const jobId = `reindex-workspace:${workspaceId}:${Date.now()}`;
    const data: ReindexWorkspaceJobData = { workspaceId };

    const job = await this.noteIndexQueue.add(REINDEX_WORKSPACE_JOB, data, {
      jobId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    });

    this.logger.log(`Scheduled workspace reindex for ${workspaceId}, job ${job.id}`);
    return job.id ?? jobId;
  }

  /**
   * Retrieve the current status of a job by its ID.
   * Returns null when the job cannot be found (already removed from queue).
   */
  async getJobStatus(
    jobId: string,
  ): Promise<{ state: string; progress: unknown } | null> {
    const job = await this.noteIndexQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return { state, progress: job.progress };
  }
}
