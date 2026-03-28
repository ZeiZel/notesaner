import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupProcessor } from '../backup.processor';
import type { BackupJobData, BackupRetentionJobData, BackupVerifyJobData } from '../backup.types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockBackupService = {
  executeBackup: vi.fn().mockResolvedValue({
    backupLogId: 'log-1',
    type: 'FULL',
    category: 'DAILY',
    filename: 'backup.tar.gz.enc',
    destination: 'local:/tmp',
    sizeBytes: 1024,
    durationMs: 5000,
    checksum: 'abc123',
  }),
  verifyBackup: vi.fn().mockResolvedValue({
    backupLogId: 'log-1',
    verified: true,
    durationMs: 3000,
  }),
};

const mockRetentionService = {
  enforce: vi.fn().mockResolvedValue({
    deleted: 2,
    freedBytes: 2048,
    durationMs: 1000,
    details: [],
  }),
};

const mockEmailService = {
  send: vi.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      'backup.alertEmail': 'admin@example.com',
      frontendUrl: 'http://localhost:3000',
    };
    return config[key] ?? defaultValue;
  }),
};

function createJob(name: string, data: unknown) {
  return {
    name,
    id: `test-job-${Date.now()}`,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  } as never;
}

function createProcessor(): BackupProcessor {
  return new BackupProcessor(
    mockBackupService as never,
    mockRetentionService as never,
    mockEmailService as never,
    mockConfigService as never,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BackupProcessor', () => {
  let processor: BackupProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = createProcessor();
  });

  describe('backup jobs', () => {
    it('should process a full backup job', async () => {
      const data: BackupJobData = {
        type: 'FULL',
        category: 'DAILY',
        triggeredBy: 'scheduler',
      };

      const result = await processor.process(createJob('backup-full', data));

      expect(mockBackupService.executeBackup).toHaveBeenCalledWith('FULL', 'DAILY', 'scheduler');
      expect(result).toMatchObject({
        backupLogId: 'log-1',
        type: 'FULL',
      });
    });

    it('should process a database-only backup job', async () => {
      const data: BackupJobData = {
        type: 'DATABASE',
        category: 'MANUAL',
        triggeredBy: 'manual',
      };

      await processor.process(createJob('backup-database', data));

      expect(mockBackupService.executeBackup).toHaveBeenCalledWith('DATABASE', 'MANUAL', 'manual');
    });

    it('should process a filesystem-only backup job', async () => {
      const data: BackupJobData = {
        type: 'FILESYSTEM',
        category: 'WEEKLY',
        triggeredBy: 'scheduler',
      };

      await processor.process(createJob('backup-filesystem', data));

      expect(mockBackupService.executeBackup).toHaveBeenCalledWith(
        'FILESYSTEM',
        'WEEKLY',
        'scheduler',
      );
    });
  });

  describe('retention job', () => {
    it('should process a retention cleanup job', async () => {
      const data: BackupRetentionJobData = { dryRun: false };

      const result = await processor.process(createJob('backup-retention', data));

      expect(mockRetentionService.enforce).toHaveBeenCalledWith(false);
      expect(result).toMatchObject({ deleted: 2 });
    });

    it('should support dry run mode', async () => {
      const data: BackupRetentionJobData = { dryRun: true };

      await processor.process(createJob('backup-retention', data));

      expect(mockRetentionService.enforce).toHaveBeenCalledWith(true);
    });
  });

  describe('verify job', () => {
    it('should process a verification job', async () => {
      const data: BackupVerifyJobData = {};

      const result = await processor.process(createJob('backup-verify', data));

      expect(mockBackupService.verifyBackup).toHaveBeenCalledWith(undefined);
      expect(result).toMatchObject({ verified: true });
    });

    it('should verify a specific backup by ID', async () => {
      const data: BackupVerifyJobData = { backupId: 'specific-id' };

      await processor.process(createJob('backup-verify', data));

      expect(mockBackupService.verifyBackup).toHaveBeenCalledWith('specific-id');
    });

    it('should send alert when verification fails', async () => {
      mockBackupService.verifyBackup.mockResolvedValueOnce({
        backupLogId: 'log-1',
        verified: false,
        durationMs: 1000,
        error: 'Checksum mismatch',
      });

      await processor.process(createJob('backup-verify', {}));

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          template: 'backup-failure',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should send failure alert on backup error', async () => {
      mockBackupService.executeBackup.mockRejectedValueOnce(new Error('pg_dump not found'));

      await expect(
        processor.process(
          createJob('backup-full', {
            type: 'FULL',
            category: 'DAILY',
            triggeredBy: 'scheduler',
          }),
        ),
      ).rejects.toThrow('pg_dump not found');

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          template: 'backup-failure',
          variables: expect.objectContaining({
            jobName: 'backup-full',
            errorMessage: 'pg_dump not found',
          }),
        }),
      );
    });

    it('should throw on unknown job name', async () => {
      await expect(processor.process(createJob('unknown-job', {}))).rejects.toThrow(
        'Unknown backup job name',
      );
    });

    it('should not fail if alert email is not configured', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'backup.alertEmail') return '';
        return defaultValue;
      });

      mockBackupService.executeBackup.mockRejectedValueOnce(new Error('test error'));

      const proc = createProcessor();

      await expect(
        proc.process(
          createJob('backup-full', {
            type: 'FULL',
            category: 'DAILY',
            triggeredBy: 'scheduler',
          }),
        ),
      ).rejects.toThrow('test error');

      // Email should NOT have been called since alertEmail is empty
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });
});
