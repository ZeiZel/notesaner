import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { FreshnessStatusFilter } from './dto/freshness-query.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Days after last action before a note is considered "aging". Default per workspace. */
export const DEFAULT_FRESHNESS_THRESHOLD_DAYS = 60;

/** Days after last action before a note is considered "stale". Default per workspace. */
export const DEFAULT_WARNING_THRESHOLD_DAYS = 90;

/** Maximum allowed threshold in days. */
const MAX_THRESHOLD_DAYS = 730;

/** Frontmatter key for storing the last verified date (ISO 8601). */
const FM_KEY_LAST_VERIFIED = 'lastVerifiedAt';

/** Frontmatter key for the document owner user ID. */
const FM_KEY_OWNER = 'owner';

/** Settings key inside Workspace.settings JSON. */
const SETTINGS_KEY_FRESHNESS_THRESHOLD = 'freshnessThresholdDays';
const SETTINGS_KEY_WARNING_THRESHOLD = 'warningThresholdDays';

// ─── Public types ─────────────────────────────────────────────────────────────

/** The three possible freshness states of a note. */
export type FreshnessStatus = 'fresh' | 'aging' | 'stale';

export interface FreshnessResult {
  /** UUID of the note. */
  noteId: string;
  status: FreshnessStatus;
  /** Days elapsed since the freshness anchor date. */
  ageInDays: number;
  /**
   * ISO 8601 date that was used as the freshness anchor.
   * This is lastVerifiedAt when set (in frontmatter), otherwise updatedAt.
   */
  anchorDate: string;
  /** True if the freshness anchor was a manual "mark as reviewed" action. */
  isVerified: boolean;
  /** Days configured as the aging threshold for this workspace. */
  agingThresholdDays: number;
  /** Days configured as the stale threshold for this workspace. */
  staleThresholdDays: number;
}

export interface ReviewQueueItem {
  noteId: string;
  workspaceId: string;
  title: string;
  path: string;
  status: FreshnessStatus;
  ageInDays: number;
  anchorDate: string;
  isVerified: boolean;
  /** User ID from frontmatter.owner or createdById. */
  ownerId: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-edit timestamp. */
  updatedAt: string;
}

export interface ReviewQueuePage {
  data: ReviewQueueItem[];
  pagination: {
    total: number;
    limit: number;
    cursor: string | undefined;
    hasMore: boolean;
  };
  thresholds: {
    agingThresholdDays: number;
    staleThresholdDays: number;
  };
}

export interface MarkReviewedResult {
  noteId: string;
  lastVerifiedAt: string;
  reviewedById: string;
  status: FreshnessStatus;
}

/** Event emitted when a note crosses the stale threshold (for email notification). */
export const FRESHNESS_STALE_EVENT = 'freshness.note_became_stale';

export interface FreshnessStaleEvent {
  noteId: string;
  workspaceId: string;
  noteTitle: string;
  ownerId: string | null;
  ageInDays: number;
  staleThresholdDays: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * FreshnessService — tracks document staleness within a workspace.
 *
 * The "freshness anchor" of a note is determined by:
 *   1. frontmatter.lastVerifiedAt — set by a manual "mark as reviewed" action
 *   2. updatedAt                  — the note's last-edit timestamp (fallback)
 *
 * When lastVerifiedAt is stored in frontmatter AND is more recent than updatedAt,
 * it is used as the anchor. Otherwise updatedAt is the anchor.
 *
 * Freshness status:
 *   fresh  → ageInDays < agingThresholdDays
 *   aging  → agingThresholdDays <= ageInDays < staleThresholdDays
 *   stale  → ageInDays >= staleThresholdDays
 *
 * Thresholds are configurable per workspace via Workspace.settings JSON.
 * Defaults: aging=60 days, stale=90 days.
 *
 * Note: lastVerifiedAt is stored in the note's frontmatter JSON field to avoid
 * requiring a schema migration. This keeps the freshness system fully self-contained.
 */
@Injectable()
export class FreshnessService {
  private readonly logger = new Logger(FreshnessService.name);

