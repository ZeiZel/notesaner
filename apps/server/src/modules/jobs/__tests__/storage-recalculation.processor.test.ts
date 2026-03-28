import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageRecalculationProcessor } from '../processors/storage-recalculation.processor';
import { STORAGE_RECALCULATION_JOB } from '../jobs.constants';
import type { Job } from 'bullmq';
import type { StorageRecalculationJobData } from '../jobs.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStorageQuotaService() {
  return {
    recalculate: vi.fn().mockResolvedValue(undefined),
    recalculateAll: vi.fn().mockResolvedValue({ workspacesProcessed: 3, errors: 0 }),
  };
}

function makeJob(data: StorageRecalculationJobData): Job<StorageRecalculationJobData> {
  return {
    id: 'test-job-id',
    name: STORAGE_RECALCULATION_JOB,
    data,
    updateProgress: vi.fn(),
  } as unknown as Job<StorageRecalculationJobData>;
}

function makeProcessor(storageService?: ReturnType<typeof makeStorageQuotaService>) {
  const service = storageService ?? makeStorageQuotaService();
  const processor = new StorageRecalculationProcessor(service as never);
  return { processor, storageService: service };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('StorageRecalculationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for unknown job names', async () => {
    const { processor } = makeProcessor();
    const job = {
      name: 'unknown-job',
      data: {},
      updateProgress: vi.fn(),
    } as unknown as Job<StorageRecalculationJobData>;

    await expect(processor.process(job)).rejects.toThrow('Unknown job name: unknown-job');
  });

  describe('single workspace recalculation', () => {
    it('recalculates a specific workspace', async () => {
      const storageService = makeStorageQuotaService();
      const { processor } = makeProcessor(storageService);

      const job = makeJob({ workspaceId: 'ws-1' });
      const result = await processor.process(job);

      expect(storageService.recalculate).toHaveBeenCalledWith('ws-1');
      expect(result.workspacesProcessed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('reports error when recalculation fails for a specific workspace', async () => {
      const storageService = makeStorageQuotaService();
      storageService.recalculate.mockRejectedValue(new Error('DB error'));
      const { processor } = makeProcessor(storageService);

      const job = makeJob({ workspaceId: 'ws-failing' });
      const result = await processor.process(job);

      expect(result.workspacesProcessed).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  describe('all workspaces recalculation', () => {
    it('recalculates all workspaces', async () => {
      const storageService = makeStorageQuotaService();
      storageService.recalculateAll.mockResolvedValue({
        workspacesProcessed: 5,
        errors: 0,
      });
      const { processor } = makeProcessor(storageService);

      const job = makeJob({});
      const result = await processor.process(job);

      expect(storageService.recalculateAll).toHaveBeenCalled();
      expect(result.workspacesProcessed).toBe(5);
      expect(result.errors).toBe(0);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('passes through error count from recalculateAll', async () => {
      const storageService = makeStorageQuotaService();
      storageService.recalculateAll.mockResolvedValue({
        workspacesProcessed: 10,
        errors: 2,
      });
      const { processor } = makeProcessor(storageService);

      const job = makeJob({});
      const result = await processor.process(job);

      expect(result.workspacesProcessed).toBe(10);
      expect(result.errors).toBe(2);
    });
  });
});
