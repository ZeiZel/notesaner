import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppConfiguration } from '../../config/configuration';

/**
 * Quota limits resolved for a workspace.
 * Per-workspace overrides take precedence over system defaults.
 */
export interface ResolvedQuotaLimits {
  maxStorageBytes: bigint;
  maxNotes: number;
  maxFileSizeBytes: bigint;
  warningThresholdPercent: number;
}

/**
 * Storage statistics and quota info returned by the API.
 * All byte values are serialized as strings for JSON compatibility (BigInt).
 */
export interface StorageStatsResponse {
  workspaceId: string;
  used: {
    totalStorageBytes: string;
    noteCount: number;
    attachmentCount: number;
    versionCount: number;
  };
  limits: {
    maxStorageBytes: string;
    maxNotes: number;
    maxFileSizeBytes: string;
  };
  quota: {
    storageUsedPercent: number;
    noteUsedPercent: number;
    isStorageWarning: boolean;
    isNoteWarning: boolean;
    isStorageExceeded: boolean;
    isNoteExceeded: boolean;
  };
  lastRecalculatedAt: string | null;
}

/**
 * StorageQuotaService manages per-workspace storage tracking and enforcement.
 *
 * Responsibilities:
 *   - Track storage usage (notes, attachments, versions) per workspace
 *   - Resolve effective limits (per-workspace overrides or system defaults)
 *   - Check whether a workspace exceeds its quota
 *   - Perform full recalculation of storage stats from database
 *   - Incremental adjustments on CRUD operations
 *   - Admin overrides for per-workspace limits
 */
@Injectable()
export class StorageQuotaService {
  private readonly logger = new Logger(StorageQuotaService.name);

