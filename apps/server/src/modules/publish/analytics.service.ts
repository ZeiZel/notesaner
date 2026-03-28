/**
 * AnalyticsService — privacy-first page view tracking for published notes.
 *
 * Design goals:
 * - No cookies, no third-party services
 * - Visitor identity via SHA-256(IP + UA + daily-salt) — resets every 24 h
 * - All counters stored in ValKey (Redis) — no schema changes required
 * - Workspace note metadata fetched from Prisma for ranking queries
 *
 * Key schema in ValKey:
 *   analytics:views:{workspaceId}:{noteId}:{YYYY-MM-DD}  → integer (total page views)
 *   analytics:uv:{workspaceId}:{noteId}:{YYYY-MM-DD}:{visitorHash} → 1 (unique visitor flag)
 *   analytics:ref:{workspaceId}:{noteId}:{YYYY-MM-DD}:{referrer}  → integer (referrer count)
 *
 * Daily keys expire after 120 days to self-prune stale data.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import type { DateRange } from './dto/analytics-query.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Keys expire after 120 days to prevent unbounded growth. */
const KEY_TTL_SECONDS = 120 * 24 * 60 * 60;

/** Maximum number of top notes returned by getTopNotes. */
const TOP_NOTES_MAX = 50;

/** Maximum number of referrers returned per note/workspace. */
const TOP_REFERRERS_MAX = 20;

// ─── Response types ───────────────────────────────────────────────────────────

