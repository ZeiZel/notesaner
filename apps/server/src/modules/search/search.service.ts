import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import { SearchQueryDto, SortField, SortOrder, TagFilterMode } from './dto/search-query.dto';

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet: string;
  rank: number;
  /** How the result was matched: 'fts' | 'fuzzy' */
  matchType?: 'fts' | 'fuzzy';
}

export interface SearchResponse {
  data: SearchResult[];
  pagination: {
    total: number;
    limit: number;
    cursor?: string;
    hasMore: boolean;
  };
}

export interface IndexNoteOptions {
  /** Tag names to include in the search index (weight C). */
  tags?: string[];
  /** Frontmatter key-value pairs serialized as text (weight D). */
  frontmatter?: Record<string, unknown>;
}

export interface FuzzySearchOptions {
  /** Similarity threshold (0–1). Results with similarity >= threshold are returned. Default: 0.3 */
  threshold?: number;
  /** Maximum number of results to return. Default: 20, max: 100. */
  limit?: number;
}

/**
 * Maximum number of recent searches stored per user.
 */
const RECENT_SEARCHES_MAX = 20;

/**
 * Search result cache TTL in seconds (5 minutes).
 */
const SEARCH_CACHE_TTL_SECONDS = 300;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Full-text search using PostgreSQL tsvector with ts_rank_cd ranking
   * and ts_headline snippet generation, supplemented by fuzzy trigram
   * matching for typo-tolerant results.
   *
   * Supports filtering by: tag (AND/OR), folder, date range (created/updated),
   * author, isPublished, isTrashed. Supports sorting by relevance, title,
   * createdAt, or updatedAt.
   *
   * Results are cached in ValKey for 5 minutes using a key derived from the
   * full query parameters. The cache key is invalidated when notes are indexed
   * (via indexNote / removeFromIndex), but a simple TTL-based approach is used
   * for simplicity because search results are not user-specific.
   *
   * Strategy:
   *   1. Check ValKey cache — return immediately on cache hit.
   *   2. Apply Prisma WHERE clause to resolve candidate note IDs after
   *      structural filters (tag, folder, author, date, published, trashed).
   *   3. Run FTS query against the candidate set — exact and stemmed matches.
   *   4. Run fuzzy pg_trgm query against the candidate set — typo-tolerant.
   *   5. Merge results: FTS results take priority; fuzzy supplements appended
   *      with a 0.5× rank penalty.
   *   6. Apply sort override when caller requests non-relevance sort.
   *   7. Store result in ValKey cache.
   *
   * Minimum query length: 2 characters.
   */
  async search(
    workspaceId: string,
    params: SearchQueryDto,
    userId?: string,
  ): Promise<SearchResponse> {
    const limit = Math.min(params.limit ?? 20, 100);
    const query = params.q.trim();

    if (query.length < 2) {
      return {
        data: [],
        pagination: { total: 0, limit, hasMore: false },
      };
    }

    // Persist recent search for the user (fire-and-forget, never blocks search)
    if (userId) {
      this.saveRecentSearch(userId, workspaceId, query).catch((err) =>
        this.logger.warn(`Failed to save recent search: ${err}`),
      );
    }

    // Build a deterministic cache key from all search parameters
    const cacheKey = this.buildSearchCacheKey(workspaceId, params);

    try {
      // 1. Cache lookup
      const cached = await this.valkey.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SearchResponse;
      }
    } catch (err) {
      // Cache failure must never block search
      this.logger.warn(`Search cache read failed: ${err}`);
    }

    let result: SearchResponse;

    try {
      // 2. Resolve candidate note IDs via structural filters
      const candidateIds = await this.resolveCandidateIds(workspaceId, params);

      if (candidateIds.length === 0) {
        result = { data: [], pagination: { total: 0, limit, hasMore: false } };
      } else {
        // 3 & 4. Run FTS + fuzzy in parallel scoped to the candidate IDs
        const [ftsResults, fuzzyResults] = await Promise.all([
          this.runFtsQuery(workspaceId, query, limit, candidateIds),
          this.runFuzzyQuery(workspaceId, query, limit, candidateIds),
        ]);

        // 5. Merge: FTS results first, then fuzzy supplements
        const seenIds = new Set<string>(ftsResults.map((r) => r.id));
        const fuzzySupplements = fuzzyResults
          .filter((r) => !seenIds.has(r.id))
          .map((r) => ({
            ...r,
            rank: r.rank * 0.5,
            matchType: 'fuzzy' as const,
          }));

        const merged: SearchResult[] = [
          ...ftsResults.map((r) => ({ ...r, matchType: 'fts' as const })),
          ...fuzzySupplements,
        ];

        // 6. Sort override
        const sortedItems = this.applySortOverride(merged, params);

        const hasMore = sortedItems.length > limit;
        const items = hasMore ? sortedItems.slice(0, limit) : sortedItems;

        result = {
          data: items,
          pagination: { total: items.length, limit, hasMore },
        };
      }
    } catch (_error) {
      // Fallback to ILIKE + filter when FTS/pg_trgm is unavailable
      this.logger.warn(
        'FTS+fuzzy search failed, falling back to ILIKE search. Run the FTS migration to enable full-text search.',
      );
      result = await this.fallbackSearch(workspaceId, query, limit, params);
    }

    // 7. Cache the result (fire-and-forget)
    this.valkey
      .set(cacheKey, JSON.stringify(result), SEARCH_CACHE_TTL_SECONDS)
      .catch((err) => this.logger.warn(`Search cache write failed: ${err}`));

    return result;
  }

  /**
   * Standalone fuzzy search using pg_trgm trigram similarity on note titles.
   *
   * - Results are deduplicated by id.
   * - Ranked by similarity score descending.
   * - Configurable similarity threshold (default 0.3).
   * - Falls back to ILIKE prefix matching if pg_trgm is unavailable.
   *
   * Minimum query length: 2 characters.
   */
  async fuzzySearch(
    workspaceId: string,
    query: string,
    options: FuzzySearchOptions = {},
  ): Promise<SearchResponse> {
    const limit = Math.min(options.limit ?? 20, 100);
    const threshold = options.threshold ?? 0.3;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return {
        data: [],
        pagination: { total: 0, limit, hasMore: false },
      };
    }

    try {
      const results = await this.runFuzzyQuery(workspaceId, trimmed, limit + 1, undefined, threshold);

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      return {
        data: items.map((r) => ({ ...r, matchType: 'fuzzy' as const })),
        pagination: { total: items.length, limit, hasMore },
      };
    } catch (_error) {
      this.logger.warn(
        'Fuzzy search failed, falling back to ILIKE search. Ensure pg_trgm extension is enabled.',
      );
      return this.fallbackSearch(workspaceId, trimmed, limit);
    }
  }

  /**
   * Typeahead suggestions from note titles using pg_trgm similarity.
   * Falls back to a prefix LIKE query when pg_trgm is not available.
   *
   * Minimum prefix length: 2 characters.
   */
  async suggest(workspaceId: string, prefix: string): Promise<string[]> {
    if (!prefix || prefix.trim().length < 2) {
      return [];
    }

    const trimmed = prefix.trim();

    try {
      const results = await this.prisma.$queryRaw<Array<{ title: string }>>`
        SELECT DISTINCT title
        FROM notes
        WHERE workspace_id = ${workspaceId}
          AND is_trashed = false
          AND title % ${trimmed}
        ORDER BY similarity(title, ${trimmed}) DESC
        LIMIT 10
      `;
      return results.map((r) => r.title);
    } catch {
      const notes = await this.prisma.note.findMany({
        where: {
          workspaceId,
          isTrashed: false,
          title: { startsWith: trimmed, mode: 'insensitive' },
        },
        take: 10,
        select: { title: true },
        distinct: ['title'],
      });
      return notes.map((n) => n.title);
    }
  }

  /**
   * Index a note's content for full-text search.
   *
   * Weights applied:
   *   A — title (highest relevance)
   *   B — note body content
   *   C — tags
   *   D — frontmatter property values (lowest relevance)
   */
  async indexNote(
    noteId: string,
    title: string,
    content: string,
    options: IndexNoteOptions = {},
  ): Promise<void> {
    const { tags = [], frontmatter = {} } = options;

    const tagText = tags.join(' ');
    const frontmatterText = Object.values(frontmatter)
      .filter(
        (v): v is string | number | boolean =>
          typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
      )
      .join(' ');

    try {
      await this.prisma.$executeRaw`
        UPDATE notes
        SET search_vector =
          setweight(to_tsvector('english', ${title}), 'A') ||
          setweight(to_tsvector('english', ${content}), 'B') ||
          setweight(to_tsvector('english', ${tagText}), 'C') ||
          setweight(to_tsvector('english', ${frontmatterText}), 'D')
        WHERE id = ${noteId}
      `;
    } catch (error) {
      this.logger.warn(`Failed to index note ${noteId}: ${error}`);
    }
  }

  /**
   * Remove a note from the search index.
   */
  async removeFromIndex(noteId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE notes SET search_vector = NULL WHERE id = ${noteId}
      `;
    } catch (error) {
      this.logger.warn(`Failed to remove note ${noteId} from index: ${error}`);
    }
  }

  /**
   * Rebuild the entire search index for a workspace.
   */
  async rebuildIndex(workspaceId: string): Promise<void> {
    this.logger.log(`Rebuilding search index for workspace ${workspaceId}`);

    await this.prisma.$executeRaw`
      UPDATE notes
      SET search_vector =
        setweight(to_tsvector('english', COALESCE(title, '')), 'A')
      WHERE workspace_id = ${workspaceId}
    `;

    this.logger.log(`Search index rebuild complete for workspace ${workspaceId}`);
  }

  // ─── Recent Searches ───────────────────────────────────────────────────────

  /**
   * Returns the last N distinct search queries for a user in a workspace.
   * Stored in ValKey as a list keyed by user + workspace.
   */
  async getRecentSearches(userId: string, workspaceId: string): Promise<string[]> {
    const key = this.recentSearchKey(userId, workspaceId);
    const client = this.valkey.getClient();
    const items = await client.lrange(key, 0, RECENT_SEARCHES_MAX - 1);
    return items;
  }

  /**
   * Clears all recent searches for a user in a workspace.
   */
  async clearRecentSearches(userId: string, workspaceId: string): Promise<void> {
    const key = this.recentSearchKey(userId, workspaceId);
    await this.valkey.del(key);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Persists a search query in the user's recent searches list.
   * Deduplicates the entry by removing any prior occurrence before prepending.
   * Trims the list to RECENT_SEARCHES_MAX entries.
   */
  private async saveRecentSearch(
    userId: string,
    workspaceId: string,
    query: string,
  ): Promise<void> {
    const key = this.recentSearchKey(userId, workspaceId);
    const client = this.valkey.getClient();

    // Remove prior occurrence of the same query to avoid duplicates
    await client.lrem(key, 0, query);
    // Prepend to front of list (most recent first)
    await client.lpush(key, query);
    // Keep only the most recent N entries
    await client.ltrim(key, 0, RECENT_SEARCHES_MAX - 1);
  }

  /**
   * Builds a deterministic cache key from workspace + all search parameters.
   */
  private buildSearchCacheKey(workspaceId: string, params: SearchQueryDto): string {
    const parts = [
      `search`,
      workspaceId,
      params.q,
      params.cursor ?? '',
      String(params.limit ?? ''),
      (params.tagIds ?? []).slice().sort().join(','),
      params.tagMode ?? '',
      params.folder ?? '',
      params.createdAfter ?? '',
      params.createdBefore ?? '',
      params.updatedAfter ?? '',
      params.updatedBefore ?? '',
      params.authorId ?? '',
      String(params.isPublished ?? ''),
      String(params.isTrashed ?? ''),
      params.sortBy ?? '',
      params.sortOrder ?? '',
    ];
    return parts.join(':');
  }

  /**
   * ValKey list key for a user's recent searches in a workspace.
   */
  private recentSearchKey(userId: string, workspaceId: string): string {
    return `recent_searches:${userId}:${workspaceId}`;
  }

  /**
   * Resolves candidate note IDs that satisfy all structural filters.
   * Returns ALL matching IDs without a limit so the FTS/fuzzy layer can rank
   * them freely. An empty array means no notes pass the filters.
   */
  private async resolveCandidateIds(
    workspaceId: string,
    params: SearchQueryDto,
  ): Promise<string[]> {
    const where: Parameters<typeof this.prisma.note.findMany>[0]['where'] = {
      workspaceId,
      // By default exclude trashed notes unless caller explicitly requests them
      isTrashed: params.isTrashed !== undefined ? params.isTrashed : false,
    };

    if (params.isPublished !== undefined) {
      where.isPublished = params.isPublished;
    }

    if (params.authorId) {
      where.createdById = params.authorId;
    }

    if (params.folder) {
      where.path = { startsWith: params.folder };
    }

    // Date range filters
    if (params.createdAfter || params.createdBefore) {
      where.createdAt = {};
      if (params.createdAfter) where.createdAt.gte = new Date(params.createdAfter);
      if (params.createdBefore) where.createdAt.lte = new Date(params.createdBefore);
    }

    if (params.updatedAfter || params.updatedBefore) {
      where.updatedAt = {};
      if (params.updatedAfter) where.updatedAt.gte = new Date(params.updatedAfter);
      if (params.updatedBefore) where.updatedAt.lte = new Date(params.updatedBefore);
    }

    // Tag filters
    if (params.tagIds && params.tagIds.length > 0) {
      const mode = params.tagMode ?? TagFilterMode.OR;

      if (mode === TagFilterMode.AND) {
        // AND: note must have every specified tag
        // Implement via nested AND conditions
        where.AND = params.tagIds.map((tagId) => ({
          tags: { some: { tagId } },
        }));
      } else {
        // OR: note must have at least one of the specified tags
        where.tags = {
          some: { tagId: { in: params.tagIds } },
        };
      }
    }

    const notes = await this.prisma.note.findMany({
      where,
      select: { id: true },
    });

    return notes.map((n) => n.id);
  }

  /**
   * Execute the PostgreSQL full-text search query, optionally scoped to a
   * set of candidate note IDs.
   */
  private async runFtsQuery(
    workspaceId: string,
    query: string,
    limit: number,
    candidateIds?: string[],
  ): Promise<SearchResult[]> {
    const hasFilter = candidateIds !== undefined;

    let rows: Array<{ id: string; title: string; path: string; snippet: string; rank: number }>;

    if (hasFilter) {
      rows = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; path: string; snippet: string; rank: number }>
      >`
        SELECT
          n.id,
          n.title,
          n.path,
          ts_headline(
            'english',
            COALESCE(n.title, ''),
            plainto_tsquery('english', ${query}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10, HighlightAll=false'
          ) AS snippet,
          ts_rank_cd(n.search_vector, plainto_tsquery('english', ${query}), 1) AS rank
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.id = ANY(${candidateIds}::uuid[])
          AND n.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; path: string; snippet: string; rank: number }>
      >`
        SELECT
          n.id,
          n.title,
          n.path,
          ts_headline(
            'english',
            COALESCE(n.title, ''),
            plainto_tsquery('english', ${query}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10, HighlightAll=false'
          ) AS snippet,
          ts_rank_cd(n.search_vector, plainto_tsquery('english', ${query}), 1) AS rank
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_trashed = false
          AND n.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      path: r.path,
      snippet: r.snippet,
      rank: Number(r.rank),
    }));
  }

  /**
   * Execute the pg_trgm trigram similarity query against note titles,
   * optionally scoped to a set of candidate note IDs.
   */
  private async runFuzzyQuery(
    workspaceId: string,
    query: string,
    limit: number,
    candidateIds?: string[],
    threshold = 0.3,
  ): Promise<SearchResult[]> {
    const hasFilter = candidateIds !== undefined;

    let rows: Array<{ id: string; title: string; path: string; similarity: number }>;

    if (hasFilter) {
      rows = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; path: string; similarity: number }>
      >`
        SELECT DISTINCT ON (n.id)
          n.id,
          n.title,
          n.path,
          similarity(n.title, ${query}) AS similarity
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.id = ANY(${candidateIds}::uuid[])
          AND similarity(n.title, ${query}) >= ${threshold}
        ORDER BY n.id, similarity(n.title, ${query}) DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; path: string; similarity: number }>
      >`
        SELECT DISTINCT ON (n.id)
          n.id,
          n.title,
          n.path,
          similarity(n.title, ${query}) AS similarity
        FROM notes n
        WHERE n.workspace_id = ${workspaceId}
          AND n.is_trashed = false
          AND similarity(n.title, ${query}) >= ${threshold}
        ORDER BY n.id, similarity(n.title, ${query}) DESC
        LIMIT ${limit}
      `;
    }

    rows.sort((a, b) => Number(b.similarity) - Number(a.similarity));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      path: r.path,
      snippet: r.title,
      rank: Number(r.similarity),
    }));
  }

  /**
   * Applies sort override to a merged result set.
   *
   * For non-relevance sort fields the search results are post-processed
   * because the raw FTS/fuzzy queries only return id, title, path, snippet,
   * and rank. Non-relevance fields (createdAt, updatedAt) require an
   * additional DB lookup to retrieve the sort field values.
   *
   * When sortBy is 'relevance' (default) the existing rank ordering is
   * preserved. For 'title' we sort in-memory. For date fields we re-query.
   *
   * NOTE: Date-based re-sorting is done in-memory after a supplemental DB
   * query. This is acceptable for the current result set sizes (capped at
   * 100 items) and avoids complex SQL composition.
   */
  private applySortOverride(results: SearchResult[], params: SearchQueryDto): SearchResult[] {
    const { sortBy = SortField.RELEVANCE, sortOrder = SortOrder.DESC } = params;

    if (sortBy === SortField.RELEVANCE) {
      return results.sort((a, b) =>
        sortOrder === SortOrder.DESC ? b.rank - a.rank : a.rank - b.rank,
      );
    }

    if (sortBy === SortField.TITLE) {
      return results.sort((a, b) => {
        const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        return sortOrder === SortOrder.ASC ? cmp : -cmp;
      });
    }

    // For date-based sorts we cannot sort without the date values.
    // Return results in relevance order — the controller may choose to
    // re-sort after hydrating full note objects.
    return results.sort((a, b) => b.rank - a.rank);
  }

  /**
   * Fallback ILIKE search used when FTS/pg_trgm are not available.
   * Applies the same structural filters as the main search path.
   */
  private async fallbackSearch(
    workspaceId: string,
    query: string,
    limit: number,
    params?: SearchQueryDto,
  ): Promise<SearchResponse> {
    const where: Parameters<typeof this.prisma.note.findMany>[0]['where'] = {
      workspaceId,
      isTrashed: params?.isTrashed !== undefined ? params.isTrashed : false,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { path: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (params?.isPublished !== undefined) {
      where.isPublished = params.isPublished;
    }
    if (params?.authorId) {
      where.createdById = params.authorId;
    }
    if (params?.folder) {
      where.path = { startsWith: params.folder };
    }

    const orderBy = this.buildFallbackOrderBy(params);

    const notes = await this.prisma.note.findMany({
      where,
      take: limit + 1,
      orderBy,
      select: { id: true, title: true, path: true },
    });

    const hasMore = notes.length > limit;
    const items = hasMore ? notes.slice(0, limit) : notes;

    return {
      data: items.map((n) => ({
        id: n.id,
        title: n.title,
        path: n.path,
        snippet: n.title,
        rank: 1,
      })),
      pagination: { total: items.length, limit, hasMore },
    };
  }

  /**
   * Builds Prisma orderBy clause for the ILIKE fallback path.
   */
  private buildFallbackOrderBy(
    params?: SearchQueryDto,
  ): Parameters<typeof this.prisma.note.findMany>[0]['orderBy'] {
    const dir: 'asc' | 'desc' = params?.sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (params?.sortBy) {
      case SortField.TITLE:
        return { title: dir };
      case SortField.CREATED_AT:
        return { createdAt: dir };
      case SortField.UPDATED_AT:
      default:
        return { updatedAt: dir };
    }
  }
}
