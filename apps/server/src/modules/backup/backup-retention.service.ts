import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupService } from './backup.service';
import {
  RETENTION_DAILY_COUNT,
  RETENTION_WEEKLY_COUNT,
  RETENTION_MONTHLY_COUNT,
} from './backup.constants';
import type { BackupRetentionJobResult } from './backup.types';
import type { BackupCategory } from '@prisma/client';

/**
 * BackupRetentionService — enforces the backup retention policy.
 *
 * Retention rules:
 *   - Daily backups: keep the latest N (default 7)
 *   - Weekly backups: keep the latest N (default 4)
 *   - Monthly backups: keep the latest N (default 3)
 *   - Manual backups: never auto-deleted
 *   - Expired backups (by expiresAt): deleted regardless of count
 *
 * Cleanup is performed in two passes:
 *   1. Delete backups past their expiresAt timestamp.
 *   2. For each category, delete the oldest backups exceeding the retention count.
 */
@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);

  private readonly retentionCounts: Record<Exclude<BackupCategory, 'MANUAL'>, number>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
    private readonly configService: ConfigService,
  ) {
    this.retentionCounts = {
      DAILY: this.configService.get<number>('backup.retention.dailyCount', RETENTION_DAILY_COUNT),
      WEEKLY: this.configService.get<number>(
        'backup.retention.weeklyCount',
        RETENTION_WEEKLY_COUNT,
      ),
      MONTHLY: this.configService.get<number>(
        'backup.retention.monthlyCount',
        RETENTION_MONTHLY_COUNT,
      ),
    };
  }

  /**
   * Execute the full retention cleanup.
   *
   * @param dryRun - If true, only log what would be deleted without deleting.
   */
  async enforce(dryRun = false): Promise<BackupRetentionJobResult> {
    const start = Date.now();
    const details: BackupRetentionJobResult['details'] = [];
    let freedBytes = 0;

    // Pass 1: Delete backups that have expired by timestamp
    const expiredBackups = await this.prisma.backupLog.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ['COMPLETED', 'VERIFIED'] },
      },
      orderBy: { startedAt: 'asc' },
    });

    for (const backup of expiredBackups) {
      details.push({
        id: backup.id,
        filename: backup.filename,
        category: backup.category,
        reason: `Expired at ${backup.expiresAt?.toISOString() ?? 'unknown'}`,
      });

      if (!dryRun) {
        await this.deleteBackup(backup);
      }

      freedBytes += Number(backup.sizeBytes);
    }

    // Pass 2: Enforce count-based retention per category
    for (const category of ['DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const maxCount = this.retentionCounts[category];

      const completedBackups = await this.prisma.backupLog.findMany({
        where: {
          category,
          status: { in: ['COMPLETED', 'VERIFIED'] },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (completedBackups.length <= maxCount) {
        continue;
      }

      // Keep the newest `maxCount` backups, delete the rest
      const toDelete = completedBackups.slice(maxCount);

      for (const backup of toDelete) {
        // Skip if already marked for deletion in pass 1
        if (details.some((d) => d.id === backup.id)) {
          continue;
        }

        details.push({
          id: backup.id,
          filename: backup.filename,
          category: backup.category,
          reason: `Exceeds ${category} retention limit of ${maxCount}`,
        });

        if (!dryRun) {
          await this.deleteBackup(backup);
        }

        freedBytes += Number(backup.sizeBytes);
      }
    }

    // Pass 3: Clean up failed backups older than 7 days
    const failedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const failedBackups = await this.prisma.backupLog.findMany({
      where: {
        status: 'FAILED',
        startedAt: { lte: failedCutoff },
      },
    });

    for (const backup of failedBackups) {
      details.push({
        id: backup.id,
        filename: backup.filename,
        category: backup.category,
        reason: 'Failed backup older than 7 days',
      });

      if (!dryRun) {
        await this.prisma.backupLog.update({
          where: { id: backup.id },
          data: { status: 'EXPIRED' },
        });
      }
    }

    const durationMs = Date.now() - start;
    const deleted = dryRun ? 0 : details.length;

    this.logger.log(
      `Retention cleanup ${dryRun ? '(DRY RUN) ' : ''}complete: ` +
        `${details.length} backup(s) ${dryRun ? 'would be ' : ''}removed, ` +
        `${this.formatSize(freedBytes)} freed in ${durationMs}ms`,
    );

    return {
      deleted,
      freedBytes,
      durationMs,
      details,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Delete a backup: remove from storage, then mark as expired in the database.
   */
  private async deleteBackup(backup: {
    id: string;
    filename: string;
    destination: string;
  }): Promise<void> {
    try {
      await this.backupService.deleteBackup(backup.destination, backup.filename);

      await this.prisma.backupLog.update({
        where: { id: backup.id },
        data: { status: 'EXPIRED' },
      });

      this.logger.debug(`Deleted backup: ${backup.filename}`);
    } catch (err) {
      this.logger.error(`Failed to delete backup ${backup.filename}: ${String(err)}`);
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