  /** System-wide default limits from configuration */
  private readonly defaultMaxStorageBytes: bigint;
  private readonly defaultMaxNotes: number;
  private readonly defaultMaxFileSizeBytes: bigint;
  private readonly warningThresholdPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {
    this.defaultMaxStorageBytes =
      this.config.get<bigint>('quota.maxStorageBytes', { infer: true }) ??
      BigInt(5 * 1024 * 1024 * 1024);
    this.defaultMaxNotes = this.config.get<number>('quota.maxNotes', { infer: true }) ?? 50_000;
    this.defaultMaxFileSizeBytes =
      this.config.get<bigint>('quota.maxFileSizeBytes', { infer: true }) ??
      BigInt(50 * 1024 * 1024);
    this.warningThresholdPercent =
      this.config.get<number>('quota.warningThresholdPercent', { infer: true }) ?? 80;
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  /**
   * Get storage stats and quota information for a workspace.
   * Creates the stats record if it does not exist (lazy initialization).
   */
  async getStorageStats(workspaceId: string): Promise<StorageStatsResponse> {
    const stats = await this.ensureStatsRecord(workspaceId);
    const limits = this.resolveQuotaLimits(stats);

    const storageUsedPercent =
      limits.maxStorageBytes > 0n
        ? Number((stats.totalStorageBytes * 100n) / limits.maxStorageBytes)
        : 0;
    const noteUsedPercent =
      limits.maxNotes > 0 ? Math.round((stats.noteCount / limits.maxNotes) * 100) : 0;

    return {
      workspaceId,
      used: {
        totalStorageBytes: stats.totalStorageBytes.toString(),
        noteCount: stats.noteCount,
        attachmentCount: stats.attachmentCount,
        versionCount: stats.versionCount,
      },
      limits: {
        maxStorageBytes: limits.maxStorageBytes.toString(),
        maxNotes: limits.maxNotes,
        maxFileSizeBytes: limits.maxFileSizeBytes.toString(),
      },
      quota: {
        storageUsedPercent,
        noteUsedPercent,
        isStorageWarning: storageUsedPercent >= this.warningThresholdPercent,
        isNoteWarning: noteUsedPercent >= this.warningThresholdPercent,
        isStorageExceeded: stats.totalStorageBytes >= limits.maxStorageBytes,
        isNoteExceeded: stats.noteCount >= limits.maxNotes,
      },
      lastRecalculatedAt: stats.lastRecalculatedAt?.toISOString() ?? null,
    };
  }

  // ─── Quota checks ──────────────────────────────────────────────────────────

  /**
   * Check if adding the specified bytes would exceed the storage quota.
   * Returns true if the workspace is within quota.
   */
  async checkStorageQuota(workspaceId: string, additionalBytes: bigint = 0n): Promise<boolean> {
    const stats = await this.ensureStatsRecord(workspaceId);
    const limits = this.resolveQuotaLimits(stats);
    return stats.totalStorageBytes + additionalBytes < limits.maxStorageBytes;
  }

  /**
   * Check if adding a new note would exceed the note count quota.
   * Returns true if the workspace is within quota.
   */
  async checkNoteQuota(workspaceId: string): Promise<boolean> {
    const stats = await this.ensureStatsRecord(workspaceId);
    const limits = this.resolveQuotaLimits(stats);
    return stats.noteCount < limits.maxNotes;
  }

  /**
   * Check if a file size exceeds the maximum allowed file size.
   * Returns true if the file is within the limit.
   */
  async checkFileSizeLimit(workspaceId: string, fileSizeBytes: bigint): Promise<boolean> {
    const stats = await this.ensureStatsRecord(workspaceId);
    const limits = this.resolveQuotaLimits(stats);
    return fileSizeBytes <= limits.maxFileSizeBytes;
  }

  /**
   * Returns true if storage usage is at or above the warning threshold.
   */
  async isStorageWarning(workspaceId: string): Promise<boolean> {
    const stats = await this.ensureStatsRecord(workspaceId);
    const limits = this.resolveQuotaLimits(stats);
    if (limits.maxStorageBytes === 0n) return false;
    const usedPercent = Number((stats.totalStorageBytes * 100n) / limits.maxStorageBytes);
    return usedPercent >= this.warningThresholdPercent;
  }

  // ─── Incremental updates ───────────────────────────────────────────────────

  /**
   * Increment storage counters after a note is created.
   * @param workspaceId  Workspace UUID
   * @param sizeBytes    Size of the note content in bytes
   */
  async onNoteCreated(workspaceId: string, sizeBytes: number): Promise<void> {
    await this.ensureStatsRecord(workspaceId);
    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        noteCount: { increment: 1 },
        totalStorageBytes: { increment: sizeBytes },
      },
    });
    this.logger.debug(`Incremented note count for workspace ${workspaceId} (+${sizeBytes} bytes)`);
  }

  /**
   * Decrement storage counters after a note is permanently deleted.
   * @param workspaceId  Workspace UUID
   * @param sizeBytes    Size of the note content in bytes
   */
  async onNoteDeleted(workspaceId: string, sizeBytes: number): Promise<void> {
    await this.ensureStatsRecord(workspaceId);
    const stats = await this.prisma.workspaceStorageStats.findUnique({
      where: { workspaceId },
      select: { noteCount: true, totalStorageBytes: true },
    });
    if (!stats) return;

    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        noteCount: { decrement: Math.min(1, stats.noteCount) },
        totalStorageBytes: {
          decrement:
            BigInt(sizeBytes) > stats.totalStorageBytes ? stats.totalStorageBytes : sizeBytes,
        },
      },
    });
    this.logger.debug(`Decremented note count for workspace ${workspaceId} (-${sizeBytes} bytes)`);
  }

  /**
   * Adjust storage after a note's content changes size.
   * @param workspaceId   Workspace UUID
   * @param deltaBytes    Positive or negative change in bytes
   */
  async onNoteUpdated(workspaceId: string, deltaBytes: number): Promise<void> {
    if (deltaBytes === 0) return;
    await this.ensureStatsRecord(workspaceId);

    if (deltaBytes > 0) {
      await this.prisma.workspaceStorageStats.update({
        where: { workspaceId },
        data: { totalStorageBytes: { increment: deltaBytes } },
      });
    } else {
      // Ensure we don't go below zero
      const stats = await this.prisma.workspaceStorageStats.findUnique({
        where: { workspaceId },
        select: { totalStorageBytes: true },
      });
      if (!stats) return;
      const decrementAmount =
        BigInt(Math.abs(deltaBytes)) > stats.totalStorageBytes
          ? stats.totalStorageBytes
          : Math.abs(deltaBytes);

      await this.prisma.workspaceStorageStats.update({
        where: { workspaceId },
        data: { totalStorageBytes: { decrement: decrementAmount } },
      });
    }
  }

  /**
   * Increment storage counters after an attachment is uploaded.
   */
  async onAttachmentCreated(workspaceId: string, sizeBytes: number): Promise<void> {
    await this.ensureStatsRecord(workspaceId);
    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        attachmentCount: { increment: 1 },
        totalStorageBytes: { increment: sizeBytes },
      },
    });
    this.logger.debug(
      `Incremented attachment count for workspace ${workspaceId} (+${sizeBytes} bytes)`,
    );
  }

  /**
   * Decrement storage counters after an attachment is deleted.
   */
  async onAttachmentDeleted(workspaceId: string, sizeBytes: number): Promise<void> {
    await this.ensureStatsRecord(workspaceId);
    const stats = await this.prisma.workspaceStorageStats.findUnique({
      where: { workspaceId },
      select: { attachmentCount: true, totalStorageBytes: true },
    });
    if (!stats) return;

    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        attachmentCount: { decrement: Math.min(1, stats.attachmentCount) },
        totalStorageBytes: {
          decrement:
            BigInt(sizeBytes) > stats.totalStorageBytes ? stats.totalStorageBytes : sizeBytes,
        },
      },
    });
    this.logger.debug(
      `Decremented attachment count for workspace ${workspaceId} (-${sizeBytes} bytes)`,
    );
  }

  /**
   * Increment version count after a note version is created.
   */
  async onVersionCreated(workspaceId: string, sizeBytes: number): Promise<void> {
    await this.ensureStatsRecord(workspaceId);
    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        versionCount: { increment: 1 },
        totalStorageBytes: { increment: sizeBytes },
      },
    });
  }

  // ─── Full recalculation ────────────────────────────────────────────────────

  /**
   * Recalculate storage stats for a single workspace from the database.
   * Used by the daily cron job and admin-triggered recalculations.
   */
  async recalculate(workspaceId: string): Promise<void> {
    const [noteAgg, attachmentAgg, versionAgg] = await Promise.all([
      this.prisma.note.aggregate({
        where: { workspaceId, isTrashed: false },
        _count: { id: true },
      }),
      this.prisma.attachment.aggregate({
        where: { note: { workspaceId } },
        _count: { id: true },
        _sum: { size: true },
      }),
      this.prisma.noteVersion.aggregate({
        where: { note: { workspaceId } },
        _count: { id: true },
      }),
    ]);

    const noteCount = noteAgg._count.id;
    const attachmentCount = attachmentAgg._count.id;
    const attachmentBytes = BigInt(attachmentAgg._sum.size ?? 0);
    const versionCount = versionAgg._count.id;

    // Estimate note content storage from wordCount average (rough approximation)
    // In a real implementation this would measure actual file sizes on disk.
    // For now we use the attachment size as the primary storage metric since
    // note content is stored on the filesystem and not directly measurable via DB.
    // We approximate note storage using a simple heuristic:
    // average 5 chars per word, average noteWordCount * 5 bytes
    const noteWordCountAgg = await this.prisma.note.aggregate({
      where: { workspaceId, isTrashed: false },
      _sum: { wordCount: true },
    });
    const estimatedNoteBytes = BigInt((noteWordCountAgg._sum.wordCount ?? 0) * 5);

    // Version content size estimation (stored in DB as text)
    const versions = await this.prisma.noteVersion.findMany({
      where: { note: { workspaceId } },
      select: { content: true },
    });
    const versionBytes = versions.reduce(
      (acc, v) => acc + BigInt(Buffer.byteLength(v.content, 'utf8')),
      0n,
    );

    const totalStorageBytes = estimatedNoteBytes + attachmentBytes + versionBytes;

    await this.prisma.workspaceStorageStats.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        totalStorageBytes,
        noteCount,
        attachmentCount,
        versionCount,
        lastRecalculatedAt: new Date(),
      },
      update: {
        totalStorageBytes,
        noteCount,
        attachmentCount,
        versionCount,
        lastRecalculatedAt: new Date(),
      },
    });

    this.logger.log(
      `Recalculated storage for workspace ${workspaceId}: ` +
        `${totalStorageBytes} bytes, ${noteCount} notes, ${attachmentCount} attachments, ${versionCount} versions`,
    );
  }

  /**
   * Recalculate storage stats for all workspaces.
   * Used by the daily cron job.
   */
  async recalculateAll(): Promise<{ workspacesProcessed: number; errors: number }> {
    const workspaces = await this.prisma.workspace.findMany({
      select: { id: true },
    });

    let errors = 0;

    for (const ws of workspaces) {
      try {
        await this.recalculate(ws.id);
      } catch (err) {
        errors++;
        this.logger.error(`Failed to recalculate storage for workspace ${ws.id}: ${String(err)}`);
      }
    }

    return { workspacesProcessed: workspaces.length, errors };
  }

  // ─── Admin overrides ───────────────────────────────────────────────────────

  /**
   * Set per-workspace limit overrides (admin only).
   * Pass null to clear an override and revert to system defaults.
   */
  async setWorkspaceLimits(
    workspaceId: string,
    overrides: {
      maxStorageBytes?: bigint | null;
      maxNotes?: number | null;
      maxFileSizeBytes?: bigint | null;
    },
  ): Promise<void> {
    await this.ensureStatsRecord(workspaceId);

    await this.prisma.workspaceStorageStats.update({
      where: { workspaceId },
      data: {
        maxStorageBytes: overrides.maxStorageBytes ?? undefined,
        maxNotes: overrides.maxNotes ?? undefined,
        maxFileSizeBytes: overrides.maxFileSizeBytes ?? undefined,
      },
    });

    this.logger.log(
      `Updated storage limits for workspace ${workspaceId}: ` +
        `maxStorageBytes=${overrides.maxStorageBytes?.toString() ?? 'unchanged'}, ` +
        `maxNotes=${overrides.maxNotes?.toString() ?? 'unchanged'}, ` +
        `maxFileSizeBytes=${overrides.maxFileSizeBytes?.toString() ?? 'unchanged'}`,
    );
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Ensure a WorkspaceStorageStats record exists for the workspace.
   * Returns the existing or newly created record.
   */
  private async ensureStatsRecord(workspaceId: string) {
    return this.prisma.workspaceStorageStats.upsert({
      where: { workspaceId },
      create: { workspaceId },
      update: {},
    });
  }

  /**
   * Resolve effective quota limits for a workspace.
   * Per-workspace overrides take precedence over system defaults.
   */
  resolveQuotaLimits(stats: {
    maxStorageBytes: bigint | null;
    maxNotes: number | null;
    maxFileSizeBytes: bigint | null;
  }): ResolvedQuotaLimits {
    return {
      maxStorageBytes: stats.maxStorageBytes ?? this.defaultMaxStorageBytes,
      maxNotes: stats.maxNotes ?? this.defaultMaxNotes,
      maxFileSizeBytes: stats.maxFileSizeBytes ?? this.defaultMaxFileSizeBytes,
      warningThresholdPercent: this.warningThresholdPercent,
    };
  }
}
