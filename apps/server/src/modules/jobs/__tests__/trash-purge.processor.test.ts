/**
 * Unit tests for TrashPurgeProcessor
 *
 * Coverage:
 *   - Runs purge with default retention when no override is specified
 *   - Passes custom retentionDays from job data to TrashService
 *   - Handles unknown job names gracefully (returns zeroed result)
 *   - Does NOT rethrow purge errors — job must not fail & retry infinitely
 *   - Reports 100% progress after processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import { TrashPurgeProcessor } from '../processors/trash-purge.processor';
import { TRASH_PURGE_JOB, TRASH_PURGE_QUEUE } from '../jobs.constants';
import { TRASH_RETENTION_DAYS } from '../../notes/trash.service';
import type { TrashService } from '../../notes/trash.service';
import type { TrashPurgeJobData } from '../jobs.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(data: TrashPurgeJobData, name = TRASH_PURGE_JOB): Job<TrashPurgeJobData> {
  return {
    id: 'job-trash-1',
    name,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<TrashPurgeJobData>;
}

function buildProcessor() {
  const trashService = {
    purgeExpired: vi.fn().mockResolvedValue(0),
  } as unknown as TrashService;

  const processor = new TrashPurgeProcessor(trashService);
  return { processor, trashService };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrashPurgeProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls purgeExpired with default retention when job has no retentionDays', async () => {
    const { processor, trashService } = buildProcessor();
    const job = makeJob({});

    const result = await processor.process(job);

    expect(trashService.purgeExpired).toHaveBeenCalledWith(TRASH_RETENTION_DAYS);
    expect(result.retentionDays).toBe(TRASH_RETENTION_DAYS);
  });

  it('passes custom retentionDays to purgeExpired', async () => {
    const { processor, trashService } = buildProcessor();
    const job = makeJob({ retentionDays: 7 });

    await processor.process(job);

    expect(trashService.purgeExpired).toHaveBeenCalledWith(7);
  });

  it('returns purgedCount from TrashService', async () => {
    const { processor, trashService } = buildProcessor();
    (trashService.purgeExpired as ReturnType<typeof vi.fn>).mockResolvedValue(42);

    const result = await processor.process(makeJob({}));

    expect(result.purgedCount).toBe(42);
  });

  it('returns zero purgedCount and does not throw when TrashService throws', async () => {
    const { processor, trashService } = buildProcessor();
    (trashService.purgeExpired as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('database unavailable'),
    );

    const result = await processor.process(makeJob({}));

    expect(result.purgedCount).toBe(0);
  });

  it('reports 100% progress after processing', async () => {
    const { processor } = buildProcessor();
    const job = makeJob({});

    await processor.process(job);

    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('handles unknown job names without calling purgeExpired', async () => {
    const { processor, trashService } = buildProcessor();
    const job = makeJob({}, 'unknown-job');

    const result = await processor.process(job);

    expect(trashService.purgeExpired).not.toHaveBeenCalled();
    expect(result.purgedCount).toBe(0);
    expect(result.durationMs).toBe(0);
  });

  it('includes durationMs in result', async () => {
    const { processor } = buildProcessor();

    const result = await processor.process(makeJob({}));

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('uses correct queue name constant', () => {
    expect(TRASH_PURGE_QUEUE).toBe('trash-purge');
    expect(TRASH_PURGE_JOB).toBe('trash-daily-purge');
  });
});
