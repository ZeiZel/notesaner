import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import type { PublicSearchQueryDto } from './dto';

// ─── Cache constants ──────────────────────────────────────────────────────────

/** 5 minutes TTL for public search result cache entries. */
const PUBLIC_SEARCH_CACHE_TTL = 5 * 60;

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface PublicSearchResult {
  /** Note path within the vault (e.g. "folder/note.md"). */
  path: string;
  /** Note title. */
  title: string;
  /** HTML-highlighted snippet with matching terms wrapped in <mark>. */
  snippet: string;
  /** FTS rank for ordering by relevance. Higher is more relevant. */
  rank: number;
  /** ISO 8601 string of the last update time. */
  updatedAt: string;
}

export interface PublicSearchResponse {
  data: PublicSearchResult[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    hasMore: boolean;
  };
}

// ─── Internal DB row types ────────────────────────────────────────────────────

interface FtsRow {
  path: string;
  title: string;
  snippet: string;
  rank: number;
  updated_at: Date;
}

interface FtsCountRow {
  total: bigint;
}

interface FallbackRow {
  path: string;
  title: string;
  updated_at: Date;
}

// ─── Cache key helpers ────────────────────────────────────────────────────────

function searchCacheKey(publicSlug: string, query: string, page: number, limit: number): string {
  // Include all params so different pages/limits have separate entries.
  const safeQuery = query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .substring(0, 100);
  return `publish:search:${publicSlug}:${safeQuery}:${page}:${limit}`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PublicSearchService {
  private readonly logger = new Logger(PublicSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
  ) {}

  /**
   * Full-text search over published notes in a public vault.
   *
   * - Resolves the workspace by publicSlug (must be isPublic=true).
   * - Filters strictly to isPublished=true, isTrashed=false.
   * - Uses PostgreSQL tsvector + ts_rank_cd for relevance ranking.
   * - Uses ts_headline to produce highlighted snippets.
   * - Results are cached in ValKey for 5 minutes keyed by slug + query + page + limit.
   * - Falls back to an ILIKE query when FTS extensions are unavailable.
   *
   * Minimum query length: 2 characters (enforced by DTO validation).
   *
   * @throws NotFoundException when no public vault matches the slug.
   */
  async searchPublishedNotes(
    publicSlug: string,
    params: PublicSearchQueryDto,
  ): Promise<PublicSearchResponse> {
    const limit = Math.min(params.limit ?? 10, 50);
    const page = params.page ?? 0;
    const query = params.q.trim();

    const cacheKey = searchCacheKey(publicSlug, query, page, limit);

    // 1. Cache lookup
    try {
      const cached = await this.valkeyService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PublicSearchResponse;
      }
    } catch (err) {
      // Cache failure must never block search
      this.logger.warn(`Public search cache read failed for slug "${publicSlug}": ${err}`);
    }

    // 2. Resolve the public workspace (throws NotFoundException if not found)
    const workspace = await this.resolvePublicWorkspace(publicSlug);

    // 3. Execute search
    let result: PublicSearchResponse;

    try {
      result = await this.runFtsSearch(workspace.id, query, limit, page);
    } catch (err) {
      this.logger.warn(
        `Public FTS search failed for slug "${publicSlug}", falling back to ILIKE: ${err}`,
      );
      result = await this.runFallbackSearch(workspace.id, query, limit, page);
    }

    // 4. Write to cache (fire-and-forget — never blocks the response)
    this.valkeyService
      .set(cacheKey, JSON.stringify(result), PUBLIC_SEARCH_CACHE_TTL)
      .catch((err) =>
        this.logger.warn(`Public search cache write failed for slug "${publicSlug}": ${err}`),
      );

    return result;
  }

  /**
   * Invalidate all search cache entries for a public slug.
   * Called when the vault's published state changes (note publish toggle,
   * vault config changes, etc.).
   *
   * Uses a SCAN-based approach to delete all matching keys so we do not need
   * to enumerate every possible query/page/limit combination.
   */
  async invalidateSearchCache(publicSlug: string): Promise<void> {
    try {
      const client = this.valkeyService.getClient();
      const pattern = `publish:search:${publicSlug}:*`;
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.valkeyService.del(...keysToDelete);
        this.logger.debug(
          `Invalidated ${keysToDelete.length} public search cache key(s) for slug "${publicSlug}"`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to invalidate public search cache for slug "${publicSlug}": ${err}`);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Resolves a public workspace by its publicSlug.
   * Throws NotFoundException when not found or not public.
   */
  private async resolvePublicWorkspace(publicSlug: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { publicSlug, isPublic: true },
    });

    if (!workspace) {
      throw new NotFoundException('Public vault not found');
    }

    return workspace;
  }

  /**
   * Executes a full-text search against the search_vector column.
   *
   * Uses:
   * - plainto_tsquery for safe query parsing (no injection risk via template literals)
   * - ts_rank_cd for cover-density ranking (rewards multiple distinct matches)
   * - ts_headline against the note title for highlighted snippets
   *   (title-only snippets are safe to return without exposing private body content)
   *
   * The COUNT query runs in parallel with the data query to minimise latency.
   *
   * NOTE: Only isPublished=true, isTrashed=false notes are ever returned.
   */
  private async runFtsSearch(
    workspaceId: string,
    query: string,
    limit: number,
    page: number,
  ): Promise<PublicSearchResponse> {
    const offset = page * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<FtsRow[]>`
        SELECT
          n.path,
          n.title,
          ts_headline(
            'english',
            COALESCE(n.title, ''),
            plainto_tsquery('english', ${query}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=5, HighlightAll=false'
          ) AS snippet,
          ts_rank_cd(n.search_vector, plainto_tsquery('english', ${query}), 1) AS rank,
          n.updated_at
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_published = true
          AND n.is_trashed = false
          AND n.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      this.prisma.$queryRaw<FtsCountRow[]>`
        SELECT COUNT(*) AS total
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_published = true
          AND n.is_trashed = false
          AND n.search_vector @@ plainto_tsquery('english', ${query})
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((r) => ({
        path: r.path,
        title: r.title,
        snippet: r.snippet,
        rank: Number(r.rank),
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      })),
      pagination: {
        total,
        limit,
        page,
        hasMore: offset + rows.length < total,
      },
    };
  }

  /**
   * ILIKE-based fallback when FTS/tsvector is unavailable.
   * Searches title only — intentionally limited to avoid exposing body content.
   * No snippet highlighting is possible without FTS.
   */
  private async runFallbackSearch(
    workspaceId: string,
    query: string,
    limit: number,
    page: number,
  ): Promise<PublicSearchResponse> {
    const offset = page * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<FallbackRow[]>`
        SELECT n.path, n.title, n.updated_at
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_published = true
          AND n.is_trashed = false
          AND n.title ILIKE ${'%' + query + '%'}
        ORDER BY n.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      this.prisma.$queryRaw<FtsCountRow[]>`
        SELECT COUNT(*) AS total
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_published = true
          AND n.is_trashed = false
          AND n.title ILIKE ${'%' + query + '%'}
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((r) => ({
        path: r.path,
        title: r.title,
        // No highlighting in fallback — surface the title as the snippet.
        snippet: r.title,
        rank: 1,
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      })),
      pagination: {
        total,
        limit,
        page,
        hasMore: offset + rows.length < total,
      },
    };
  }
}
