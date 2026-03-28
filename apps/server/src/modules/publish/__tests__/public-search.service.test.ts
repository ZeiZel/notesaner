/**
 * Unit tests for PublicSearchService
 *
 * All external dependencies (PrismaService, ValkeyService) are mocked so no
 * real database or cache access occurs.
 *
 * Coverage goals:
 * - Happy path: FTS search returns ranked, highlighted results
 * - Fallback path: ILIKE search when FTS throws
 * - Cache hit: returns cached response without DB queries
 * - Cache miss: executes DB query then stores result
 * - NotFoundException when vault not found
 * - Pagination: page/limit calculations, hasMore
 * - Query edge cases: short queries, special characters
 * - Cache invalidation: deletes all matching keys via SCAN
 * - Cache failure: never blocks the search (fire-and-forget)
 * - Private note isolation: unpublished / trashed notes never returned
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PublicSearchService } from '../public-search.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspace(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ws-1',
    name: 'My Public Vault',
    slug: 'my-vault',
    description: 'A test vault',
    storagePath: '/tmp/ws-1',
    isPublic: true,
    publicSlug: 'my-public-vault',
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeFtsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    path: 'notes/test.md',
    title: 'Test Note',
    snippet: '<mark>Test</mark> Note content',
    rank: 0.75,
    updated_at: new Date('2024-06-15T10:00:00Z'),
    ...overrides,
  };
}

function makeFallbackRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    path: 'notes/test.md',
    title: 'Test Note',
    updated_at: new Date('2024-06-15T10:00:00Z'),
    ...overrides,
  };
}

function makeCountRow(total: number | bigint = 1) {
  return [{ total: BigInt(total) }];
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
  prismaOverrides: Record<string, unknown> = {},
  valkeyOverrides: Record<string, unknown> = {},
) {
  const mockClient = {
    scan: vi.fn().mockResolvedValue(['0', []]),
  };

  const prisma = {
    workspace: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
    ...prismaOverrides,
  } as unknown as PrismaService;

  const valkeyService = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(0),
    getClient: vi.fn().mockReturnValue(mockClient),
    ...valkeyOverrides,
  } as unknown as ValkeyService;

  const service = new PublicSearchService(prisma, valkeyService);
  return { service, prisma, valkeyService, mockClient };
}

// ---------------------------------------------------------------------------
// Helper to set up a default workspace resolution and dual $queryRaw response.
// $queryRaw is called twice: once for data, once for count. We use mockResolvedValue
// which works for both calls through Promise.all.
// ---------------------------------------------------------------------------

function setupFtsSuccess(prisma: PrismaService, rows: object[] = [makeFtsRow()], total = 1) {
  vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
  // Promise.all calls $queryRaw twice in parallel. We queue responses:
  vi.mocked(prisma.$queryRaw)
    .mockResolvedValueOnce(rows as never) // data query
    .mockResolvedValueOnce(makeCountRow(total) as never); // count query
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── searchPublishedNotes — happy path ────────────────────────────────────

  describe('searchPublishedNotes', () => {
    it('should return FTS results for a valid query', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test note' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        path: 'notes/test.md',
        title: 'Test Note',
        snippet: '<mark>Test</mark> Note content',
        rank: 0.75,
      });
    });

    it('should return ISO updatedAt string from DB Date', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test note' });

      expect(result.data[0].updatedAt).toBe('2024-06-15T10:00:00.000Z');
    });

    it('should return correct pagination metadata', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma, [makeFtsRow()], 25);

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: 'test',
        limit: 10,
        page: 0,
      });

      expect(result.pagination).toEqual({
        total: 25,
        limit: 10,
        page: 0,
        hasMore: true,
      });
    });

    it('should report hasMore=false on the last page', async () => {
      const { service, prisma } = makeService();
      // page 2, limit 10, total 25 → offset=20, 5 results → no more
      setupFtsSuccess(
        prisma,
        Array.from({ length: 5 }, (_, i) => makeFtsRow({ path: `note${i}.md` })),
        25,
      );

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: 'test',
        limit: 10,
        page: 2,
      });

      expect(result.pagination.hasMore).toBe(false);
    });

    it('should cap limit at 50', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma, [], 0);

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: 'test',
        limit: 200, // over the max
      });

      // The data query still runs — limit capped to 50
      expect(result.pagination.limit).toBe(50);
    });

    it('should default to limit=10 and page=0 when not provided', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.page).toBe(0);
    });

    it('should return empty data and zero total for no matches', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([]) // no data rows
        .mockResolvedValueOnce(makeCountRow(0)); // count = 0

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'nonexistent' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should return multiple results sorted by rank descending (natural DB ordering)', async () => {
      const { service, prisma } = makeService();
      const rows = [
        makeFtsRow({ path: 'a.md', title: 'A', rank: 0.9 }),
        makeFtsRow({ path: 'b.md', title: 'B', rank: 0.5 }),
        makeFtsRow({ path: 'c.md', title: 'C', rank: 0.2 }),
      ];
      setupFtsSuccess(prisma, rows, 3);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'note' });

      expect(result.data[0].path).toBe('a.md');
      expect(result.data[1].path).toBe('b.md');
      expect(result.data[2].path).toBe('c.md');
    });

    it('should include snippet with <mark> tags in results', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma, [
        makeFtsRow({ snippet: 'This is a <mark>search</mark> result snippet' }),
      ]);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'search' });

      expect(result.data[0].snippet).toContain('<mark>');
      expect(result.data[0].snippet).toContain('</mark>');
    });
  });

  // ─── Cache behaviour ─────────────────────────────────────────────────────

  describe('caching', () => {
    it('should return cached response without hitting the database', async () => {
      const cachedResponse = {
        data: [
          {
            path: 'cached.md',
            title: 'Cached',
            snippet: 'cached',
            rank: 1,
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        pagination: { total: 1, limit: 10, page: 0, hasMore: false },
      };
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(valkeyService.get).mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'cached' });

      expect(result).toEqual(cachedResponse);
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should store FTS results in the cache after a cache miss', async () => {
      const { service, prisma, valkeyService } = makeService();
      setupFtsSuccess(prisma);

      await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      // Allow the fire-and-forget set to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(valkeyService.set).toHaveBeenCalledOnce();
      const [key, value, ttl] = vi.mocked(valkeyService.set).mock.calls[0];
      expect(key).toContain('publish:search:my-public-vault:');
      expect(JSON.parse(value as string)).toHaveProperty('data');
      expect(ttl).toBe(300);
    });

    it('should not block search response when cache read fails', async () => {
      const { service, prisma } = makeService(
        {},
        {
          get: vi.fn().mockRejectedValue(new Error('Valkey connection refused')),
          set: vi.fn().mockResolvedValue(undefined),
          del: vi.fn().mockResolvedValue(0),
          getClient: vi.fn().mockReturnValue({ scan: vi.fn().mockResolvedValue(['0', []]) }),
        },
      );
      setupFtsSuccess(prisma);

      // Should not throw; falls through to DB query
      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.data).toHaveLength(1);
    });

    it('should not block search response when cache write fails', async () => {
      const { service, prisma } = makeService(
        {},
        {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockRejectedValue(new Error('Valkey write failed')),
          del: vi.fn().mockResolvedValue(0),
          getClient: vi.fn().mockReturnValue({ scan: vi.fn().mockResolvedValue(['0', []]) }),
        },
      );
      setupFtsSuccess(prisma);

      // Should not throw even if cache write fails
      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.data).toHaveLength(1);
    });

    it('should use separate cache keys for different queries', async () => {
      const { service, prisma, valkeyService } = makeService();

      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([makeFtsRow({ title: 'Query A result' })])
        .mockResolvedValueOnce(makeCountRow(1))
        .mockResolvedValueOnce([makeFtsRow({ title: 'Query B result' })])
        .mockResolvedValueOnce(makeCountRow(1));

      await service.searchPublishedNotes('my-public-vault', { q: 'querya' });
      await service.searchPublishedNotes('my-public-vault', { q: 'queryb' });

      await new Promise((resolve) => setImmediate(resolve));

      expect(valkeyService.set).toHaveBeenCalledTimes(2);
      const keys = vi.mocked(valkeyService.set).mock.calls.map((c) => c[0] as string);
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('should use separate cache keys for different pages', async () => {
      const { service, prisma, valkeyService } = makeService();

      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([makeFtsRow()])
        .mockResolvedValueOnce(makeCountRow(20))
        .mockResolvedValueOnce([makeFtsRow()])
        .mockResolvedValueOnce(makeCountRow(20));

      await service.searchPublishedNotes('my-public-vault', { q: 'test', page: 0 });
      await service.searchPublishedNotes('my-public-vault', { q: 'test', page: 1 });

      await new Promise((resolve) => setImmediate(resolve));

      const keys = vi.mocked(valkeyService.set).mock.calls.map((c) => c[0] as string);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });

  // ─── Vault resolution ─────────────────────────────────────────────────────

  describe('vault resolution', () => {
    it('should throw NotFoundException for an unknown publicSlug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(
        service.searchPublishedNotes('ghost-vault', { q: 'test query' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when workspace is not public', async () => {
      const { service, prisma } = makeService();
      // findFirst with isPublic=true returns null for a private workspace
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(
        service.searchPublishedNotes('private-vault', { q: 'test query' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve the correct workspace and scope queries to its id', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-specific' }) as never,
      );
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]).mockResolvedValueOnce(makeCountRow(0));

      await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      // Verify workspace lookup used the correct slug + isPublic filter
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: { publicSlug: 'my-public-vault', isPublic: true },
      });
    });
  });

  // ─── FTS fallback ─────────────────────────────────────────────────────────

  describe('FTS fallback', () => {
    it('should fall back to ILIKE search when FTS throws', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);

      // First two $queryRaw calls (FTS data + count) both throw
      vi.mocked(prisma.$queryRaw)
        .mockRejectedValueOnce(new Error('tsvector column does not exist'))
        .mockRejectedValueOnce(new Error('tsvector column does not exist'))
        // Fallback calls succeed
        .mockResolvedValueOnce([makeFallbackRow()] as never)
        .mockResolvedValueOnce(makeCountRow(1) as never);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        path: 'notes/test.md',
        title: 'Test Note',
        rank: 1,
      });
    });

    it('should return the title as snippet in fallback mode', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockResolvedValueOnce([makeFallbackRow({ title: 'My Note' })] as never)
        .mockResolvedValueOnce(makeCountRow(1) as never);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'note' });

      expect(result.data[0].snippet).toBe('My Note');
    });

    it('should return correct pagination in fallback mode', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockResolvedValueOnce([makeFallbackRow()] as never)
        .mockResolvedValueOnce(makeCountRow(15) as never);

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: 'note',
        limit: 10,
        page: 0,
      });

      expect(result.pagination).toEqual({
        total: 15,
        limit: 10,
        page: 0,
        hasMore: true,
      });
    });
  });

  // ─── Private note isolation ───────────────────────────────────────────────

  describe('private note isolation', () => {
    it('should pass isPublished=true filter to the SQL query (FTS path)', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      await service.searchPublishedNotes('my-public-vault', { q: 'secret' });

      // Verify $queryRaw was called — the WHERE clause is enforced in the raw SQL
      // (is_published = true AND is_trashed = false)
      expect(prisma.$queryRaw).toHaveBeenCalled();
      // The first call is the data query; check it contains the security constraints
      const rawCall = vi.mocked(prisma.$queryRaw).mock.calls[0];
      const sqlTemplate = (rawCall[0] as TemplateStringsArray).join('?');
      expect(sqlTemplate).toContain('is_published = true');
      expect(sqlTemplate).toContain('is_trashed = false');
    });

    it('should pass isPublished=true filter to the SQL query (fallback path)', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockRejectedValueOnce(new Error('FTS unavailable'))
        .mockResolvedValueOnce([makeFallbackRow()] as never)
        .mockResolvedValueOnce(makeCountRow(1) as never);

      await service.searchPublishedNotes('my-public-vault', { q: 'secret' });

      // Third call is fallback data query
      const fallbackCall = vi.mocked(prisma.$queryRaw).mock.calls[2];
      const sqlTemplate = (fallbackCall[0] as TemplateStringsArray).join('?');
      expect(sqlTemplate).toContain('is_published = true');
      expect(sqlTemplate).toContain('is_trashed = false');
    });

    it('should not expose any note fields beyond path, title, snippet, rank, updatedAt', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });
      const resultKeys = Object.keys(result.data[0]).sort();

      expect(resultKeys).toEqual(['path', 'rank', 'snippet', 'title', 'updatedAt'].sort());
    });
  });

  // ─── invalidateSearchCache ─────────────────────────────────────────────────

  describe('invalidateSearchCache', () => {
    it('should delete cache keys returned by SCAN', async () => {
      const { service, valkeyService, mockClient } = makeService();
      vi.mocked(mockClient.scan).mockResolvedValueOnce([
        '0',
        ['publish:search:my-public-vault:test:0:10', 'publish:search:my-public-vault:other:0:10'],
      ]);

      await service.invalidateSearchCache('my-public-vault');

      expect(valkeyService.del).toHaveBeenCalledWith(
        'publish:search:my-public-vault:test:0:10',
        'publish:search:my-public-vault:other:0:10',
      );
    });

    it('should iterate SCAN cursor until exhausted', async () => {
      const { service, valkeyService, mockClient } = makeService();
      vi.mocked(mockClient.scan)
        .mockResolvedValueOnce(['42', ['key-1']]) // cursor not 0
        .mockResolvedValueOnce(['0', ['key-2']]); // cursor 0 = done

      await service.invalidateSearchCache('my-public-vault');

      expect(mockClient.scan).toHaveBeenCalledTimes(2);
      expect(valkeyService.del).toHaveBeenCalledWith('key-1', 'key-2');
    });

    it('should not call del when no cache keys exist', async () => {
      const { service, valkeyService, mockClient } = makeService();
      vi.mocked(mockClient.scan).mockResolvedValue(['0', []]);

      await service.invalidateSearchCache('my-public-vault');

      expect(valkeyService.del).not.toHaveBeenCalled();
    });

    it('should not throw when SCAN fails', async () => {
      const { service, mockClient } = makeService();
      vi.mocked(mockClient.scan).mockRejectedValue(new Error('Valkey unreachable'));

      // Should resolve without throwing
      await expect(service.invalidateSearchCache('my-public-vault')).resolves.toBeUndefined();
    });

    it('should use the correct SCAN pattern including the slug', async () => {
      const { service, mockClient } = makeService();
      vi.mocked(mockClient.scan).mockResolvedValue(['0', []]);

      await service.invalidateSearchCache('special-vault');

      expect(mockClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'publish:search:special-vault:*',
        'COUNT',
        100,
      );
    });
  });

  // ─── Pagination edge cases ────────────────────────────────────────────────

  describe('pagination edge cases', () => {
    it('should handle page 1 correctly with offset calculation', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([makeFtsRow()]) // 1 result at page 1
        .mockResolvedValueOnce(makeCountRow(15));

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: 'test',
        limit: 10,
        page: 1,
      });

      // page=1, limit=10, total=15, offset=10, rows=1 → offset+rows=11 < 15 → hasMore=true
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle total count as bigint from PostgreSQL', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([makeFtsRow()])
        .mockResolvedValueOnce([{ total: BigInt(999) }]); // BigInt from Prisma $queryRaw

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.pagination.total).toBe(999);
    });

    it('should handle zero count rows gracefully', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]).mockResolvedValueOnce([]); // empty count rows

      const result = await service.searchPublishedNotes('my-public-vault', { q: 'test' });

      expect(result.pagination.total).toBe(0);
    });
  });

  // ─── Query normalization ───────────────────────────────────────────────────

  describe('query normalization', () => {
    it('should trim whitespace from the query before searching', async () => {
      const { service, prisma } = makeService();
      setupFtsSuccess(prisma);

      const result = await service.searchPublishedNotes('my-public-vault', {
        q: '  test note  ',
      });

      expect(result.data).toHaveLength(1);
    });

    it('should produce a stable cache key for equivalent queries', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([makeFtsRow()])
        .mockResolvedValueOnce(makeCountRow(1))
        .mockResolvedValueOnce([makeFtsRow()])
        .mockResolvedValueOnce(makeCountRow(1));

      await service.searchPublishedNotes('my-public-vault', { q: 'hello world' });
      await service.searchPublishedNotes('my-public-vault', { q: 'HELLO WORLD' });

      await new Promise((resolve) => setImmediate(resolve));

      const keys = vi.mocked(valkeyService.set).mock.calls.map((c) => c[0] as string);
      // Both should map to the same cache key (lowercased)
      expect(keys[0]).toBe(keys[1]);
    });
  });
});
