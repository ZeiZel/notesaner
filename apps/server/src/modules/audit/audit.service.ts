import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ValkeyService } from '../valkey/valkey.service';
import {
  AUDIT_ACTION_GROUP_MAP,
  AuditAction,
  AuditEntry,
  AuditFilter,
  AuditPage,
  AuditQueryOptions,
  AuditRetentionConfig,
  GdprSubjectData,
} from './audit.types';
import { exportToCsv } from './csv-export';

// ─── Valkey key helpers ───────────────────────────────────────────────────────

/**
 * Sorted-set key that stores all entries for a workspace, scored by Unix ms.
 * Global entries (workspaceId = null) are stored under the GLOBAL_LOG_KEY.
 */
const wsLogKey = (workspaceId: string) => `audit:log:ws:${workspaceId}`;
const GLOBAL_LOG_KEY = 'audit:log:global';
const retentionKey = (workspaceId: string) => `audit:retention:${workspaceId}`;
const GDPR_ANONYMIZE_SENTINEL = '[deleted]';

/** Default and boundary values for retention. */
const DEFAULT_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 365;

/** Maximum number of entries returned in a single page. */
const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 50;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly valkey: ValkeyService) {}

  // ─── Write ──────────────────────────────────────────────────────────────────

  /**
   * Append a new audit-log entry.
   *
   * The entry is stored in a Valkey sorted-set keyed by workspace (or the
   * global set for workspace-less actions). The score is the current Unix
   * timestamp in milliseconds, which allows efficient range queries.
   *
   * Failure to write is logged but never thrown — audit logging must never
   * disrupt the primary operation that triggered it.
   */
  async log(
    action: AuditAction,
    userId: string,
    workspaceId: string | null,
    metadata: Record<string, unknown>,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      userId,
      workspaceId,
      metadata,
      ipAddress,
      userAgent,
    };

    const key = workspaceId ? wsLogKey(workspaceId) : GLOBAL_LOG_KEY;
    const score = Date.now();
    const serialised = JSON.stringify(entry);

    try {
      const client = this.valkey.getClient();
      await client.zadd(key, score, serialised);
      this.logger.debug(`Audit log entry written: ${action} by ${userId}`);
    } catch (error) {
      // Fire-and-forget: do not propagate — audit failure should never disrupt the caller
      this.logger.error(`Failed to write audit log entry [${action}]: ${error}`);
    }
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  /**
   * Query audit entries for a workspace with optional filters and cursor-based
   * pagination.
   *
   * Pagination strategy: cursor is the score (Unix ms) of the last item on the
   * previous page. We fetch limit+1 items to determine if there is a next page.
   *
   * Filtering (userId, actions, search) is applied in-memory after the time-range
   * slice because Valkey sorted sets do not support compound predicates. Given
   * that typical audit log queries are bounded by a manageable time window this
   * is acceptable. For very large workspaces callers should narrow the time range.
   */
  async query(workspaceId: string, options: AuditQueryOptions = {}): Promise<AuditPage> {
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const filter = options.filter ?? {};

    const key = wsLogKey(workspaceId);

    // Parse time-range from filter or use cursor
    const maxScore = this.parseCursorToScore(options.cursor) ?? this.parseToScore(filter.to);
    const minScore = this.parseFromScore(filter.from);

    const client = this.valkey.getClient();

    // Fetch entries in reverse chronological order (newest first) within the
    // score range. We retrieve up to limit * 10 candidates to account for
    // in-memory filter shrinkage, then paginate.
    const CANDIDATE_MULTIPLIER = 10;
    const rawEntries = await this.fetchRange(
      client,
      key,
      minScore,
      maxScore,
      limit * CANDIDATE_MULTIPLIER,
    );

    const parsed = rawEntries
      .map((raw) => this.safeParseEntry(raw))
      .filter((e): e is AuditEntry => e !== null);

    const filtered = this.applyFilters(parsed, filter);

    // Total before pagination (approximate — based on the filtered candidate set)
    const total = filtered.length;

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    const nextCursor = hasMore && page.length > 0 ? this.buildCursor(page[page.length - 1]) : null;

    return { entries: page, nextCursor, total };
  }

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  /**
   * Export all audit entries matching the filter as a CSV string.
   * Intended for streaming directly to the HTTP response as an attachment.
   */
  async exportCsv(workspaceId: string, filter: AuditFilter = {}): Promise<string> {
    const key = wsLogKey(workspaceId);
    const minScore = this.parseFromScore(filter.from);
    const maxScore = this.parseToScore(filter.to);

    const client = this.valkey.getClient();
    // For CSV export we fetch all matching entries (no limit)
    const rawEntries = await this.fetchRange(client, key, minScore, maxScore, 0);

    const entries = rawEntries
      .map((raw) => this.safeParseEntry(raw))
      .filter((e): e is AuditEntry => e !== null);

    const filtered = this.applyFilters(entries, filter);

    this.logger.log(`Audit CSV export: workspaceId=${workspaceId}, entries=${filtered.length}`);

    return exportToCsv(filtered);
  }

  // ─── Retention ──────────────────────────────────────────────────────────────

  /**
   * Retrieve the retention configuration for a workspace.
   * Returns defaults if no config has been set.
   */
  async getRetentionConfig(
    workspaceId: string,
    requesterId: string,
  ): Promise<AuditRetentionConfig> {
    const key = retentionKey(workspaceId);
    const raw = await this.valkey.get(key);

    if (raw) {
      try {
        return JSON.parse(raw) as AuditRetentionConfig;
      } catch {
        this.logger.warn(`Corrupt retention config for workspace ${workspaceId}`);
      }
    }

    return {
      retentionDays: DEFAULT_RETENTION_DAYS,
      updatedAt: new Date().toISOString(),
      updatedBy: requesterId,
    };
  }

  /**
   * Update the retention configuration for a workspace.
   * Validated bounds: 30–365 days.
   */
  async setRetentionConfig(
    workspaceId: string,
    retentionDays: number,
    requesterId: string,
  ): Promise<AuditRetentionConfig> {
    const clamped = Math.max(MIN_RETENTION_DAYS, Math.min(MAX_RETENTION_DAYS, retentionDays));

    const config: AuditRetentionConfig = {
      retentionDays: clamped,
      updatedAt: new Date().toISOString(),
      updatedBy: requesterId,
    };

    await this.valkey.set(retentionKey(workspaceId), JSON.stringify(config));

    this.logger.log(
      `Audit retention config updated: workspaceId=${workspaceId}, days=${clamped}, by=${requesterId}`,
    );

    // Log the config change itself
    await this.log(
      AuditAction.AUDIT_RETENTION_CHANGED,
      requesterId,
      workspaceId,
      { retentionDays: clamped },
      '',
      '',
    );

    return config;
  }

  /**
   * Purge entries older than `days` days from all workspace-specific log sets.
   *
   * Called by a scheduled job. Returns the total number of entries removed.
   * Uses ZREMRANGEBYSCORE to atomically remove by score (Unix ms).
   */
  async purgeOlderThan(workspaceId: string, days: number): Promise<number> {
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const key = wsLogKey(workspaceId);

    try {
      const client = this.valkey.getClient();
      // ZREMRANGEBYSCORE key -inf (cutoffMs - 1)
      const removed = await client.zremrangebyscore(key, '-inf', cutoffMs - 1);
      this.logger.log(
        `Audit purge: workspaceId=${workspaceId}, removed=${removed}, cutoff=${new Date(cutoffMs).toISOString()}`,
      );
      return removed;
    } catch (error) {
      this.logger.error(`Audit purge failed for workspace ${workspaceId}: ${error}`);
      return 0;
    }
  }

  // ─── GDPR ───────────────────────────────────────────────────────────────────

  /**
   * Retrieve all audit entries for a specific user across a workspace.
   * Used for GDPR Subject Access Requests.
   */
  async getSubjectData(userId: string, workspaceId: string): Promise<GdprSubjectData> {
    const { entries } = await this.query(workspaceId, {
      filter: { userId },
      limit: MAX_PAGE_SIZE,
    });

    return {
      userId,
      totalEntries: entries.length,
      entries,
    };
  }

  /**
   * GDPR right-to-erasure: replace the userId in all entries for the given
   * user with the sentinel value "[deleted]", nullify ipAddress, and redact
   * any PII-bearing metadata fields.
   *
   * This rewrites the affected entries in-place (delete + re-insert) to
   * maintain the append-only property for non-PII fields.
   */
  async anonymizeUser(userId: string, workspaceId: string): Promise<number> {
    const client = this.valkey.getClient();
    const key = wsLogKey(workspaceId);

    // Fetch ALL entries for this workspace without limit
    const rawEntries = await this.fetchRange(client, key, 0, '+inf', 0);

    const toDelete: string[] = [];
    const toInsert: Array<{ score: number; value: string }> = [];

    for (const raw of rawEntries) {
      const entry = this.safeParseEntry(raw);
      if (!entry || entry.userId !== userId) continue;

      toDelete.push(raw);

      const anonymised: AuditEntry = {
        ...entry,
        userId: GDPR_ANONYMIZE_SENTINEL,
        ipAddress: GDPR_ANONYMIZE_SENTINEL,
        userAgent: GDPR_ANONYMIZE_SENTINEL,
        metadata: this.redactPiiFromMetadata(entry.metadata),
      };

      const scoreMs = new Date(entry.timestamp).getTime();
      toInsert.push({ score: scoreMs, value: JSON.stringify(anonymised) });
    }

    if (toDelete.length === 0) return 0;

    // Atomic swap: remove originals then re-insert anonymised versions
    const pipeline = client.pipeline();
    for (const raw of toDelete) {
      pipeline.zrem(key, raw);
    }
    for (const { score, value } of toInsert) {
      pipeline.zadd(key, score, value);
    }
    await pipeline.exec();

    this.logger.log(
      `GDPR anonymize: userId=${userId}, workspaceId=${workspaceId}, affected=${toDelete.length}`,
    );

    // Log the GDPR action itself (userId already anonymised so we use sentinel)
    await this.log(
      AuditAction.GDPR_DATA_DELETED,
      GDPR_ANONYMIZE_SENTINEL,
      workspaceId,
      { affectedEntries: toDelete.length },
      '',
      '',
    );

    return toDelete.length;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Fetch entries from a sorted set in reverse score order (newest first).
   * When limit is 0 all entries in the range are returned.
   */
  private async fetchRange(
    client: ReturnType<ValkeyService['getClient']>,
    key: string,
    minScore: number | '-inf',
    maxScore: number | '+inf',
    limit: number,
  ): Promise<string[]> {
    const min = minScore === '-inf' ? '-inf' : String(minScore);
    const max = maxScore === '+inf' ? '+inf' : String(maxScore);

    if (limit > 0) {
      return client.zrevrangebyscore(key, max, min, 'LIMIT', 0, limit);
    }

    return client.zrevrangebyscore(key, max, min);
  }

  private safeParseEntry(raw: string): AuditEntry | null {
    try {
      return JSON.parse(raw) as AuditEntry;
    } catch {
      this.logger.warn(`Failed to parse audit entry: ${raw.slice(0, 100)}`);
      return null;
    }
  }

  private applyFilters(entries: AuditEntry[], filter: AuditFilter): AuditEntry[] {
    // Resolve effective action set: explicit actions list takes precedence over actionGroup.
    let effectiveActions: AuditAction[] | undefined = filter.actions;
    if (!effectiveActions?.length && filter.actionGroup) {
      effectiveActions = AUDIT_ACTION_GROUP_MAP[filter.actionGroup];
    }

    return entries.filter((entry) => {
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (effectiveActions && effectiveActions.length > 0) {
        if (!effectiveActions.includes(entry.action)) return false;
      }
      if (filter.search) {
        const needle = filter.search.toLowerCase();
        const hay = JSON.stringify(entry).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  /** Convert an ISO string to Unix ms, or '-inf' if absent. */
  private parseFromScore(from?: string): number | '-inf' {
    if (!from) return '-inf';
    const ms = new Date(from).getTime();
    return isNaN(ms) ? '-inf' : ms;
  }

  /** Convert an ISO string to Unix ms, or '+inf' if absent. */
  private parseToScore(to?: string): number | '+inf' {
    if (!to) return '+inf';
    const ms = new Date(to).getTime();
    return isNaN(ms) ? '+inf' : ms;
  }

  /**
   * Decode cursor back to a score.
   * Cursor is a base64-encoded JSON object: { score: number }.
   */
  private parseCursorToScore(cursor?: string): number | null {
    if (!cursor) return null;
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
        score: number;
      };
      return typeof decoded.score === 'number' ? decoded.score - 1 : null;
    } catch {
      return null;
    }
  }

  /** Build a cursor from the last entry in the current page. */
  private buildCursor(entry: AuditEntry): string {
    const score = new Date(entry.timestamp).getTime();
    return Buffer.from(JSON.stringify({ score })).toString('base64');
  }

  /**
   * Remove known PII-bearing fields from metadata.
   * Keeps structural audit data (resource IDs, action outcomes) intact.
   */
  private redactPiiFromMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const PII_KEYS = new Set([
      'email',
      'displayName',
      'name',
      'avatarUrl',
      'phone',
      'address',
      'ip',
      'ipAddress',
    ]);

    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
      redacted[k] = PII_KEYS.has(k) ? GDPR_ANONYMIZE_SENTINEL : v;
    }
    return redacted;
  }
}