export interface DailyStatPoint {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface TopNoteItem {
  noteId: string;
  title: string;
  path: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface ReferrerItem {
  referrer: string;
  count: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueVisitors: number;
  topReferrers: ReferrerItem[];
  dailyStats: DailyStatPoint[];
  topNotes: TopNoteItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive an ISO date string (YYYY-MM-DD) for the daily salt bucket.
 * Using UTC prevents timezone-driven inconsistencies across the server.
 */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build the list of YYYY-MM-DD date strings for the requested range.
 * The list is ordered ascending (oldest first).
 */
function buildDateRange(range: DateRange): string[] {
  if (range === 'all') {
    // For "all time" we still return daily buckets — limited to the last 365
    // days for practical chart rendering.
    return buildDateList(365);
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return buildDateList(days);
}

function buildDateList(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}

/**
 * Construct the daily page-view counter key.
 */
function viewKey(workspaceId: string, noteId: string, date: string): string {
  return `analytics:views:${workspaceId}:${noteId}:${date}`;
}

/**
 * Construct the unique-visitor membership key.
 * The caller must SET this key with TTL to record a unique visit.
 */
function uniqueVisitorKey(
  workspaceId: string,
  noteId: string,
  date: string,
  visitorHash: string,
): string {
  return `analytics:uv:${workspaceId}:${noteId}:${date}:${visitorHash}`;
}

/**
 * Prefix used to retrieve all unique-visitor keys for a given day/note so we
 * can count them with SCAN.
 */
function uniqueVisitorPrefix(workspaceId: string, noteId: string, date: string): string {
  return `analytics:uv:${workspaceId}:${noteId}:${date}:`;
}

/**
 * Referrer counter key.
 */
function referrerKey(workspaceId: string, noteId: string, date: string, referrer: string): string {
  // Truncate referrer to guard against key-size explosions
  const safeRef = referrer.slice(0, 200).replace(/[^a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]/g, '_');
  return `analytics:ref:${workspaceId}:${noteId}:${date}:${safeRef}`;
}

/**
 * Prefix for referrer counter keys for a given day/note.
 */
function referrerPrefix(workspaceId: string, noteId: string, date: string): string {
  return `analytics:ref:${workspaceId}:${noteId}:${date}:`;
}

/**
 * Compute a privacy-preserving visitor hash.
 *
 * Hash = SHA-256( ip + "|" + userAgent + "|" + dateUTC )
 *
 * The daily date component acts as a rolling salt — the same visitor hash
 * is never reused across days, preventing cross-day tracking while still
 * supporting same-day unique counts.
 */
function computeVisitorHash(ip: string, userAgent: string): string {
  const date = todayUTC();
  return createHash('sha256').update(`${ip}|${userAgent}|${date}`).digest('hex');
}

/**
 * Scan ValKey for all keys matching `pattern` and return them.
 * Uses SCAN with COUNT 100 to avoid blocking the server.
 */
async function scanKeys(
  client: ReturnType<ValkeyService['getClient']>,
  pattern: string,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
  ) {}

  // ─── Record a page view ──────────────────────────────────────────────────

  /**
   * Record a page view for a published note.
   *
   * - Increments the daily page-view counter
   * - Marks the visitor as unique for today (no double-counting within a day)
   * - Records the referrer bucket if present
   *
   * This method is intentionally non-throwing — a tracking failure must never
   * surface to the public reader.
   */
  async recordPageView(
    workspaceId: string,
    noteId: string,
    visitorIp: string,
    userAgent: string,
    referrer: string | null,
  ): Promise<void> {
    try {
      const date = todayUTC();
      const visitorHash = computeVisitorHash(visitorIp, userAgent);
      const client = this.valkeyService.getClient();

      // Batch the operations with a pipeline for efficiency
      const pipeline = client.pipeline();

      // Increment total views
      const vKey = viewKey(workspaceId, noteId, date);
      pipeline.incr(vKey);
      pipeline.expire(vKey, KEY_TTL_SECONDS);

      // Mark unique visitor (SET NX — only sets if not already present)
      const uvKey = uniqueVisitorKey(workspaceId, noteId, date, visitorHash);
      pipeline.set(uvKey, '1', 'EX', KEY_TTL_SECONDS, 'NX');

      // Record referrer if present and non-empty
      const normalizedRef = this.normalizeReferrer(referrer);
      if (normalizedRef) {
        const refKey = referrerKey(workspaceId, noteId, date, normalizedRef);
        pipeline.incr(refKey);
        pipeline.expire(refKey, KEY_TTL_SECONDS);
      }

      await pipeline.exec();
    } catch (err) {
      // Non-critical: log but never propagate to caller
      this.logger.warn(`Failed to record page view for note ${noteId}: ${err}`);
    }
  }

  // ─── Analytics queries ───────────────────────────────────────────────────

  /**
   * Get the full analytics summary for a workspace.
   *
   * Includes:
   * - Total views and unique visitors across all published notes
   * - Daily stats chart data (one point per day)
   * - Top-referrers list
   * - Top notes by views
   */
  async getAnalytics(
    workspaceId: string,
    dateRange: DateRange,
    noteId?: string,
  ): Promise<AnalyticsSummary> {
    // Validate workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const dates = buildDateRange(dateRange);
    const noteIds = await this.resolveNoteIds(workspaceId, noteId);

    const [dailyStats, topReferrers] = await Promise.all([
      this.fetchDailyStats(workspaceId, noteIds, dates),
      this.fetchTopReferrers(workspaceId, noteIds, dates),
    ]);

    const totalViews = dailyStats.reduce((sum, d) => sum + d.views, 0);
    const uniqueVisitors = dailyStats.reduce((sum, d) => sum + d.uniqueVisitors, 0);

    const topNotes = await this.getTopNotes(workspaceId, TOP_NOTES_MAX, dateRange);

    return {
      totalViews,
      uniqueVisitors,
      topReferrers,
      dailyStats,
      topNotes,
    };
  }

  /**
   * Get the top N notes by total views within the given date range.
   */
  async getTopNotes(
    workspaceId: string,
    limit: number,
    dateRange: DateRange,
  ): Promise<TopNoteItem[]> {
    const clampedLimit = Math.min(limit, TOP_NOTES_MAX);

    // Fetch all published notes in the workspace
    const notes = await this.prisma.note.findMany({
      where: { workspaceId, isPublished: true, isTrashed: false },
      select: { id: true, title: true, path: true },
    });

    if (notes.length === 0) {
      return [];
    }

    const dates = buildDateRange(dateRange);
    const client = this.valkeyService.getClient();

    // Fetch view counts for all notes in parallel
    const noteViewCounts = await Promise.all(
      notes.map(async (note) => {
        let totalViews = 0;
        let uniqueVisitors = 0;

        const viewKeys = dates.map((d) => viewKey(workspaceId, note.id, d));

        // MGET all view keys in one round-trip
        const viewValues = await client.mget(...viewKeys);
        totalViews = viewValues.reduce((sum, v) => sum + (v ? parseInt(v, 10) : 0), 0);

        // Count unique visitors across all days
        for (const date of dates) {
          const uvPattern = uniqueVisitorPrefix(workspaceId, note.id, date) + '*';
          const uvKeys = await scanKeys(client, uvPattern);
          uniqueVisitors += uvKeys.length;
        }

        return { ...note, totalViews, uniqueVisitors };
      }),
    );

    return noteViewCounts
      .filter((n) => n.totalViews > 0)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, clampedLimit)
      .map(({ id: noteId, title, path, totalViews, uniqueVisitors }) => ({
        noteId,
        title,
        path,
        totalViews,
        uniqueVisitors,
      }));
  }

  /**
   * Get daily view/unique-visitor counts for chart rendering.
   * Returns one data point per day in the requested range.
   */
  async getDailyStats(
    workspaceId: string,
    dateRange: DateRange,
    noteId?: string,
  ): Promise<DailyStatPoint[]> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const dates = buildDateRange(dateRange);
    const noteIds = await this.resolveNoteIds(workspaceId, noteId);
    return this.fetchDailyStats(workspaceId, noteIds, dates);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Resolve the list of note IDs to aggregate over.
   *
   * If a specific noteId is provided and exists in the workspace, returns [noteId].
   * Otherwise returns all published note IDs in the workspace.
   */
  private async resolveNoteIds(workspaceId: string, noteId?: string): Promise<string[]> {
    if (noteId) {
      const note = await this.prisma.note.findFirst({
        where: { id: noteId, workspaceId },
        select: { id: true },
      });

      if (!note) {
        throw new NotFoundException(`Note ${noteId} not found in workspace`);
      }

      return [noteId];
    }

    const notes = await this.prisma.note.findMany({
      where: { workspaceId, isPublished: true, isTrashed: false },
      select: { id: true },
    });

    return notes.map((n) => n.id);
  }

  /**
   * Fetch daily aggregated stats (views + unique visitors) for a set of notes
   * across a list of date strings.
   */
  private async fetchDailyStats(
    workspaceId: string,
    noteIds: string[],
    dates: string[],
  ): Promise<DailyStatPoint[]> {
    if (noteIds.length === 0) {
      return dates.map((date) => ({ date, views: 0, uniqueVisitors: 0 }));
    }

    const client = this.valkeyService.getClient();

    return Promise.all(
      dates.map(async (date) => {
        // Aggregate views: MGET all noteId view keys for this date
        const vKeys = noteIds.map((nid) => viewKey(workspaceId, nid, date));
        const viewValues = await client.mget(...vKeys);
        const views = viewValues.reduce((sum, v) => sum + (v ? parseInt(v, 10) : 0), 0);

        // Aggregate unique visitors: SCAN for each note's UV keys on this date
        let uniqueVisitors = 0;
        for (const nid of noteIds) {
          const uvPattern = uniqueVisitorPrefix(workspaceId, nid, date) + '*';
          const uvKeys = await scanKeys(client, uvPattern);
          uniqueVisitors += uvKeys.length;
        }

        return { date, views, uniqueVisitors };
      }),
    );
  }

  /**
   * Fetch top referrers for a set of notes over a date range.
   */
  private async fetchTopReferrers(
    workspaceId: string,
    noteIds: string[],
    dates: string[],
  ): Promise<ReferrerItem[]> {
    if (noteIds.length === 0) {
      return [];
    }

    const client = this.valkeyService.getClient();
    const referrerCounts = new Map<string, number>();

    for (const nid of noteIds) {
      for (const date of dates) {
        const pattern = referrerPrefix(workspaceId, nid, date) + '*';
        const refKeys = await scanKeys(client, pattern);

        if (refKeys.length === 0) continue;

        const values = await client.mget(...refKeys);
        refKeys.forEach((key, idx) => {
          const rawVal = values[idx];
          const count = rawVal ? parseInt(rawVal, 10) : 0;
          if (count <= 0) return;

          // Extract referrer from key: last segment after final ":"
          const parts = key.split(':');
          const referrer = parts[parts.length - 1] ?? '(direct)';
          referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + count);
        });
      }
    }

    return Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_REFERRERS_MAX);
  }

  /**
   * Normalise a referrer string for storage.
   *
   * Returns null for empty / direct (no referrer) traffic.
   * Strips query strings and fragments to bucket referrers at the host level.
   */
  private normalizeReferrer(referrer: string | null): string | null {
    if (!referrer || referrer.trim() === '') {
      return null;
    }

    try {
      const url = new URL(referrer);
      // Store host only — avoids leaking user paths / tokens
      return url.hostname || null;
    } catch {
      // Not a valid URL — return raw but truncated
      const trimmed = referrer.trim().slice(0, 100);
      return trimmed || null;
    }
  }
}
