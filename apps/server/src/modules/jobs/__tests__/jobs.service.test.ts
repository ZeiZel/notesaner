import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobsService } from '../jobs.service';

// ---------------------------------------------------------------------------
// BullMQ Queue mock
// ---------------------------------------------------------------------------
const mockJob = {
  id: 'job-123',
  getState: vi.fn(),
  remove: vi.fn(),
};

const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
};

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobsService(mockQueue as never);
  });

  // -------------------------------------------------------------------------
  // scheduleNoteIndex
  // -------------------------------------------------------------------------

  describe('scheduleNoteIndex', () => {
    it('adds a delayed job with the correct jobId', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'job-abc' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(mockQueue.add).toHaveBeenCalledWith(
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
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockQueue.add.mockResolvedValue({ id: 'job-new' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(mockJob.remove).toHaveBeenCalledOnce();
      expect(mockQueue.add).toHaveBeenCalledOnce();
    });

    it('does not remove active jobs during debounce', async () => {
      mockJob.getState.mockResolvedValue('active');
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockQueue.add.mockResolvedValue({ id: 'job-new' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      // Active job should not be removed
      expect(mockJob.remove).not.toHaveBeenCalled();
      // But a new job should still be added
      expect(mockQueue.add).toHaveBeenCalledOnce();
    });

    it('includes retry configuration', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'job-abc' });

      await service.scheduleNoteIndex('note-1', 'ws-1', '/vault/note.md');

      expect(mockQueue.add).toHaveBeenCalledWith(
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
      mockQueue.add.mockResolvedValue({ id: 'reindex-job-1' });

      const jobId = await service.scheduleWorkspaceReindex('ws-1');

      expect(jobId).toBe('reindex-job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'reindex-workspace',
        { workspaceId: 'ws-1' },
        expect.objectContaining({ jobId: expect.stringContaining('reindex-workspace:ws-1') }),
      );
    });

    it('falls back to generated jobId when queue returns no id', async () => {
      mockQueue.add.mockResolvedValue({ id: undefined });

      const jobId = await service.scheduleWorkspaceReindex('ws-1');

      expect(jobId).toContain('reindex-workspace:ws-1');
    });
  });

  // -------------------------------------------------------------------------
  // getJobStatus
  // -------------------------------------------------------------------------

  describe('getJobStatus', () => {
    it('returns null when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      const result = await service.getJobStatus('nonexistent-job');
      expect(result).toBeNull();
    });

    it('returns state and progress for existing job', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('active'),
        progress: 42,
      };
      mockQueue.getJob.mockResolvedValue(existingJob);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual({ state: 'active', progress: 42 });
    });
  });
});
