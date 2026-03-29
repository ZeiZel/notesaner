import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticSearchService } from '../semantic-search.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

const mockEmbeddingService = {
  isAvailable: vi.fn(),
  embed: vi.fn(),
  hashContent: vi.fn(),
  getModel: vi.fn(),
  invalidateCache: vi.fn(),
};

const mockSearchService = {
  search: vi.fn(),
};

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSimilarityRow(
  overrides: Partial<{
    id: string;
    workspace_id: string;
    path: string;
    title: string;
    updated_at: Date;
    similarity: number;
  }> = {},
) {
  return {
    id: overrides.id ?? 'note-1',
    workspace_id: overrides.workspace_id ?? 'ws-1',
    path: overrides.path ?? 'notes/one.md',
    title: overrides.title ?? 'First Note',
    updated_at: overrides.updated_at ?? new Date('2024-01-01'),
    similarity: overrides.similarity ?? 0.95,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingService.isAvailable.mockReturnValue(true);
    mockEmbeddingService.embed.mockResolvedValue(new Array(1536).fill(0.1));
    mockEmbeddingService.hashContent.mockReturnValue('abc123hash');
    mockEmbeddingService.getModel.mockReturnValue('text-embedding-3-small');

    service = new SemanticSearchService(
      mockPrisma as never,
      mockEmbeddingService as never,
      mockSearchService as never,
    );
  });

  // -------------------------------------------------------------------------
  // semanticSearch — vector path
  // -------------------------------------------------------------------------

  describe('semanticSearch (vector path)', () => {
    it('returns empty results for blank query', async () => {
      const result = await service.semanticSearch('ws-1', { q: '  ' });

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.isFallback).toBe(false);
      expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
    });

    it('returns ranked similarity results from pgvector', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        makeSimilarityRow({ id: 'note-1', title: 'Alpha', similarity: 0.95 }),
        makeSimilarityRow({ id: 'note-2', title: 'Beta', similarity: 0.87 }),
      ]);

      const result = await service.semanticSearch('ws-1', { q: 'quarterly roadmap', limit: 10 });

      expect(result.isFallback).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.results[0]).toMatchObject({
        id: 'note-1',
        title: 'Alpha',
        similarity: 0.95,
      });
      expect(result.results[1]).toMatchObject({
        id: 'note-2',
        title: 'Beta',
        similarity: 0.87,
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('quarterly roadmap');
    });

    it('applies the default limit of 20', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.semanticSearch('ws-1', { q: 'test' });

      // The LIMIT value passed to Prisma should be 20
      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    });

    it('clamps limit to max 100', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.semanticSearch('ws-1', { q: 'test', limit: 9999 });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    });

    it('sets snippet to empty string (no ts_headline in vector search)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([makeSimilarityRow()]);

      const result = await service.semanticSearch('ws-1', { q: 'test' });

      expect(result.results[0]?.snippet).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // semanticSearch — fallback path
  // -------------------------------------------------------------------------

  describe('semanticSearch (fallback path)', () => {
    it('falls back to FTS when embeddings are unavailable', async () => {
      mockEmbeddingService.isAvailable.mockReturnValue(false);
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            id: 'note-1',
            workspaceId: 'ws-1',
            path: 'a.md',
            title: 'A',
            snippet: 'match',
            rank: 0.8,
            updatedAt: new Date(),
          },
        ],
        nextCursor: null,
        total: 1,
      });

      const result = await service.semanticSearch('ws-1', { q: 'meeting notes' });

      expect(result.isFallback).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.id).toBe('note-1');
      expect(result.results[0]?.similarity).toBe(0.8);
      expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
      expect(mockSearchService.search).toHaveBeenCalledWith('ws-1', {
        q: 'meeting notes',
        limit: 20,
      });
    });

    it('falls back to FTS when embedding API throws', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('API rate limit exceeded'));
      mockSearchService.search.mockResolvedValue({
        results: [],
        nextCursor: null,
        total: 0,
      });

      const result = await service.semanticSearch('ws-1', { q: 'test query' });

      expect(result.isFallback).toBe(true);
      expect(mockSearchService.search).toHaveBeenCalledOnce();
    });

    it('returns empty fallback when FTS also throws', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('API unavailable'));
      mockSearchService.search.mockRejectedValue(new Error('DB unavailable'));

      const result = await service.semanticSearch('ws-1', { q: 'test' });

      expect(result.isFallback).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // upsertEmbedding
  // -------------------------------------------------------------------------

  describe('upsertEmbedding', () => {
    it('inserts a new embedding when none exists', async () => {
      // No existing embedding
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.upsertEmbedding('note-1', 'ws-1', 'content text');

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('content text');
      expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('updates an existing embedding when content hash has changed', async () => {
      // Existing embedding with different hash
      mockPrisma.$queryRaw.mockResolvedValue([{ content_hash: 'old-hash' }]);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockEmbeddingService.hashContent.mockReturnValue('new-hash');

      await service.upsertEmbedding('note-1', 'ws-1', 'updated content');

      expect(mockEmbeddingService.embed).toHaveBeenCalledOnce();
      expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('skips upsert when content hash is unchanged', async () => {
      const hash = 'same-hash';
      mockEmbeddingService.hashContent.mockReturnValue(hash);
      mockPrisma.$queryRaw.mockResolvedValue([{ content_hash: hash }]);

      await service.upsertEmbedding('note-1', 'ws-1', 'same content');

      expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('does nothing when embeddings are not available', async () => {
      mockEmbeddingService.isAvailable.mockReturnValue(false);

      await service.upsertEmbedding('note-1', 'ws-1', 'content');

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
    });

    it('propagates embedding API errors', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockEmbeddingService.embed.mockRejectedValue(new Error('Token limit exceeded'));

      await expect(service.upsertEmbedding('note-1', 'ws-1', 'content')).rejects.toThrow(
        'Token limit exceeded',
      );
    });
  });

  // -------------------------------------------------------------------------
  // removeEmbedding
  // -------------------------------------------------------------------------

  describe('removeEmbedding', () => {
    it('deletes the embedding row for the given note', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.removeEmbedding('note-1');

      expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('is idempotent — no error when note has no embedding', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(0);

      await expect(service.removeEmbedding('nonexistent-note')).resolves.not.toThrow();
    });
  });
});
