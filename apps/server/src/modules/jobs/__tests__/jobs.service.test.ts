import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobsService } from '../jobs.service';

// ---------------------------------------------------------------------------
// BullMQ Queue mock
// ---------------------------------------------------------------------------
const mockJob = {
  id: 'job-123',
  getState: vi.fn(),
  remove: vi.fn(),
  progress: 0,
};

function createMockQueue() {
  return {
    add: vi.fn(),
    getJob: vi.fn(),
    upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
  };
}

describe('JobsService', () => {
  let service: JobsService;
  let noteIndexQueue: ReturnType<typeof createMockQueue>;
  let freshnessCheckQueue: ReturnType<typeof createMockQueue>;
  let webhookDeliveryQueue: ReturnType<typeof createMockQueue>;
  let storageRecalculationQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    vi.clearAllMocks();
    noteIndexQueue = createMockQueue();
    freshnessCheckQueue = createMockQueue();
    webhookDeliveryQueue = createMockQueue();
    storageRecalculationQueue = createMockQueue();

    service = new JobsService(
      noteIndexQueue as never,
      freshnessCheckQueue as never,
      webhookDeliveryQueue as never,
      storageRecalculationQueue as never,
    );
  });

  // -------------------------------------------------------------------------
  // scheduleNoteIndex
  // -------------------------------------------------------------------------

  describe('scheduleNoteIndex', () => {
    it('adds a delayed job with the correct jobId', async () => {
      noteIndexQueue.getJob.mockResolvedValue(null);
      noteIndexQueue.add.mockResolvedValue({ id: 'job-abc' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(noteIndexQueue.add).toHaveBeenCalledWith(
        'index-note',
        { noteId: 'note-1', workspaceId: 'ws-1', filePath: '/vault/note.md' },
        expect.objectContaining({
          jobId: 'index-note:note-1',
          delay: expect.any(Number),
        }),
      );
    });

    it('removes existing delayed job before adding new one (debounce)', async () => {
      mockJob.getState.mockResolvedValue('delayed');
      mockJob.remove.mockResolvedValue(undefined);
      noteIndexQueue.getJob.mockResolvedValue(mockJob);
      noteIndexQueue.add.mockResolvedValue({ id: 'job-new' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(mockJob.remove).toHaveBeenCalledOnce();
      expect(noteIndexQueue.add).toHaveBeenCalledOnce();
    });

    it('does not remove active jobs during debounce', async () => {
      mockJob.getState.mockResolvedValue('active');
      noteIndexQueue.getJob.mockResolvedValue(mockJob);
      noteIndexQueue.add.mockResolvedValue({ id: 'job-new' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      // Active job should not be removed
      expect(mockJob.remove).not.toHaveBeenCalled();
      // But a new job should still be added
      expect(noteIndexQueue.add).toHaveBeenCalledOnce();
    });

    it('includes retry configuration', async () => {
      noteIndexQueue.getJob.mockResolvedValue(null);
      noteIndexQueue.add.mockResolvedValue({ id: 'job-abc' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(noteIndexQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // scheduleWorkspaceReindex
  // -------------------------------------------------------------------------

  describe('scheduleWorkspaceReindex', () => {
    it('enqueues a reindex job and returns a job ID', async () => {
      noteIndexQueue.add.mockResolvedValue({ id: 'reindex-job-1' });

      const jobId = await service.scheduleWorkspaceReindex('ws-1');

      expect(jobId).toBe('reindex-job-1');
      expect(noteIndexQueue.add).toHaveBeenCalledWith(
        'reindex-workspace',
        { workspaceId: 'ws-1' },
        expect.objectContaining({ jobId: expect.stringContaining('reindex-workspace:ws-1') }),
      );
    });

    it('falls back to generated jobId when queue returns no id', async () => {
      noteIndexQueue.add.mockResolvedValue({ id: undefined });

      const jobId = await service.scheduleWorkspaceReindex('ws-1');

      expect(jobId).toContain('reindex-workspace:ws-1');
    });
  });

  // -------------------------------------------------------------------------
  // enqueueDeliverWebhook
  // -------------------------------------------------------------------------

  describe('enqueueDeliverWebhook', () => {
    it('enqueues a webhook delivery job with correct parameters', async () => {
      webhookDeliveryQueue.add.mockResolvedValue({ id: 'webhook-deliver:del-1' });

      await service.enqueueDeliverWebhook({
        webhookId: 'wh-1',
        deliveryId: 'del-1',
        url: 'https://example.com/hook',
        event: 'note.created',
        body: '{"event":"note.created"}',
        signature: 'sha256=abc',
      });

      expect(webhookDeliveryQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        expect.objectContaining({
          webhookId: 'wh-1',
          deliveryId: 'del-1',
          url: 'https://example.com/hook',
        }),
        expect.objectContaining({
          jobId: 'webhook-deliver:del-1',
          attempts: 3,
          backoff: expect.objectContaining({ type: 'exponential' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getJobStatus
  // -------------------------------------------------------------------------

  describe('getJobStatus', () => {
    it('returns null when job not found in any queue', async () => {
      noteIndexQueue.getJob.mockResolvedValue(null);
      freshnessCheckQueue.getJob.mockResolvedValue(null);
      webhookDeliveryQueue.getJob.mockResolvedValue(null);
      storageRecalculationQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('nonexistent-job');
      expect(result).toBeNull();
    });

    it('returns state and progress for existing job in note index queue', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('active'),
        progress: 42,
      };
      noteIndexQueue.getJob.mockResolvedValue(existingJob);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual({ state: 'active', progress: 42 });
    });

    it('returns state for job in webhook delivery queue', async () => {
      noteIndexQueue.getJob.mockResolvedValue(null);
      freshnessCheckQueue.getJob.mockResolvedValue(null);
      const webhookJob = {
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
      };
      webhookDeliveryQueue.getJob.mockResolvedValue(webhookJob);

      const result = await service.getJobStatus('webhook-deliver:del-1');

      expect(result).toEqual({ state: 'completed', progress: 100 });
    });
  });
});
