import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { StorageQuotaService } from '../storage-quota.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-quota-test';

const DEFAULT_MAX_STORAGE_BYTES = BigInt(5 * 1024 * 1024 * 1024); // 5 GB
const DEFAULT_MAX_NOTES = 50_000;
const DEFAULT_MAX_FILE_SIZE_BYTES = BigInt(50 * 1024 * 1024); // 50 MB
const DEFAULT_WARNING_THRESHOLD = 80;

function makeConfigService(): ConfigService {
  return {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'quota.maxStorageBytes':
          return DEFAULT_MAX_STORAGE_BYTES;
        case 'quota.maxNotes':
          return DEFAULT_MAX_NOTES;
        case 'quota.maxFileSizeBytes':
          return DEFAULT_MAX_FILE_SIZE_BYTES;
        case 'quota.warningThresholdPercent':
          return DEFAULT_WARNING_THRESHOLD;
        default:
          return undefined;
      }
    }),
  } as unknown as ConfigService;
}

function makeStatsRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stats-uuid-1',
    workspaceId: WORKSPACE_ID,
    totalStorageBytes: 0n,
    noteCount: 0,
    attachmentCount: 0,
    versionCount: 0,
    maxStorageBytes: null,
    maxNotes: null,
    maxFileSizeBytes: null,
    lastRecalculatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrismaService() {
  return {
    workspaceStorageStats: {
      upsert: vi.fn().mockResolvedValue(makeStatsRecord()),
      update: vi.fn().mockResolvedValue(makeStatsRecord()),
      findUnique: vi.fn().mockResolvedValue(makeStatsRecord()),
    },
    workspace: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    note: {
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 }, _sum: { wordCount: 0 } }),
    },
    attachment: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { id: 0 },
        _sum: { size: 0 },
      }),
    },
    noteVersion: {
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function makeService(prisma?: ReturnType<typeof makePrismaService>, config?: ConfigService) {
  const prismaService = prisma ?? makePrismaService();
  const configService = config ?? makeConfigService();
  const service = new StorageQuotaService(prismaService as never, configService);
  return { service, prismaService, configService };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('StorageQuotaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── resolveQuotaLimits ────────────────────────────────────────────────────

  describe('resolveQuotaLimits', () => {
    it('returns system defaults when no workspace overrides exist', () => {
      const { service } = makeService();
      const limits = service.resolveQuotaLimits({
        maxStorageBytes: null,
        maxNotes: null,
        maxFileSizeBytes: null,
      });

      expect(limits.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
      expect(limits.maxNotes).toBe(DEFAULT_MAX_NOTES);
      expect(limits.maxFileSizeBytes).toBe(DEFAULT_MAX_FILE_SIZE_BYTES);
      expect(limits.warningThresholdPercent).toBe(DEFAULT_WARNING_THRESHOLD);
    });

    it('uses workspace overrides when present', () => {
      const { service } = makeService();
      const customMaxStorage = BigInt(10 * 1024 * 1024 * 1024); // 10 GB
      const customMaxNotes = 100_000;
      const customMaxFileSize = BigInt(100 * 1024 * 1024); // 100 MB

      const limits = service.resolveQuotaLimits({
        maxStorageBytes: customMaxStorage,
        maxNotes: customMaxNotes,
        maxFileSizeBytes: customMaxFileSize,
      });

      expect(limits.maxStorageBytes).toBe(customMaxStorage);
      expect(limits.maxNotes).toBe(customMaxNotes);
      expect(limits.maxFileSizeBytes).toBe(customMaxFileSize);
    });

    it('mixes workspace overrides and system defaults', () => {
      const { service } = makeService();
      const customMaxNotes = 75_000;

      const limits = service.resolveQuotaLimits({
        maxStorageBytes: null, // use default
        maxNotes: customMaxNotes, // override
        maxFileSizeBytes: null, // use default
      });

      expect(limits.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
      expect(limits.maxNotes).toBe(customMaxNotes);
      expect(limits.maxFileSizeBytes).toBe(DEFAULT_MAX_FILE_SIZE_BYTES);
    });
  });

  // ─── getStorageStats ──────────────────────────────────────────────────────

  describe('getStorageStats', () => {
    it('returns storage stats with zero usage for new workspace', async () => {
      const { service } = makeService();
      const result = await service.getStorageStats(WORKSPACE_ID);

      expect(result.workspaceId).toBe(WORKSPACE_ID);
      expect(result.used.totalStorageBytes).toBe('0');
      expect(result.used.noteCount).toBe(0);
      expect(result.used.attachmentCount).toBe(0);
      expect(result.used.versionCount).toBe(0);
      expect(result.limits.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES.toString());
      expect(result.limits.maxNotes).toBe(DEFAULT_MAX_NOTES);
      expect(result.quota.storageUsedPercent).toBe(0);
      expect(result.quota.noteUsedPercent).toBe(0);
      expect(result.quota.isStorageWarning).toBe(false);
      expect(result.quota.isNoteWarning).toBe(false);
      expect(result.quota.isStorageExceeded).toBe(false);
      expect(result.quota.isNoteExceeded).toBe(false);
    });

    it('calculates correct percentages for partial usage', async () => {
      const prisma = makePrismaService();
      // 50% storage usage
      const halfStorageBytes = DEFAULT_MAX_STORAGE_BYTES / 2n;
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({
          totalStorageBytes: halfStorageBytes,
          noteCount: 25_000,
        }),
      );

      const { service } = makeService(prisma);
      const result = await service.getStorageStats(WORKSPACE_ID);

      expect(result.quota.storageUsedPercent).toBe(50);
      expect(result.quota.noteUsedPercent).toBe(50);
      expect(result.quota.isStorageWarning).toBe(false);
      expect(result.quota.isNoteWarning).toBe(false);
    });

    it('flags warning when storage exceeds 80%', async () => {
      const prisma = makePrismaService();
      // 85% storage usage
      const storageBytes = (DEFAULT_MAX_STORAGE_BYTES * 85n) / 100n;
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({
          totalStorageBytes: storageBytes,
          noteCount: 42_000, // 84%
        }),
      );

      const { service } = makeService(prisma);
      const result = await service.getStorageStats(WORKSPACE_ID);

      expect(result.quota.isStorageWarning).toBe(true);
      expect(result.quota.isNoteWarning).toBe(true);
      expect(result.quota.isStorageExceeded).toBe(false);
      expect(result.quota.isNoteExceeded).toBe(false);
    });

    it('flags exceeded when storage is at or above limit', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({
          totalStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
          noteCount: DEFAULT_MAX_NOTES,
        }),
      );

      const { service } = makeService(prisma);
      const result = await service.getStorageStats(WORKSPACE_ID);

      expect(result.quota.isStorageExceeded).toBe(true);
      expect(result.quota.isNoteExceeded).toBe(true);
    });

    it('serializes BigInt values as strings', async () => {
      const { service } = makeService();
      const result = await service.getStorageStats(WORKSPACE_ID);

      expect(typeof result.used.totalStorageBytes).toBe('string');
      expect(typeof result.limits.maxStorageBytes).toBe('string');
      expect(typeof result.limits.maxFileSizeBytes).toBe('string');
    });
  });

  // ─── checkStorageQuota ────────────────────────────────────────────────────

  describe('checkStorageQuota', () => {
    it('returns true when under quota', async () => {
      const { service } = makeService();
      const result = await service.checkStorageQuota(WORKSPACE_ID);
      expect(result).toBe(true);
    });

    it('returns false when at quota', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ totalStorageBytes: DEFAULT_MAX_STORAGE_BYTES }),
      );

      const { service } = makeService(prisma);
      const result = await service.checkStorageQuota(WORKSPACE_ID);
      expect(result).toBe(false);
    });

    it('accounts for additional bytes in the check', async () => {
      const prisma = makePrismaService();
      // 2 bytes below the limit
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ totalStorageBytes: DEFAULT_MAX_STORAGE_BYTES - 2n }),
      );

      const { service } = makeService(prisma);
      // Adding 1 more byte: (limit - 2) + 1 = limit - 1, which is < limit
      expect(await service.checkStorageQuota(WORKSPACE_ID, 1n)).toBe(true);
      // Adding 2 more bytes: (limit - 2) + 2 = limit, which is NOT < limit
      expect(await service.checkStorageQuota(WORKSPACE_ID, 2n)).toBe(false);
    });
  });

  // ─── checkNoteQuota ───────────────────────────────────────────────────────

  describe('checkNoteQuota', () => {
    it('returns true when under note limit', async () => {
      const { service } = makeService();
      expect(await service.checkNoteQuota(WORKSPACE_ID)).toBe(true);
    });

    it('returns false when at note limit', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ noteCount: DEFAULT_MAX_NOTES }),
      );

      const { service } = makeService(prisma);
      expect(await service.checkNoteQuota(WORKSPACE_ID)).toBe(false);
    });
  });

  // ─── checkFileSizeLimit ───────────────────────────────────────────────────

  describe('checkFileSizeLimit', () => {
    it('returns true when file size is within limit', async () => {
      const { service } = makeService();
      expect(await service.checkFileSizeLimit(WORKSPACE_ID, BigInt(10 * 1024 * 1024))).toBe(true);
    });

    it('returns true when file size equals limit', async () => {
      const { service } = makeService();
      expect(await service.checkFileSizeLimit(WORKSPACE_ID, DEFAULT_MAX_FILE_SIZE_BYTES)).toBe(
        true,
      );
    });

    it('returns false when file size exceeds limit', async () => {
      const { service } = makeService();
      expect(await service.checkFileSizeLimit(WORKSPACE_ID, DEFAULT_MAX_FILE_SIZE_BYTES + 1n)).toBe(
        false,
      );
    });

    it('respects workspace-specific file size override', async () => {
      const prisma = makePrismaService();
      const customLimit = BigInt(100 * 1024 * 1024); // 100 MB
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ maxFileSizeBytes: customLimit }),
      );

      const { service } = makeService(prisma);
      // 75 MB should pass with 100 MB limit
      expect(await service.checkFileSizeLimit(WORKSPACE_ID, BigInt(75 * 1024 * 1024))).toBe(true);
      // 101 MB should fail
      expect(await service.checkFileSizeLimit(WORKSPACE_ID, BigInt(101 * 1024 * 1024))).toBe(false);
    });
  });

  // ─── isStorageWarning ─────────────────────────────────────────────────────

  describe('isStorageWarning', () => {
    it('returns false when under 80% threshold', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ totalStorageBytes: (DEFAULT_MAX_STORAGE_BYTES * 79n) / 100n }),
      );

      const { service } = makeService(prisma);
      expect(await service.isStorageWarning(WORKSPACE_ID)).toBe(false);
    });

    it('returns true when at exactly 80% threshold', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.upsert.mockResolvedValue(
        makeStatsRecord({ totalStorageBytes: (DEFAULT_MAX_STORAGE_BYTES * 80n) / 100n }),
      );

      const { service } = makeService(prisma);
      expect(await service.isStorageWarning(WORKSPACE_ID)).toBe(true);
    });
  });

  // ─── Incremental updates ──────────────────────────────────────────────────

  describe('onNoteCreated', () => {
    it('increments note count and storage bytes', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      await service.onNoteCreated(WORKSPACE_ID, 5000);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          noteCount: { increment: 1 },
          totalStorageBytes: { increment: 5000 },
        },
      });
    });
  });

  describe('onNoteDeleted', () => {
    it('decrements note count and storage bytes', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.findUnique.mockResolvedValue(
        makeStatsRecord({ noteCount: 10, totalStorageBytes: 50000n }),
      );
      const { service } = makeService(prisma);

      await service.onNoteDeleted(WORKSPACE_ID, 5000);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          noteCount: { decrement: 1 },
          totalStorageBytes: { decrement: 5000 },
        },
      });
    });

    it('does not decrement below zero', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.findUnique.mockResolvedValue(
        makeStatsRecord({ noteCount: 0, totalStorageBytes: 100n }),
      );
      const { service } = makeService(prisma);

      await service.onNoteDeleted(WORKSPACE_ID, 200);

      // Should clamp to current totalStorageBytes
      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          noteCount: { decrement: 0 },
          totalStorageBytes: { decrement: 100n },
        },
      });
    });
  });

  describe('onAttachmentCreated', () => {
    it('increments attachment count and storage bytes', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      await service.onAttachmentCreated(WORKSPACE_ID, 1_000_000);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          attachmentCount: { increment: 1 },
          totalStorageBytes: { increment: 1_000_000 },
        },
      });
    });
  });

  describe('onAttachmentDeleted', () => {
    it('decrements attachment count and storage bytes', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.findUnique.mockResolvedValue(
        makeStatsRecord({ attachmentCount: 5, totalStorageBytes: 5_000_000n }),
      );
      const { service } = makeService(prisma);

      await service.onAttachmentDeleted(WORKSPACE_ID, 1_000_000);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          attachmentCount: { decrement: 1 },
          totalStorageBytes: { decrement: 1_000_000 },
        },
      });
    });
  });

  describe('onVersionCreated', () => {
    it('increments version count and storage bytes', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      await service.onVersionCreated(WORKSPACE_ID, 3000);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          versionCount: { increment: 1 },
          totalStorageBytes: { increment: 3000 },
        },
      });
    });
  });

  describe('onNoteUpdated', () => {
    it('increments storage for positive delta', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      await service.onNoteUpdated(WORKSPACE_ID, 500);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: { totalStorageBytes: { increment: 500 } },
      });
    });

    it('decrements storage for negative delta', async () => {
      const prisma = makePrismaService();
      prisma.workspaceStorageStats.findUnique.mockResolvedValue(
        makeStatsRecord({ totalStorageBytes: 1000n }),
      );
      const { service } = makeService(prisma);

      await service.onNoteUpdated(WORKSPACE_ID, -300);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: { totalStorageBytes: { decrement: 300 } },
      });
    });

    it('does nothing for zero delta', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      await service.onNoteUpdated(WORKSPACE_ID, 0);

      expect(prisma.workspaceStorageStats.update).not.toHaveBeenCalled();
    });
  });

  // ─── recalculate ──────────────────────────────────────────────────────────

  describe('recalculate', () => {
    it('aggregates data from notes, attachments, and versions', async () => {
      const prisma = makePrismaService();

      // 10 notes, total 5000 words
      prisma.note.aggregate
        .mockResolvedValueOnce({ _count: { id: 10 } })
        .mockResolvedValueOnce({ _sum: { wordCount: 5000 } });

      // 5 attachments, 1MB total
      prisma.attachment.aggregate.mockResolvedValue({
        _count: { id: 5 },
        _sum: { size: 1_000_000 },
      });

      // 20 versions
      prisma.noteVersion.aggregate.mockResolvedValue({ _count: { id: 20 } });

      // Version content
      prisma.noteVersion.findMany.mockResolvedValue([
        { content: 'version content 1' },
        { content: 'version content 2' },
      ]);

      const { service } = makeService(prisma);
      await service.recalculate(WORKSPACE_ID);

      expect(prisma.workspaceStorageStats.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID },
          create: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            noteCount: 10,
            attachmentCount: 5,
            versionCount: 20,
          }),
          update: expect.objectContaining({
            noteCount: 10,
            attachmentCount: 5,
            versionCount: 20,
          }),
        }),
      );
    });
  });

  // ─── recalculateAll ───────────────────────────────────────────────────────

  describe('recalculateAll', () => {
    it('processes all workspaces and reports results', async () => {
      const prisma = makePrismaService();
      prisma.workspace.findMany.mockResolvedValue([{ id: 'ws-1' }, { id: 'ws-2' }, { id: 'ws-3' }]);

      // Mock aggregates for each workspace recalculation
      prisma.note.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { wordCount: 0 } });
      prisma.attachment.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { size: 0 } });
      prisma.noteVersion.aggregate.mockResolvedValue({ _count: { id: 0 } });
      prisma.noteVersion.findMany.mockResolvedValue([]);

      const { service } = makeService(prisma);
      const result = await service.recalculateAll();

      expect(result.workspacesProcessed).toBe(3);
      expect(result.errors).toBe(0);
    });

    it('reports errors but continues processing remaining workspaces', async () => {
      const prisma = makePrismaService();
      prisma.workspace.findMany.mockResolvedValue([{ id: 'ws-1' }, { id: 'ws-2' }]);

      // First workspace succeeds
      prisma.note.aggregate
        .mockResolvedValueOnce({ _count: { id: 0 }, _sum: { wordCount: 0 } })
        .mockResolvedValueOnce({ _sum: { wordCount: 0 } })
        // Second workspace fails
        .mockRejectedValueOnce(new Error('DB timeout'));

      prisma.attachment.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { size: 0 } });
      prisma.noteVersion.aggregate.mockResolvedValue({ _count: { id: 0 } });
      prisma.noteVersion.findMany.mockResolvedValue([]);

      const { service } = makeService(prisma);
      const result = await service.recalculateAll();

      expect(result.workspacesProcessed).toBe(2);
      expect(result.errors).toBe(1);
    });
  });

  // ─── setWorkspaceLimits ───────────────────────────────────────────────────

  describe('setWorkspaceLimits', () => {
    it('updates per-workspace limit overrides', async () => {
      const prisma = makePrismaService();
      const { service } = makeService(prisma);

      const overrides = {
        maxStorageBytes: BigInt(10 * 1024 * 1024 * 1024),
        maxNotes: 100_000,
        maxFileSizeBytes: BigInt(100 * 1024 * 1024),
      };

      await service.setWorkspaceLimits(WORKSPACE_ID, overrides);

      expect(prisma.workspaceStorageStats.update).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID },
        data: {
          maxStorageBytes: overrides.maxStorageBytes,
          maxNotes: overrides.maxNotes,
          maxFileSizeBytes: overrides.maxFileSizeBytes,
        },
      });
    });
  });
});