  /** Internal event emitter for decoupled stale notifications. */
  readonly events = new EventEmitter();

  constructor(private readonly prisma: PrismaService) {}

  // ─── Core freshness calculation ────────────────────────────────────────────

  /**
   * Calculate the freshness status of a single note.
   *
   * Uses the freshness anchor (frontmatter.lastVerifiedAt ?? updatedAt) relative to now.
   * The workspace thresholds are resolved from Workspace.settings.
   *
   * @param workspaceId Workspace UUID (used to resolve thresholds).
   * @param noteId      Note UUID.
   */
  async calculateFreshness(workspaceId: string, noteId: string): Promise<FreshnessResult> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId, isTrashed: false },
      select: {
        updatedAt: true,
        frontmatter: true,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const { agingThresholdDays, staleThresholdDays } = await this.resolveThresholds(workspaceId);

    const lastVerifiedAt = this.extractLastVerifiedAt(note.frontmatter);

    return this.computeFreshnessResult(
      noteId,
      note.updatedAt,
      lastVerifiedAt,
      agingThresholdDays,
      staleThresholdDays,
    );
  }

  /**
   * Returns all notes in a workspace whose freshness status matches `status`.
   *
   * Optionally filter by folder path prefix.
   *
   * @param workspaceId Workspace UUID.
   * @param status      Freshness filter — 'stale', 'aging', 'fresh', or 'all'.
   * @param folder      Optional folder path prefix filter.
   */
  async getStaleNotes(
    workspaceId: string,
    status: FreshnessStatus | 'all' = 'stale',
    folder?: string,
  ): Promise<ReviewQueueItem[]> {
    const { agingThresholdDays, staleThresholdDays } = await this.resolveThresholds(workspaceId);

    const now = new Date();
    const agingCutoff = this.subtractDays(now, agingThresholdDays);

    const where: Prisma.NoteWhereInput = {
      workspaceId,
      isTrashed: false,
    };

    if (folder) {
      const folderPrefix = folder.endsWith('/') ? folder : `${folder}/`;
      where.path = { startsWith: folderPrefix };
    }

    // Pre-filter at DB level to reduce data transfer for non-fresh status queries.
    // Fresh notes are also fetched when status==='all'.
    if (status === 'aging' || status === 'stale') {
      where.updatedAt = { lt: agingCutoff };
    }

    const notes = await this.prisma.note.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        title: true,
        path: true,
        frontmatter: true,
        createdById: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    const results: ReviewQueueItem[] = [];

    for (const note of notes) {
      const lastVerifiedAt = this.extractLastVerifiedAt(note.frontmatter);

      const fr = this.computeFreshnessResult(
        note.id,
        note.updatedAt,
        lastVerifiedAt,
        agingThresholdDays,
        staleThresholdDays,
      );

      if (status !== 'all' && fr.status !== status) {
        continue;
      }

      const ownerId = this.extractOwnerFromFrontmatter(note.frontmatter) ?? note.createdById;

      results.push({
        noteId: note.id,
        workspaceId: note.workspaceId,
        title: note.title,
        path: note.path,
        status: fr.status,
        ageInDays: fr.ageInDays,
        anchorDate: fr.anchorDate,
        isVerified: fr.isVerified,
        ownerId,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      });
    }

    return results;
  }

