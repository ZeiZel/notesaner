import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';

export interface SearchResult {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  /** Highlighted snippet extracted by PostgreSQL ts_headline. */
  snippet: string;
  /** ts_rank score for ordering. */
  rank: number;
  updatedAt: Date;
}

export interface SearchPage {
  results: SearchResult[];
  /** Opaque cursor for the next page, null when no more results. */
  nextCursor: string | null;
  total: number;
}

/** Raw row returned by the FTS search query */
interface FtsRow {
  id: string;
  workspace_id: string;
  path: string;
  title: string;
  snippet: string;
  rank: number;
  updated_at: Date;
}

/** Raw row for suggest query */
interface SuggestRow {
  word: string;
}

/** Raw row for count query */
interface CountRow {
  count: bigint;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Full-text search across notes in a workspace.
   *
   * Uses PostgreSQL ts_rank with the weighted search_vector column.
   * Returns a paginated result set using cursor-based pagination on note IDs.
   *
   * @param workspaceId Target workspace
   * @param params.q    Search query string (plain text — not tsquery syntax)
   * @param params.cursor  Opaque cursor from a previous page
   * @param params.limit   Page size (default 20, max 100)
   */
  async search(
    workspaceId: string,
    params: { q: string; cursor?: string; limit?: number },
  ): Promise<SearchPage> {
    const { q, cursor, limit = 20 } = params;
    const pageSize = Math.min(Math.max(limit, 1), 100);

    if (!q.trim()) {
      return { results: [], nextCursor: null, total: 0 };
    }

    // Sanitize the query for plainto_tsquery — prevents syntax errors from
    // user input while still giving sensible FTS behavior.
    const sanitizedQuery = q.trim().slice(0, 1_000);

    // Count total matches (for UI pagination hints)
    const countRows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "notes"
      WHERE "workspace_id" = ${workspaceId}
        AND "is_trashed" = false
        AND "search_vector" @@ plainto_tsquery('english', ${sanitizedQuery})
    `;
    const total = Number(countRows[0]?.count ?? 0);

    // Fetch ranked results with optional cursor
    let rows: FtsRow[];
    if (cursor) {
      rows = await this.prisma.$queryRaw<FtsRow[]>`
        SELECT
          n."id",
          n."workspace_id",
          n."path",
          n."title",
          ts_headline(
            'english',
            n."title",
            plainto_tsquery('english', ${sanitizedQuery}),
            'MaxFragments=2, MaxWords=20, MinWords=5'
          ) AS snippet,
          ts_rank_cd(n."search_vector", plainto_tsquery('english', ${sanitizedQuery})) AS rank,
          n."updated_at"
        FROM "notes" n
        WHERE n."workspace_id" = ${workspaceId}
          AND n."is_trashed" = false
          AND n."search_vector" @@ plainto_tsquery('english', ${sanitizedQuery})
          AND n."id" > ${cursor}
        ORDER BY rank DESC, n."id" ASC
        LIMIT ${pageSize + 1}
      `;
    } else {
      rows = await this.prisma.$queryRaw<FtsRow[]>`
        SELECT
          n."id",
          n."workspace_id",
          n."path",
          n."title",
          ts_headline(
            'english',
            n."title",
            plainto_tsquery('english', ${sanitizedQuery}),
            'MaxFragments=2, MaxWords=20, MinWords=5'
          ) AS snippet,
          ts_rank_cd(n."search_vector", plainto_tsquery('english', ${sanitizedQuery})) AS rank,
          n."updated_at"
        FROM "notes" n
        WHERE n."workspace_id" = ${workspaceId}
          AND n."is_trashed" = false
          AND n."search_vector" @@ plainto_tsquery('english', ${sanitizedQuery})
        ORDER BY rank DESC, n."id" ASC
        LIMIT ${pageSize + 1}
      `;
    }

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

    const results: SearchResult[] = pageRows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      path: row.path,
      title: row.title,
      snippet: row.snippet,
      rank: row.rank,
      updatedAt: row.updated_at,
    }));

    return { results, nextCursor, total };
  }

  /**
   * Auto-complete suggestions based on the search index lexemes.
   *
   * Queries the ts_stat view over the workspace notes to return completions
   * that match the given prefix, sorted by document frequency.
   *
   * @param workspaceId Target workspace
   * @param prefix      Prefix to complete (min 2 chars to avoid noise)
   */
  async suggest(workspaceId: string, prefix: string): Promise<string[]> {
    const trimmedPrefix = prefix.trim();
    if (trimmedPrefix.length < 2) return [];

    const rows = await this.prisma.$queryRaw<SuggestRow[]>`
      SELECT word
      FROM ts_stat(
        'SELECT search_vector FROM notes WHERE workspace_id = ' ||
        quote_literal(${workspaceId}) ||
        ' AND is_trashed = false AND search_vector IS NOT NULL'
      )
      WHERE word ILIKE ${trimmedPrefix + '%'}
      ORDER BY ndoc DESC, nentry DESC
      LIMIT 10
    `;

    return rows.map((r) => r.word);
  }

  /**
   * Index a single note by scheduling a BullMQ job.
   *
   * @param noteId      UUID of the note to index
   * @param workspaceId UUID of the owning workspace
   * @param filePath    Absolute path to the note's .md file on disk
   */
  async indexNote(noteId: string, workspaceId: string, filePath: string): Promise<void> {
    await this.jobsService.scheduleNoteIndex(noteId, workspaceId, filePath);
  }

  /**
   * Clear the search_vector for a trashed or deleted note.
   *
   * @param noteId UUID of the note to remove from index
   */
  async removeFromIndex(noteId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "notes"
      SET "search_vector" = NULL, "frontmatter_search" = NULL
      WHERE "id" = ${noteId}::uuid
    `;
    this.logger.debug(`Cleared search index for note ${noteId}`);
  }

  /**
   * Schedule a full workspace reindex via BullMQ.
   * Called by the admin batch endpoint.
   *
   * @param workspaceId UUID of the workspace to reindex
   * @returns BullMQ job ID for status polling
   */
  async rebuildIndex(workspaceId: string): Promise<string> {
    return this.jobsService.scheduleWorkspaceReindex(workspaceId);
  }
}
