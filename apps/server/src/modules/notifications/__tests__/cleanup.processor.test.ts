import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleanupProcessor } from '../processors/cleanup.processor';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { Job } from 'bullmq';
import type { CleanupJobData } from '../notifications.types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    notification: {
      deleteMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

function createMockJob(data: CleanupJobData): Job<CleanupJobData> {
  return {
    id: 'job-cleanup-1',
    data,
  } as unknown as Job<CleanupJobData>;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    processor = new CleanupProcessor(prisma);
  });

  it('should delete notifications older than the configured max age', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 42 });

    const job = createMockJob({ maxAgeDays: 90 });
    const result = await processor.process(job);

    expect(result.deletedCount).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify the cutoff date is approximately 90 days ago
    const call = (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cutoffDate = call.where.createdAt.lt as Date;
    const _now = new Date();
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);

    // Allow 1 second tolerance
    expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
  });

  it('should return 0 when no old notifications exist', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const job = createMockJob({ maxAgeDays: 90 });
    const result = await processor.process(job);

    expect(result.deletedCount).toBe(0);
  });

  it('should throw on database error', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database connection lost'),
    );

    const job = createMockJob({ maxAgeDays: 90 });

    await expect(processor.process(job)).rejects.toThrow('Database connection lost');
  });

  it('should respect custom max age', async () => {
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 });

    const job = createMockJob({ maxAgeDays: 30 });
    const result = await processor.process(job);

    expect(result.deletedCount).toBe(10);

    const call = (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cutoffDate = call.where.createdAt.lt as Date;
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 30);

    expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
  });
});
