import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DELIVER_WEBHOOK_JOB,
  FRESHNESS_CHECK_CRON,
  FRESHNESS_CHECK_JOB,
  FRESHNESS_CHECK_QUEUE,
  INDEX_DEBOUNCE_MS,
  INDEX_NOTE_JOB,
  NOTE_INDEX_QUEUE,
  REINDEX_WORKSPACE_JOB,
  STORAGE_RECALCULATION_CRON,
  STORAGE_RECALCULATION_JOB,
  STORAGE_RECALCULATION_QUEUE,
  TRASH_PURGE_CRON,
  TRASH_PURGE_JOB,
  TRASH_PURGE_QUEUE,
  WEBHOOK_BACKOFF_BASE_DELAY_MS,
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_MAX_ATTEMPTS,
} from './jobs.constants';
import type {
  DeliverWebhookJobData,
  FreshnessCheckJobData,
  IndexNoteJobData,
  ReindexWorkspaceJobData,
  StorageRecalculationJobData,
  TrashPurgeJobData,
} from './jobs.types';

/**
 * Facade for enqueueing BullMQ jobs.
 *
 * Provides:
 *   - scheduleNoteIndex: debounced per-note indexing (deduplicates via jobId)
 *   - scheduleWorkspaceReindex: batch reindex for all notes in a workspace
 *   - scheduleFreshnessCheck: on-demand freshness check for a workspace
 *   - scheduleTrashPurge: on-demand trash purge
 *   - Daily cron-based freshness check, storage recalculation, and trash purge (registered on module init)
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(NOTE_INDEX_QUEUE)
    private readonly noteIndexQueue: Queue<IndexNoteJobData | ReindexWorkspaceJobData>,
    @InjectQueue(FRESHNESS_CHECK_QUEUE)
    private readonly freshnessCheckQueue: Queue<FreshnessCheckJobData>,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookDeliveryQueue: Queue<DeliverWebhookJobData>,
    @InjectQueue(STORAGE_RECALCULATION_QUEUE)
    private readonly storageRecalculationQueue: Queue<StorageRecalculationJobData>,
    @InjectQueue(TRASH_PURGE_QUEUE)
    private readonly trashPurgeQueue: Queue<TrashPurgeJobData>,
  ) {}

  /**
   * Register the daily cron-based freshness check as a repeatable BullMQ job.
   * This runs once on application startup and is idempotent (BullMQ deduplicates
   * repeatables with the same key).
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.freshnessCheckQueue.upsertJobScheduler(
        'freshness-daily-scheduler',
        { pattern: FRESHNESS_CHECK_CRON },
        {
          name: FRESHNESS_CHECK_JOB,
          data: {} as FreshnessCheckJobData,
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 20 },
          },
        },
      );

      this.logger.log(`Registered daily freshness check cron: ${FRESHNESS_CHECK_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register freshness check cron: ${String(err)}`);
    }

    // Register daily storage recalculation cron (03:00 UTC)
    try {
      await this.storageRecalculationQueue.upsertJobScheduler(
        'storage-daily-scheduler',
        { pattern: STORAGE_RECALCULATION_CRON },
        {
          name: STORAGE_RECALCULATION_JOB,
          data: {} as StorageRecalculationJobData,
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 20 },
          },
        },
      );

      this.logger.log(`Registered daily storage recalculation cron: ${STORAGE_RECALCULATION_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register storage recalculation cron: ${String(err)}`);
    }

    // Register daily trash purge cron (02:00 UTC)
    try {
      await this.trashPurgeQueue.upsertJobScheduler(
        'trash-purge-daily-scheduler',
        { pattern: TRASH_PURGE_CRON },
        {
          name: TRASH_PURGE_JOB,
          data: {} as TrashPurgeJobData,
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 20 },
          },
        },
      );

      this.logger.log(`Registered daily trash purge cron: ${TRASH_PURGE_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register trash purge cron: ${String(err)}`);
    }
  }

  // ─── Note indexing jobs ───────────────────────────────────────────────────

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
  async scheduleNoteIndex(noteId: string, workspaceId: string, filePath: string): Promise<void> {
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

    this.logger.debug(`Scheduled index for note ${noteId} with ${INDEX_DEBOUNCE_MS}ms debounce`);
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

  // ─── Freshness check jobs ──────────────────────────────────────────────────

  /**
   * Schedule an on-demand freshness check for a specific workspace.
   * Useful for admin-triggered checks outside the daily cron schedule.
   *
   * @param workspaceId UUID of the workspace to check.
   * @returns BullMQ job ID for status tracking.
   */
  async scheduleFreshnessCheck(workspaceId?: string): Promise<string> {
    const jobId = `freshness-check:${workspaceId ?? 'all'}:${Date.now()}`;
    const data: FreshnessCheckJobData = { workspaceId };

    const job = await this.freshnessCheckQueue.add(FRESHNESS_CHECK_JOB, data, {
      jobId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 20 },
    });

    this.logger.log(
      `Scheduled freshness check${workspaceId ? ` for workspace ${workspaceId}` : ' (all workspaces)'}, job ${job.id}`,
    );
    return job.id ?? jobId;
  }

  // ─── Webhook delivery jobs ─────────────────────────────────────────────────

  /**
   * Enqueue a webhook delivery job with retry semantics.
   *
   * Uses exponential back-off: attempt 1 = 1s, attempt 2 = 10s, attempt 3 = ~60s.
   * Each delivery attempt is handled by the WebhookDeliveryProcessor.
   */
  async enqueueDeliverWebhook(data: DeliverWebhookJobData): Promise<void> {
    const jobId = `webhook-deliver:${data.deliveryId}`;

    await this.webhookDeliveryQueue.add(DELIVER_WEBHOOK_JOB, data, {
      jobId,
      attempts: WEBHOOK_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: WEBHOOK_BACKOFF_BASE_DELAY_MS },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    });

    this.logger.debug(`Enqueued webhook delivery ${data.deliveryId} for webhook ${data.webhookId}`);
  }

  // ─── Storage recalculation jobs ─────────────────────────────────────────────

  /**
   * Schedule an on-demand storage recalculation for a specific workspace or all workspaces.
   *
   * @param workspaceId Optional workspace ID. When omitted, recalculates all workspaces.
   * @returns BullMQ job ID for status tracking.
   */
  async scheduleStorageRecalculation(workspaceId?: string): Promise<string> {
    const jobId = `storage-recalculation:${workspaceId ?? 'all'}:${Date.now()}`;
    const data: StorageRecalculationJobData = { workspaceId };

    const job = await this.storageRecalculationQueue.add(STORAGE_RECALCULATION_JOB, data, {
      jobId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 20 },
    });

    this.logger.log(
      `Scheduled storage recalculation${workspaceId ? ` for workspace ${workspaceId}` : ' (all workspaces)'}, job ${job.id}`,
    );
    return job.id ?? jobId;
  }

  // ─── Trash purge jobs ──────────────────────────────────────────────────────

  /**
   * Schedule an on-demand trash purge, optionally overriding the retention period.
   *
   * Useful for admin-triggered purges or testing without waiting for the daily cron.
   *
   * @param retentionDays Optional days override (default: 30)
   * @returns BullMQ job ID for status tracking.
   */
  async scheduleTrashPurge(retentionDays?: number): Promise<string> {
    const jobId = `trash-purge:on-demand:${Date.now()}`;
    const data: TrashPurgeJobData = { retentionDays };

    const job = await this.trashPurgeQueue.add(TRASH_PURGE_JOB, data, {
      jobId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 20 },
    });

    this.logger.log(`Scheduled on-demand trash purge, job ${job.id}`);
    return job.id ?? jobId;
  }

  // ─── Job status ───────────────────────────────────────────────────────────

  /**
   * Retrieve the current status of a job by its ID.
   * Returns null when the job cannot be found (already removed from queue).
   */
  async getJobStatus(jobId: string): Promise<{ state: string; progress: unknown } | null> {
    // Check both queues for the job
    const noteJob = await this.noteIndexQueue.getJob(jobId);
    if (noteJob) {
      const state = await noteJob.getState();
      return { state, progress: noteJob.progress };
    }

    const freshnessJob = await this.freshnessCheckQueue.getJob(jobId);
    if (freshnessJob) {
      const state = await freshnessJob.getState();
      return { state, progress: freshnessJob.progress };
    }

    const webhookJob = await this.webhookDeliveryQueue.getJob(jobId);
    if (webhookJob) {
      const state = await webhookJob.getState();
      return { state, progress: webhookJob.progress };
    }

    const storageJob = await this.storageRecalculationQueue.getJob(jobId);
    if (storageJob) {
      const state = await storageJob.getState();
      return { state, progress: storageJob.progress };
    }

    const trashPurgeJob = await this.trashPurgeQueue.getJob(jobId);
    if (trashPurgeJob) {
      const state = await trashPurgeJob.getState();
      return { state, progress: trashPurgeJob.progress };
    }

    return null;
  }
}
