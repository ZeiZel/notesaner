import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import type { SearchResult } from './search.service';
import { SearchService } from './search.service';

/**
 * Row shape returned by the pgvector cosine-similarity query.
 */
interface SimilarityRow {
  id: string;
  workspace_id: string;
  path: string;
  title: string;
  updated_at: Date;
  /** 1 - cosine_distance: ranges from -1 (opposite) to 1 (identical) */
  similarity: number;
}

/**
 * A single result from semantic search, extending the base SearchResult with
 * a similarity score in [0, 1].
 */
export interface SemanticSearchResult extends SearchResult {
  similarity: number;
}

export interface SemanticSearchPage {
  results: SemanticSearchResult[];
  total: number;
  /** True when results came from full-text fallback (embeddings unavailable). */
  isFallback: boolean;
}

/**
 * SemanticSearchService — vector similarity search over note embeddings.
 *
 * Flow:
 *  1. Generate an embedding for the user's natural-language query.
 *  2. Run a pgvector cosine-similarity query against note_embeddings.
 *  3. Return ranked results by similarity score.
 *
 * When the EmbeddingService is unavailable (no API key configured), the
 * service transparently falls back to full-text search so the endpoint
 * always returns useful results.
 */
@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Perform semantic (vector similarity) search across notes in a workspace.
   *
   * @param workspaceId  Target workspace UUID
   * @param params.q     Natural language query
   * @param params.limit Max results (default 20, max 100)
   * @returns            Ranked results with similarity scores; falls back to FTS
   */
  async semanticSearch(
    workspaceId: string,
    params: { q: string; limit?: number },
  ): Promise<SemanticSearchPage> {
    const { q, limit = 20 } = params;
    const pageSize = Math.min(Math.max(limit, 1), 100);

    if (!q.trim()) {
      return { results: [], total: 0, isFallback: false };
    }

    // Fall back to FTS if embeddings are not configured
    if (!this.embeddingService.isAvailable()) {
      this.logger.debug('EmbeddingService unavailable — falling back to FTS for semantic search');
      return this.ftsPlaceholder(workspaceId, q, pageSize);
    }

    try {
      const queryVector = await this.embeddingService.embed(q);
      return await this.runVectorSearch(workspaceId, queryVector, pageSize);
    } catch (error) {
      this.logger.error('Semantic search failed — falling back to full-text search', error);
      return this.ftsPlaceholder(workspaceId, q, pageSize);
    }
  }

  /**
   * Store or update an embedding for a note.
   *
   * Skips the upsert if the content hash has not changed, avoiding
   * unnecessary API calls and DB writes on unchanged notes.
   *
   * @param noteId      UUID of the note
   * @param workspaceId UUID of the workspace
   * @param content     Plain-text content to embed (title + body recommended)
   */
  async upsertEmbedding(noteId: string, workspaceId: string, content: string): Promise<void> {
    if (!this.embeddingService.isAvailable()) {
      return;
    }

    const contentHash = this.embeddingService.hashContent(content);
    const model = this.embeddingService.getModel();

    // Check whether the stored embedding is still valid
    const existing = await this.prisma.$queryRaw<Array<{ content_hash: string }>>`
      SELECT "content_hash"
      FROM "note_embeddings"
      WHERE "note_id" = ${noteId}
      LIMIT 1
    `;

    if (existing[0]?.content_hash === contentHash) {
      this.logger.debug(`Embedding for note ${noteId} is up-to-date, skipping`);
      return;
    }

    try {
      const vector = await this.embeddingService.embed(content);
      const vectorLiteral = `[${vector.join(',')}]`;
      const id = randomUUID();
      const now = new Date();

      await this.prisma.$executeRaw`
        INSERT INTO "note_embeddings"
          ("id", "note_id", "workspace_id", "model", "embedding", "content_hash", "created_at", "updated_at")
        VALUES
          (${id}, ${noteId}, ${workspaceId}, ${model}, ${vectorLiteral}::vector, ${contentHash}, ${now}, ${now})
        ON CONFLICT ("note_id") DO UPDATE
          SET "embedding"     = EXCLUDED."embedding",
              "content_hash"  = EXCLUDED."content_hash",
              "model"         = EXCLUDED."model",
              "updated_at"    = EXCLUDED."updated_at"
      `;

      this.logger.debug(`Upserted embedding for note ${noteId}`);
    } catch (error) {
      this.logger.error(`Failed to upsert embedding for note ${noteId}`, error);
      throw error;
    }
  }

  /**
   * Remove the stored embedding for a note (e.g. when it is trashed or deleted).
   *
   * @param noteId UUID of the note whose embedding should be removed
   */
  async removeEmbedding(noteId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "note_embeddings"
      WHERE "note_id" = ${noteId}
    `;
    this.logger.debug(`Removed embedding for note ${noteId}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async runVectorSearch(
    workspaceId: string,
    queryVector: number[],
    limit: number,
  ): Promise<SemanticSearchPage> {
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const rows = await this.prisma.$queryRaw<SimilarityRow[]>`
      SELECT
        n."id",
        n."workspace_id",
        n."path",
        n."title",
        n."updated_at",
        1 - (ne."embedding" <=> ${vectorLiteral}::vector) AS similarity
      FROM "note_embeddings" ne
      JOIN "notes" n ON n."id" = ne."note_id"
      WHERE n."workspace_id" = ${workspaceId}
        AND n."is_trashed" = false
      ORDER BY ne."embedding" <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `;

    const results: SemanticSearchResult[] = rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      path: row.path,
      title: row.title,
      // Semantic search does not produce ts_headline snippets
      snippet: '',
      rank: row.similarity,
      updatedAt: row.updated_at,
      similarity: row.similarity,
    }));

    return { results, total: results.length, isFallback: false };
  }

  /**
   * Thin wrapper around SearchService.search to produce a SemanticSearchPage
   * from FTS results when embeddings are unavailable.
   */
  private async ftsPlaceholder(
    workspaceId: string,
    q: string,
    limit: number,
  ): Promise<SemanticSearchPage> {
    try {
      const ftsPage = await this.searchService.search(workspaceId, { q, limit });
      const results: SemanticSearchResult[] = ftsPage.results.map((r: SearchResult) => ({
        ...r,
        similarity: r.rank,
      }));
      return {
        results,
        total: ftsPage.total,
        isFallback: true,
      };
    } catch {
      return { results: [], total: 0, isFallback: true };
    }
  }
}
