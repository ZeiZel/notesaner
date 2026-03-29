import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../embedding.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockValkeyService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockConfigService = {
  get: vi.fn((key: string): string | undefined => {
    const values: Record<string, string> = {
      'embedding.provider': 'openai',
      'embedding.model': 'text-embedding-3-small',
      'embedding.openaiApiKey': 'sk-test-key',
    };
    return values[key];
  }),
};

// Shared mock for the OpenAI embeddings.create method
const mockEmbeddingsCreate = vi.fn();

// Stub the OpenAI SDK so we do not make real HTTP calls.
// The default export is a class (constructor), so we use vi.fn() as the
// constructor and set its prototype's embeddings property in the factory.
vi.mock('openai', () => {
  function MockOpenAI() {
    return {
      embeddings: { create: mockEmbeddingsCreate },
    };
  }
  return { default: MockOpenAI };
});

function buildMockOpenAIResponse(vectors: number[][]): object {
  return {
    data: vectors.map((embedding, index) => ({ index, embedding })),
    model: 'text-embedding-3-small',
    usage: { prompt_tokens: 10, total_tokens: 10 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache miss
    mockValkeyService.get.mockResolvedValue(null);
    mockValkeyService.set.mockResolvedValue(undefined);
    mockValkeyService.del.mockResolvedValue(1);

    service = new EmbeddingService(mockValkeyService as never, mockConfigService as never);
  });

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  describe('configuration', () => {
    it('reports available when API key is present', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('reports unavailable when API key is missing', () => {
      const noKeyConfig = {
        get: vi.fn((key: string): string | undefined => {
          const values: Record<string, string> = {
            'embedding.provider': 'openai',
            'embedding.model': 'text-embedding-3-small',
          };
          return values[key];
        }),
      };
      const disabledService = new EmbeddingService(
        mockValkeyService as never,
        noKeyConfig as never,
      );
      expect(disabledService.isAvailable()).toBe(false);
    });

    it('returns the configured model name', () => {
      expect(service.getModel()).toBe('text-embedding-3-small');
    });
  });

  // -------------------------------------------------------------------------
  // embed (single)
  // -------------------------------------------------------------------------

  describe('embed', () => {
    it('returns a vector for a single text input', async () => {
      const mockCreate = await getOpenAIMockCreate();
      mockCreate.mockResolvedValue(buildMockOpenAIResponse([[0.1, 0.2, 0.3]]));

      const vector = await service.embed('hello world');

      expect(vector).toEqual([0.1, 0.2, 0.3]);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('returns cached vector without calling the API', async () => {
      const cachedVector = [0.5, 0.6, 0.7];
      mockValkeyService.get.mockResolvedValue(JSON.stringify(cachedVector));

      const mockCreate = await getOpenAIMockCreate();

      const vector = await service.embed('cached text');

      expect(vector).toEqual(cachedVector);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('stores freshly generated vector in cache', async () => {
      const mockCreate = await getOpenAIMockCreate();
      mockCreate.mockResolvedValue(buildMockOpenAIResponse([[0.1, 0.2, 0.3]]));

      await service.embed('new text');

      expect(mockValkeyService.set).toHaveBeenCalledOnce();
      const [, rawValue, ttl] = mockValkeyService.set.mock.calls[0] as [string, string, number];
      expect(JSON.parse(rawValue)).toEqual([0.1, 0.2, 0.3]);
      expect(ttl).toBeGreaterThan(0);
    });

    it('throws when embedding service is not configured', async () => {
      const noKeyConfig = {
        get: vi.fn((_key: string): string | undefined => undefined),
      };
      const disabledService = new EmbeddingService(
        mockValkeyService as never,
        noKeyConfig as never,
      );

      await expect(disabledService.embed('test')).rejects.toThrow(/not configured/i);
    });

    it('propagates API errors', async () => {
      const mockCreate = await getOpenAIMockCreate();
      mockCreate.mockRejectedValue(new Error('API rate limit'));

      await expect(service.embed('error text')).rejects.toThrow('API rate limit');
    });
  });

  // -------------------------------------------------------------------------
  // embedBatch
  // -------------------------------------------------------------------------

  describe('embedBatch', () => {
    it('returns empty array for empty input', async () => {
      const results = await service.embedBatch([]);
      expect(results).toEqual([]);
    });

    it('returns results in the same order as inputs', async () => {
      const mockCreate = await getOpenAIMockCreate();
      // Return in reversed order to verify sorting by index
      mockCreate.mockResolvedValue({
        data: [
          { index: 1, embedding: [0.4, 0.5] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      });

      const results = await service.embedBatch(['first', 'second']);

      expect(results[0]?.vector).toEqual([0.1, 0.2]);
      expect(results[1]?.vector).toEqual([0.4, 0.5]);
    });

    it('skips API for fully-cached batch', async () => {
      mockValkeyService.get
        .mockResolvedValueOnce(JSON.stringify([1, 2, 3]))
        .mockResolvedValueOnce(JSON.stringify([4, 5, 6]));

      const mockCreate = await getOpenAIMockCreate();
      const results = await service.embedBatch(['text1', 'text2']);

      expect(results).toHaveLength(2);
      expect(results[0]?.fromCache).toBe(true);
      expect(results[1]?.fromCache).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('calls API only for uncached items in a mixed batch', async () => {
      // First text is cached, second is not
      mockValkeyService.get
        .mockResolvedValueOnce(JSON.stringify([1, 2, 3]))
        .mockResolvedValueOnce(null);

      const mockCreate = await getOpenAIMockCreate();
      mockCreate.mockResolvedValue(buildMockOpenAIResponse([[4, 5, 6]]));

      const results = await service.embedBatch(['cached-text', 'new-text']);

      expect(results[0]?.fromCache).toBe(true);
      expect(results[0]?.vector).toEqual([1, 2, 3]);
      expect(results[1]?.fromCache).toBe(false);
      expect(results[1]?.vector).toEqual([4, 5, 6]);

      // API called once for the single uncached item
      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // invalidateCache
  // -------------------------------------------------------------------------

  describe('invalidateCache', () => {
    it('deletes the cache key for the given text', async () => {
      await service.invalidateCache('some note content');
      expect(mockValkeyService.del).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // hashContent
  // -------------------------------------------------------------------------

  describe('hashContent', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
      const hash = service.hashContent('hello world');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('returns the same hash for identical inputs', () => {
      const h1 = service.hashContent('same text');
      const h2 = service.hashContent('same text');
      expect(h1).toBe(h2);
    });

    it('returns different hashes for different inputs', () => {
      const h1 = service.hashContent('text A');
      const h2 = service.hashContent('text B');
      expect(h1).not.toBe(h2);
    });
  });
});
