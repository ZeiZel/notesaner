import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupRetentionService } from '../backup-retention.service';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  backupLog: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
};

const mockBackupService = {
  deleteBackup: vi.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      'backup.retention.dailyCount': 7,
      'backup.retention.weeklyCount': 4,
      'backup.retention.monthlyCount': 3,
    };
    return config[key] ?? defaultValue;
  }),
};

function createRetentionService(): BackupRetentionService {
  return new BackupRetentionService(
    mockPrisma as never,
    mockBackupService as never,
    mockConfigService as never,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BackupRetentionService', () => {
  let service: BackupRetentionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createRetentionService();
  });

  describe('enforce', () => {
    it('should return empty result when no backups to clean', async () => {
      mockPrisma.backupLog.findMany.mockResolvedValue([]);

      await service.enforce();

      expect(result.deleted).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('should delete expired backups', async () => {
      const expiredBackup = {
        id: 'expired-1',
        filename: 'old-backup.tar.gz.enc',
        destination: 'local:/tmp/backups',
        category: 'DAILY',
        sizeBytes: BigInt(1024),
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
        status: 'COMPLETED',
      };

      // First call: expired backups
      mockPrisma.backupLog.findMany
        .mockResolvedValueOnce([expiredBackup]) // Pass 1: expired
        .mockResolvedValueOnce([]) // Pass 2: DAILY category
        .mockResolvedValueOnce([]) // Pass 2: WEEKLY category
        .mockResolvedValueOnce([]) // Pass 2: MONTHLY category
        .mockResolvedValueOnce([]); // Pass 3: failed backups

      await service.enforce();

      expect(result.details).toHaveLength(1);
      expect(result.details[0]).toMatchObject({
        id: 'expired-1',
        filename: 'old-backup.tar.gz.enc',
        reason: expect.stringContaining('Expired'),
      });
      expect(mockBackupService.deleteBackup).toHaveBeenCalledWith(
        'local:/tmp/backups',
        'old-backup.tar.gz.enc',
      );
    });

    it('should enforce count-based retention', async () => {
      const now = Date.now();
      const dailyBackups = Array.from({ length: 10 }, (_, i) => ({
        id: `daily-${i}`,
        filename: `backup-daily-${i}.tar.gz.enc`,
        destination: 'local:/tmp/backups',
        category: 'DAILY',
        sizeBytes: BigInt(1024),
        status: 'COMPLETED',
        startedAt: new Date(now - i * 86400000),
      }));

      // First call: no expired backups
      // Second call: 10 daily backups (retention = 7, so 3 should be deleted)
      mockPrisma.backupLog.findMany
        .mockResolvedValueOnce([]) // Pass 1: no expired
        .mockResolvedValueOnce(dailyBackups) // Pass 2: DAILY
        .mockResolvedValueOnce([]) // Pass 2: WEEKLY
        .mockResolvedValueOnce([]) // Pass 2: MONTHLY
        .mockResolvedValueOnce([]); // Pass 3: no failed

      await service.enforce();

      // 3 backups should be scheduled for deletion (10 - 7 = 3)
      expect(result.details).toHaveLength(3);
      expect(mockBackupService.deleteBackup).toHaveBeenCalledTimes(3);
    });

    it('should not delete manual backups', async () => {
      mockPrisma.backupLog.findMany.mockResolvedValue([]);

      await service.enforce();

      // Manual category is never queried for count-based retention
      const findManyCalls = mockPrisma.backupLog.findMany.mock.calls;
      for (const call of findManyCalls) {
        const where = call[0]?.where;
        if (where?.category) {
          expect(where.category).not.toBe('MANUAL');
        }
      }
    });

    it('should perform dry run without deleting', async () => {
      const expiredBackup = {
        id: 'expired-dry',
        filename: 'dry-run.tar.gz.enc',
        destination: 'local:/tmp/backups',
        category: 'DAILY',
        sizeBytes: BigInt(2048),
        expiresAt: new Date(Date.now() - 86400000),
        status: 'COMPLETED',
      };

      mockPrisma.backupLog.findMany
        .mockResolvedValueOnce([expiredBackup])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.enforce(true);

      expect(result.deleted).toBe(0); // dry run = 0 actual deletions
      expect(result.details).toHaveLength(1); // but still reports what would be deleted
      expect(mockBackupService.deleteBackup).not.toHaveBeenCalled();
    });

    it('should clean up old failed backups', async () => {
      const oldFailedBackup = {
        id: 'failed-old',
        filename: 'failed.tar.gz.enc',
        destination: 'local:/tmp/backups',
        category: 'DAILY',
        sizeBytes: BigInt(0),
        status: 'FAILED',
        startedAt: new Date(Date.now() - 10 * 86400000), // 10 days ago
      };

      mockPrisma.backupLog.findMany
        .mockResolvedValueOnce([]) // Pass 1: no expired
        .mockResolvedValueOnce([]) // Pass 2: DAILY
        .mockResolvedValueOnce([]) // Pass 2: WEEKLY
        .mockResolvedValueOnce([]) // Pass 2: MONTHLY
        .mockResolvedValueOnce([oldFailedBackup]); // Pass 3: failed

      await service.enforce();

      expect(result.details).toHaveLength(1);
      expect(result.details[0]).toMatchObject({
        id: 'failed-old',
        reason: expect.stringContaining('Failed backup'),
      });
    });
  });
});
