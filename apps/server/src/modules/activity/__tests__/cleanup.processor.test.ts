import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityCleanupProcessor } from '../processors/cleanup.processor';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { Job } from 'bullmq';
import type { ActivityCleanupJobData } from '../activity.types';

function createMockPrisma() {
  return {
    activityLog: {
      deleteMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe('ActivityCleanupProcessor', () => {
  let processor: ActivityCleanupProcessor;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    processor = new ActivityCleanupProcessor(prisma as unknown as PrismaService);
  });

  it('should delete activity logs older than maxAgeDays', async () => {
    (prisma.activityLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 42 });

    const job = { data: { maxAgeDays: 90 } } as Job<ActivityCleanupJobData>;

    const result = await processor.process(job);

    expect(result.deletedCount).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(prisma.activityLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
      },
    });
  });

  it('should use correct cutoff date', async () => {
    (prisma.activityLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const now = Date.now();
    const job = { data: { maxAgeDays: 90 } } as Job<ActivityCleanupJobData>;

    await processor.process(job);

    const call = (prisma.activityLog.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      where: { createdAt: { lt: Date } };
    };
    const cutoff = call.where.createdAt.lt;
    const expectedCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);

    // Allow 5 seconds of tolerance for test execution time
    expect(Math.abs(cutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(5000);
  });

  it('should re-throw on database error', async () => {
    (prisma.activityLog.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB down'),
    );

    const job = { data: { maxAgeDays: 90 } } as Job<ActivityCleanupJobData>;

    await expect(processor.process(job)).rejects.toThrow('DB down');
  });
});
