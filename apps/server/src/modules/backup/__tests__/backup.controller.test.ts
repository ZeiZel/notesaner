import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BackupController } from '../backup.controller';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockBackupService = {
  listBackups: vi.fn().mockResolvedValue({
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
  }),
  getBackup: vi.fn().mockResolvedValue(null),
  triggerManualBackup: vi.fn().mockResolvedValue('test-job-id'),
  getJobStatus: vi.fn().mockResolvedValue(null),
  verifyBackup: vi.fn().mockResolvedValue({
    backupLogId: 'test-id',
    verified: true,
    durationMs: 1000,
  }),
};

function createController(): BackupController {
  return new BackupController(mockBackupService as never);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BackupController', () => {
  let controller: BackupController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = createController();
  });

  describe('GET /admin/backups', () => {
    it('should return backup list with default pagination', async () => {
      const result = await controller.listBackups();

      expect(mockBackupService.listBackups).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        type: undefined,
        status: undefined,
      });
      expect(result.total).toBe(0);
    });

    it('should pass pagination and filter parameters', async () => {
      await controller.listBackups('10', '20', 'FULL', 'COMPLETED');

      expect(mockBackupService.listBackups).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        type: 'FULL',
        status: 'COMPLETED',
      });
    });
  });

  describe('GET /admin/backups/:id', () => {
    it('should return backup when found', async () => {
      const backup = {
        id: 'test-id',
        type: 'FULL',
        status: 'COMPLETED',
        filename: 'backup.tar.gz.enc',
      };
      mockBackupService.getBackup.mockResolvedValue(backup);

      const result = await controller.getBackup('test-id');
      expect(result).toEqual(backup);
    });

    it('should throw NotFoundException when backup not found', async () => {
      mockBackupService.getBackup.mockResolvedValue(null);

      await expect(controller.getBackup('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /admin/backups', () => {
    it('should trigger a FULL backup by default', async () => {
      const result = await controller.triggerBackup({});

      expect(mockBackupService.triggerManualBackup).toHaveBeenCalledWith('FULL');
      expect(result.jobId).toBe('test-job-id');
      expect(result.message).toContain('FULL');
    });

    it('should trigger a specific backup type', async () => {
      await controller.triggerBackup({ type: 'DATABASE' });

      expect(mockBackupService.triggerManualBackup).toHaveBeenCalledWith('DATABASE');
    });

    it('should reject invalid backup type', async () => {
      await expect(controller.triggerBackup({ type: 'INVALID' as never })).rejects.toThrow();
    });
  });

  describe('GET /admin/backups/jobs/:jobId', () => {
    it('should return job status', async () => {
      mockBackupService.getJobStatus.mockResolvedValue({
        state: 'active',
        progress: 50,
      });

      const result = await controller.getJobStatus('test-job');

      expect(result).toEqual({
        jobId: 'test-job',
        state: 'active',
        progress: 50,
      });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockBackupService.getJobStatus.mockResolvedValue(null);

      await expect(controller.getJobStatus('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /admin/backups/verify', () => {
    it('should return success message when verification passes', async () => {
      const result = await controller.triggerVerification();

      expect(result.message).toContain('verified successfully');
    });

    it('should return failure message when verification fails', async () => {
      mockBackupService.verifyBackup.mockResolvedValue({
        backupLogId: 'test-id',
        verified: false,
        durationMs: 500,
        error: 'Checksum mismatch',
      });

      const result = await controller.triggerVerification();

      expect(result.message).toContain('Checksum mismatch');
    });

    it('should pass backupId when provided', async () => {
      await controller.triggerVerification({ backupId: 'specific-id' });

      expect(mockBackupService.verifyBackup).toHaveBeenCalledWith('specific-id');
    });
  });
});