  /**
   * Mark a note as reviewed, resetting its freshness clock.
   *
   * Sets `frontmatter.lastVerifiedAt` to the current timestamp.
   * Creates a version history entry describing the review action for audit trail.
   *
   * @param workspaceId Workspace UUID.
   * @param noteId      Note UUID.
   * @param userId      Reviewer user UUID.
   */
  async markAsReviewed(
    workspaceId: string,
    noteId: string,
    userId: string,
  ): Promise<MarkReviewedResult> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId, isTrashed: false },
      select: { id: true, updatedAt: true, frontmatter: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Merge lastVerifiedAt into frontmatter
    const existingFm = (note.frontmatter ?? {}) as Record<string, unknown>;
    const updatedFm: Record<string, unknown> = {
      ...existingFm,
      [FM_KEY_LAST_VERIFIED]: nowIso,
    };

    await this.prisma.note.update({
      where: { id: noteId },
      data: { frontmatter: updatedFm as Prisma.InputJsonValue },
    });

    // Integration with version history: record an audit version entry
    const latest = await this.prisma.noteVersion.findFirst({
      where: { noteId },
      orderBy: { version: 'desc' },
      select: { version: true, content: true },
    });

    if (latest) {
      const nextVersion = latest.version + 1;
      await this.prisma.noteVersion
        .create({
          data: {
            noteId,
            version: nextVersion,
            content: latest.content,
            diff: null,
            message: `Marked as reviewed by user ${userId}`,
            createdById: userId,
          },
        })
        .catch((err) => {
          this.logger.warn(
            `markAsReviewed: Failed to create audit version for note ${noteId}: ${err}`,
          );
        });
    }

    const { agingThresholdDays, staleThresholdDays } = await this.resolveThresholds(workspaceId);

    const fr = this.computeFreshnessResult(
      noteId,
      note.updatedAt,
      now,
      agingThresholdDays,
      staleThresholdDays,
    );

    this.logger.log(`Note ${noteId} marked as reviewed by user ${userId} at ${nowIso}`);

    return {
      noteId,
      lastVerifiedAt: nowIso,
      reviewedById: userId,
      status: fr.status,
    };
  }

  /**
   * Returns the paginated needs-review queue for admin use.
   *
   * Notes are sorted by ageInDays descending (most stale first).
   *
   * @param workspaceId Workspace UUID.
   * @param params      Pagination + filter parameters.
   */
  async getNeedsReviewQueue(
    workspaceId: string,
    params: {
      cursor?: string;
      limit?: number;
      status?: FreshnessStatusFilter;
      ownerId?: string;
      folder?: string;
    },
  ): Promise<ReviewQueuePage> {
    const limit = Math.min(params.limit ?? 20, 100);
    const filterStatus: FreshnessStatusFilter = params.status ?? 'stale';

    const { agingThresholdDays, staleThresholdDays } = await this.resolveThresholds(workspaceId);

    const now = new Date();
    const agingCutoff = this.subtractDays(now, agingThresholdDays);

    const where: Prisma.NoteWhereInput = {
      workspaceId,
      isTrashed: false,
    };

    if (params.folder) {
      const folderPrefix = params.folder.endsWith('/') ? params.folder : `${params.folder}/`;
      where.path = { startsWith: folderPrefix };
    }

    // DB-level date pre-filter for non-fresh statuses
    if (filterStatus === 'aging' || filterStatus === 'stale') {
      where.updatedAt = { lt: agingCutoff };
    }

    const rawNotes = await this.prisma.note.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        title: true,
        path: true,
        frontmatter: true,
        createdById: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Compute freshness in memory (lastVerifiedAt may override updatedAt)
    const computed: ReviewQueueItem[] = [];

    for (const note of rawNotes) {
      const lastVerifiedAt = this.extractLastVerifiedAt(note.frontmatter);

      const fr = this.computeFreshnessResult(
        note.id,
        note.updatedAt,
        lastVerifiedAt,
        agingThresholdDays,
        staleThresholdDays,
      );

      if (filterStatus !== 'all' && fr.status !== filterStatus) {
        continue;
      }

      const ownerId = this.extractOwnerFromFrontmatter(note.frontmatter) ?? note.createdById;

      if (params.ownerId && ownerId !== params.ownerId) {
        continue;
      }

      computed.push({
        noteId: note.id,
        workspaceId: note.workspaceId,
        title: note.title,
        path: note.path,
        status: fr.status,
        ageInDays: fr.ageInDays,
        anchorDate: fr.anchorDate,
        isVerified: fr.isVerified,
        ownerId,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      });
    }

    // Sort by ageInDays descending (most stale first)
    computed.sort((a, b) => b.ageInDays - a.ageInDays);

    const total = computed.length;

    // Apply cursor-based pagination (note IDs are the cursor)
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = computed.findIndex((item) => item.noteId === params.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const page = computed.slice(startIndex, startIndex + limit + 1);
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    const nextCursor = hasMore ? items[items.length - 1]?.noteId : undefined;

    return {
      data: items,
      pagination: {
        total,
        limit,
        cursor: nextCursor,
        hasMore,
      },
      thresholds: {
        agingThresholdDays,
        staleThresholdDays,
      },
    };
  }

  /**
   * Update the freshness thresholds for a workspace.
   *
   * Validates that warningThreshold > freshnessThreshold.
   * Persists the updated values to Workspace.settings JSON.
   *
   * @param workspaceId        Workspace UUID.
   * @param freshnessThreshold Days for aging threshold.
   * @param warningThreshold   Days for stale threshold.
   */
  async updateWorkspaceThresholds(
    workspaceId: string,
    freshnessThreshold: number,
    warningThreshold: number,
  ): Promise<{ freshnessThresholdDays: number; warningThresholdDays: number }> {
    if (warningThreshold <= freshnessThreshold) {
      throw new BadRequestException('warningThreshold must be greater than freshnessThreshold');
    }

    if (freshnessThreshold < 1 || freshnessThreshold > MAX_THRESHOLD_DAYS) {
      throw new BadRequestException(
        `freshnessThreshold must be between 1 and ${MAX_THRESHOLD_DAYS}`,
      );
    }

    if (warningThreshold < 1 || warningThreshold > MAX_THRESHOLD_DAYS) {
      throw new BadRequestException(`warningThreshold must be between 1 and ${MAX_THRESHOLD_DAYS}`);
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const existingSettings = (workspace.settings ?? {}) as Record<string, unknown>;
    const updatedSettings: Record<string, unknown> = {
      ...existingSettings,
      [SETTINGS_KEY_FRESHNESS_THRESHOLD]: freshnessThreshold,
      [SETTINGS_KEY_WARNING_THRESHOLD]: warningThreshold,
    };

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    this.logger.log(
      `Updated freshness thresholds for workspace ${workspaceId}: ` +
        `aging=${freshnessThreshold}d, stale=${warningThreshold}d`,
    );

    return {
      freshnessThresholdDays: freshnessThreshold,
      warningThresholdDays: warningThreshold,
    };
  }

  /**
   * Emit freshness stale events for notes that have crossed the stale threshold
   * and have not been verified since they became stale.
   *
   * Intended to be called by a scheduled job or background processor.
   *
   * @param workspaceId Workspace UUID.
   * @returns Number of stale events emitted.
   */
  async emitStaleNotifications(workspaceId: string): Promise<number> {
    const { staleThresholdDays } = await this.resolveThresholds(workspaceId);
    const staleCutoff = this.subtractDays(new Date(), staleThresholdDays);

    // Pre-filter at DB level: only fetch notes whose updatedAt is before stale cutoff
    const candidates = await this.prisma.note.findMany({
      where: {
        workspaceId,
        isTrashed: false,
        updatedAt: { lt: staleCutoff },
      },
      select: {
        id: true,
        title: true,
        frontmatter: true,
        createdById: true,
        updatedAt: true,
      },
    });

    let emitted = 0;

    for (const note of candidates) {
      const lastVerifiedAt = this.extractLastVerifiedAt(note.frontmatter);

      // If lastVerifiedAt is set and is more recent than the stale cutoff, skip
      if (lastVerifiedAt !== null && lastVerifiedAt > staleCutoff) {
        continue;
      }

      const anchorDate =
        lastVerifiedAt !== null && lastVerifiedAt > note.updatedAt
          ? lastVerifiedAt
          : note.updatedAt;

      const ownerId = this.extractOwnerFromFrontmatter(note.frontmatter) ?? note.createdById;

      const ageInDays = this.daysBetween(anchorDate, new Date());

      const event: FreshnessStaleEvent = {
        noteId: note.id,
        workspaceId,
        noteTitle: note.title,
        ownerId,
        ageInDays,
        staleThresholdDays,
      };

      this.events.emit(FRESHNESS_STALE_EVENT, event);
      emitted++;
    }

    this.logger.log(
      `emitStaleNotifications: emitted ${emitted} stale event(s) for workspace ${workspaceId}`,
    );

    return emitted;
  }

  // ─── Threshold resolution (public for testing) ────────────────────────────

  /**
   * Resolve the aging/stale thresholds for a workspace.
   * Falls back to module defaults when workspace settings are not configured.
   */
  async resolveThresholds(
    workspaceId: string,
  ): Promise<{ agingThresholdDays: number; staleThresholdDays: number }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return {
        agingThresholdDays: DEFAULT_FRESHNESS_THRESHOLD_DAYS,
        staleThresholdDays: DEFAULT_WARNING_THRESHOLD_DAYS,
      };
    }

    const settings = (workspace.settings ?? {}) as Record<string, unknown>;

    const agingThresholdDays =
      typeof settings[SETTINGS_KEY_FRESHNESS_THRESHOLD] === 'number' &&
      (settings[SETTINGS_KEY_FRESHNESS_THRESHOLD] as number) > 0
        ? (settings[SETTINGS_KEY_FRESHNESS_THRESHOLD] as number)
        : DEFAULT_FRESHNESS_THRESHOLD_DAYS;

    const staleThresholdDays =
      typeof settings[SETTINGS_KEY_WARNING_THRESHOLD] === 'number' &&
      (settings[SETTINGS_KEY_WARNING_THRESHOLD] as number) > 0
        ? (settings[SETTINGS_KEY_WARNING_THRESHOLD] as number)
        : DEFAULT_WARNING_THRESHOLD_DAYS;

    return { agingThresholdDays, staleThresholdDays };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Core freshness computation for a single note.
   *
   * Anchors on lastVerifiedAt (from frontmatter) if it is more recent than
   * updatedAt, otherwise uses updatedAt as the freshness reference point.
   */
  computeFreshnessResult(
    noteId: string,
    updatedAt: Date,
    lastVerifiedAt: Date | null,
    agingThresholdDays: number,
    staleThresholdDays: number,
  ): FreshnessResult {
    const now = new Date();

    // lastVerifiedAt overrides updatedAt when it is set AND more recent
    const anchorDate =
      lastVerifiedAt !== null && lastVerifiedAt > updatedAt ? lastVerifiedAt : updatedAt;

    const isVerified = lastVerifiedAt !== null && lastVerifiedAt > updatedAt;
    const ageInDays = this.daysBetween(anchorDate, now);

    let status: FreshnessStatus;
    if (ageInDays >= staleThresholdDays) {
      status = 'stale';
    } else if (ageInDays >= agingThresholdDays) {
      status = 'aging';
    } else {
      status = 'fresh';
    }

    return {
      noteId,
      status,
      ageInDays,
      anchorDate: anchorDate.toISOString(),
      isVerified,
      agingThresholdDays,
      staleThresholdDays,
    };
  }

  /**
   * Extract lastVerifiedAt from the note's frontmatter JSON.
   * Returns a Date when the stored value is a valid ISO 8601 string, or null.
   */
  extractLastVerifiedAt(frontmatter: unknown): Date | null {
    if (!frontmatter || typeof frontmatter !== 'object') return null;
    const fm = frontmatter as Record<string, unknown>;
    const raw = fm[FM_KEY_LAST_VERIFIED];
    if (typeof raw !== 'string' || raw.trim() === '') return null;

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Extract the owner user ID from note frontmatter.
   * Supports the `owner` key (string).
   */
  extractOwnerFromFrontmatter(frontmatter: unknown): string | null {
    if (!frontmatter || typeof frontmatter !== 'object') return null;
    const fm = frontmatter as Record<string, unknown>;
    const owner = fm[FM_KEY_OWNER];
    return typeof owner === 'string' && owner.trim() !== '' ? owner.trim() : null;
  }

  /** Return the number of whole days between two dates (non-negative). */
  daysBetween(from: Date, to: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = to.getTime() - from.getTime();
    return Math.max(0, Math.floor(diff / msPerDay));
  }

  /** Subtract a given number of days from a date, returning a new Date. */
  subtractDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() - days);
    return result;
  }
}
