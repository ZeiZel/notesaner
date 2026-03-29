import { Injectable, Logger, NotImplementedException, OnModuleInit } from '@nestjs/common';
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

  async onModuleInit(): Promise<void> {
    try {
      await this.freshnessCheckQueue.upsertJobScheduler(
        'freshness-daily-scheduler',
        { pattern: FRESHNESS_CHECK_CRON },
        {
          name: FRESHNESS_CHECK_JOB,
          data: {} as FreshnessCheckJobData,
          opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 20 } },
        },
      );
      this.logger.log(`Registered daily freshness check cron: ${FRESHNESS_CHECK_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register freshness check cron: ${String(err)}`);
    }

    try {
      await this.storageRecalculationQueue.upsertJobScheduler(
        'storage-daily-scheduler',
        { pattern: STORAGE_RECALCULATION_CRON },
        {
          name: STORAGE_RECALCULATION_JOB,
          data: {} as StorageRecalculationJobData,
          opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 20 } },
        },
      );
      this.logger.log(`Registered daily storage recalculation cron: ${STORAGE_RECALCULATION_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register storage recalculation cron: ${String(err)}`);
    }

    try {
      await this.trashPurgeQueue.upsertJobScheduler(
        'trash-purge-daily-scheduler',
        { pattern: TRASH_PURGE_CRON },
        {
          name: TRASH_PURGE_JOB,
          data: {} as TrashPurgeJobData,
          opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 20 } },
        },
      );
      this.logger.log(`Registered daily trash purge cron: ${TRASH_PURGE_CRON}`);
    } catch (err) {
      this.logger.error(`Failed to register trash purge cron: ${String(err)}`);
    }
  }

  async scheduleNoteIndex(noteId: string, workspaceId: string, filePath: string): Promise<void> {
    const jobId = `index-note:${noteId}`;
    const data: IndexNoteJobData = { noteId, workspaceId, filePath };

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

  /**
   * Enqueue an email sending job.
   *
   * TODO: Wire up an email queue when email infrastructure is ready.
   * Currently a stub that logs the request.
   */
  async enqueueSendEmail(
    _to: string,
    _template: string,
    _variables: Record<string, unknown>,
  ): Promise<void> {
    throw new NotImplementedException('enqueueSendEmail not yet implemented');
  }

  async getJobStatus(jobId: string): Promise<{ state: string; progress: unknown } | null> {
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
