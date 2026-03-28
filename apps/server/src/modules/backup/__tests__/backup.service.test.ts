import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { BackupService } from '../backup.service';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
  upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
  getJob: vi.fn().mockResolvedValue(null),
};

const mockPrisma = {
  backupLog: {
    create: vi.fn().mockResolvedValue({ id: 'test-log-id' }),
    update: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  workspace: {
    count: vi.fn().mockResolvedValue(3),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  $queryRaw: vi.fn().mockResolvedValue([{ sum: BigInt(0) }]),
};

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      'backup.enabled': false,
      'backup.localPath': '/tmp/notesaner-test-backups',
      'backup.encryptionKey': crypto.randomBytes(32).toString('hex'),
      'backup.alertEmail': '',
      'backup.pgDumpPath': 'pg_dump',
      'backup.retention.dailyCount': 7,
      'backup.retention.weeklyCount': 4,
      'backup.retention.monthlyCount': 3,
      'backup.s3.endpoint': '',
      'database.url': 'postgresql://user:pass@localhost:5432/notesaner',
      'storage.root': '/tmp/notesaner-test-storage',
    };
    return config[key] ?? defaultValue;
  }),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function createBackupService(): BackupService {
  return new BackupService(mockQueue as never, mockPrisma as never, mockConfigService as never);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createBackupService();
  });

  describe('onModuleInit', () => {
    it('should skip scheduler registration when backup is disabled', async () => {
      await service.onModuleInit();

      expect(mockQueue.upsertJobScheduler).not.toHaveBeenCalled();
    });

    it('should register all schedulers when backup is enabled', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'backup.enabled') return true;
        if (key === 'backup.localPath') return os.tmpdir() + '/backup-test';
        if (key === 'backup.encryptionKey') return crypto.randomBytes(32).toString('hex');
        return defaultValue;
      });

      const enabledService = createBackupService();
      await enabledService.onModuleInit();

      // 5 schedulers: daily, weekly, monthly, retention, verify
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledTimes(5);
    });
  });

  describe('triggerManualBackup', () => {
    it('should enqueue a manual backup job', async () => {
      const jobId = await service.triggerManualBackup('FULL');

      expect(jobId).toBe('test-job-id');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'backup-full',
        expect.objectContaining({
          type: 'FULL',
          category: 'MANUAL',
          triggeredBy: 'manual',
        }),
        expect.objectContaining({
          attempts: 2,
        }),
      );
    });

    it('should enqueue a DATABASE backup', async () => {
      await service.triggerManualBackup('DATABASE');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'backup-full',
        expect.objectContaining({
          type: 'DATABASE',
          category: 'MANUAL',
        }),
        expect.any(Object),
      );
    });

    it('should enqueue a FILESYSTEM backup', async () => {
      await service.triggerManualBackup('FILESYSTEM');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'backup-full',
        expect.objectContaining({
          type: 'FILESYSTEM',
          category: 'MANUAL',
        }),
        expect.any(Object),
      );
    });
  });

  describe('listBackups', () => {
    it('should return paginated backup list with stats', async () => {
      mockPrisma.backupLog.findMany.mockResolvedValue([]);
      mockPrisma.backupLog.count.mockResolvedValue(0);
      mockPrisma.backupLog.findFirst.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([{ sum: BigInt(0) }]);

      const result = await service.listBackups();

      expect(result).toEqual({
        backups: [],
        total: 0,
        stats: {
          totalSizeBytes: '0',
          lastSuccessful: null,
          lastFailed: null,
          dailyCount: 0,
          weeklyCount: 0,
          monthlyCount: 0,
        },
      });
    });

    it('should apply type and status filters', async () => {
      await service.listBackups({
        type: 'FULL',
        status: 'COMPLETED',
        limit: 10,
        offset: 5,
      });

      expect(mockPrisma.backupLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'FULL', status: 'COMPLETED' },
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('getBackup', () => {
    it('should return null when backup not found', async () => {
      mockPrisma.backupLog.findUnique.mockResolvedValue(null);

      const result = await service.getBackup('nonexistent');
      expect(result).toBeNull();
    });

    it('should return formatted DTO when backup exists', async () => {
      const now = new Date();
      mockPrisma.backupLog.findUnique.mockResolvedValue({
        id: 'test-id',
        type: 'FULL',
        status: 'COMPLETED',
        category: 'DAILY',
        filename: 'notesaner-full-2026-03-28.tar.gz.enc',
        destination: 'local:/tmp/backups',
        sizeBytes: BigInt(1024000),
        durationMs: 5000,
        checksum: 'abc123',
        error: null,
        triggeredBy: 'scheduler',
        startedAt: now,
        completedAt: now,
        verifiedAt: null,
        expiresAt: null,
      });

      const result = await service.getBackup('test-id');

      expect(result).toMatchObject({
        id: 'test-id',
        type: 'FULL',
        status: 'COMPLETED',
        sizeBytes: '1024000',
      });
    });
  });

  describe('getJobStatus', () => {
    it('should return null when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('should return job state and progress', async () => {
      mockQueue.getJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('active'),
        progress: 50,
      });

      const result = await service.getJobStatus('test-job');

      expect(result).toEqual({
        state: 'active',
        progress: 50,
      });
    });
  });

  describe('encryptFile / decryptFile', () => {
    let tempDir: string;
    let encKey: string;

    beforeEach(async () => {
      tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backup-enc-test-'));
      encKey = crypto.randomBytes(32).toString('hex');

      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'backup.encryptionKey') return encKey;
        if (key === 'backup.localPath') return tempDir;
        return defaultValue;
      });
    });

    afterEach(async () => {
      await fsp.rm(tempDir, { recursive: true, force: true });
    });

    it('should encrypt and decrypt a file round-trip', async () => {
      const svc = createBackupService();

      // Create test file
      const originalContent =
        'This is sensitive backup data. ' + crypto.randomBytes(256).toString('hex');
      const originalFile = path.join(tempDir, 'original.dat');
      const encryptedFile = path.join(tempDir, 'encrypted.enc');
      const decryptedFile = path.join(tempDir, 'decrypted.dat');

      await fsp.writeFile(originalFile, originalContent);

      // Encrypt
      const checksum = await svc.encryptFile(originalFile, encryptedFile);
      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64); // SHA-256 hex

      // Verify encrypted file is different
      const encryptedContent = await fsp.readFile(encryptedFile);
      expect(encryptedContent.toString()).not.toEqual(originalContent);

      // Decrypt
      await svc.decryptFile(encryptedFile, decryptedFile);

      const decryptedContent = await fsp.readFile(decryptedFile, 'utf-8');
      expect(decryptedContent).toEqual(originalContent);
    });

    it('should produce different ciphertext for the same plaintext (due to random IV)', async () => {
      const svc = createBackupService();

      const content = 'Same content encrypted twice';
      const originalFile = path.join(tempDir, 'same-content.dat');
      const enc1 = path.join(tempDir, 'enc1.enc');
      const enc2 = path.join(tempDir, 'enc2.enc');

      await fsp.writeFile(originalFile, content);

      await svc.encryptFile(originalFile, enc1);
      await svc.encryptFile(originalFile, enc2);

      const buf1 = await fsp.readFile(enc1);
      const buf2 = await fsp.readFile(enc2);

      // IVs should be different, making ciphertext different
      expect(buf1.equals(buf2)).toBe(false);
    });
  });

  describe('verifyBackup', () => {
    it('should return not verified when no backup found', async () => {
      mockPrisma.backupLog.findFirst.mockResolvedValue(null);

      const result = await service.verifyBackup();

      expect(result.verified).toBe(false);
      expect(result.error).toContain('No backup found');
    });
  });
});
