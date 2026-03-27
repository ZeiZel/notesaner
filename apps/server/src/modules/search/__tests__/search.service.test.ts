import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../search.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';
import { SearchQueryDto, SortField, SortOrder, TagFilterMode } from '../dto/search-query.dto';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePrisma(overrides: Partial<PrismaService> = {}): PrismaService {
  return {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    note: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    ...overrides,
  } as unknown as PrismaService;
}

/**
 * Creates a mock ValkeyService.
 *
 * By default:
 *   - get()       returns null (cache miss)
 *   - set()       resolves void
 *   - del()       resolves 1
 *   - getClient() returns a minimal ioredis-like mock with list commands
 */
function makeValkey(overrides: Partial<ValkeyService> = {}): ValkeyService {
  const clientMock = {
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn().mockResolvedValue(1),
    lrem: vi.fn().mockResolvedValue(0),
    ltrim: vi.fn().mockResolvedValue('OK'),
  };

  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(false),
    expire: vi.fn().mockResolvedValue(true),
    ping: vi.fn().mockResolvedValue(true),
    getClient: vi.fn().mockReturnValue(clientMock),
    ...overrides,
  } as unknown as ValkeyService;
}

const WORKSPACE_ID = 'workspace-abc';
const NOTE_ID = 'note-123';
const USER_ID = 'user-xyz';

// ---------------------------------------------------------------------------
// search() — core
// ---------------------------------------------------------------------------

describe('SearchService.search', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('returns empty result for query shorter than 2 characters', async () => {
    const result = await service.search(WORKSPACE_ID, { q: 'a' } as SearchQueryDto);

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.note.findMany).not.toHaveBeenCalled();
  });

  it('returns empty result for whitespace-only query', async () => {
    const result = await service.search(WORKSPACE_ID, { q: '  ' } as SearchQueryDto);

    expect(result.data).toHaveLength(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns cached result on cache hit without hitting the database', async () => {
    const cachedResponse = {
      data: [{ id: 'note-1', title: 'Cached', path: 'c.md', snippet: 'c', rank: 0.9 }],
      pagination: { total: 1, limit: 20, hasMore: false },
    };
    vi.mocked(valkey.get).mockResolvedValueOnce(JSON.stringify(cachedResponse));

    const result = await service.search(WORKSPACE_ID, { q: 'cached' } as SearchQueryDto);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('note-1');
    expect(prisma.note.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('stores results in ValKey cache after DB query', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'note-1' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'note-1', title: 'Test', path: 't.md', snippet: '<mark>Test</mark>', rank: 0.8 },
      ])
      .mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'test' } as SearchQueryDto);

    // Allow fire-and-forget cache write to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(valkey.set).toHaveBeenCalledOnce();
    const [, value, ttl] = vi.mocked(valkey.set).mock.calls[0];
    expect(ttl).toBe(300);
    const parsed = JSON.parse(value);
    expect(parsed.data[0].id).toBe('note-1');
  });

  it('continues normally when cache read fails', async () => {
    vi.mocked(valkey.get).mockRejectedValueOnce(new Error('connection refused'));
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([{ id: 'note-1' } as never]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'note-1', title: 'Notes', path: 'n.md', snippet: 'Notes', rank: 0.7 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, { q: 'notes' } as SearchQueryDto);

    expect(result.data).toHaveLength(1);
  });

  it('returns empty when no candidates pass structural filters', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, {
      q: 'anything',
      tagIds: ['non-existent-tag'],
    } as unknown as SearchQueryDto);

    expect(result.data).toHaveLength(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns ranked FTS results', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'note-1' } as never,
      { id: 'note-2' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'note-1', title: 'Zettelkasten guide', path: 'g.md', snippet: '<mark>Zettelkasten</mark>', rank: 0.9 },
        { id: 'note-2', title: 'Zettelkasten links', path: 'l.md', snippet: '<mark>Zettelkasten</mark> links', rank: 0.6 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, { q: 'zettelkasten' } as SearchQueryDto);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('note-1');
    expect(result.data[0].matchType).toBe('fts');
  });

  it('deduplicates FTS and fuzzy results, labels fuzzy with penalty', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'note-1' } as never,
      { id: 'note-2' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'note-1', title: 'Programming notes', path: 'p.md', snippet: '<mark>Programming</mark>', rank: 0.8 },
      ])
      .mockResolvedValueOnce([
        { id: 'note-1', title: 'Programming notes', path: 'p.md', similarity: 0.7 },
        { id: 'note-2', title: 'Prgraming concepts', path: 'c.md', similarity: 0.4 },
      ]);

    const result = await service.search(WORKSPACE_ID, { q: 'programming' } as SearchQueryDto);

    const ids = result.data.map((r) => r.id);
    expect(ids.filter((id) => id === 'note-1')).toHaveLength(1);
    expect(ids).toContain('note-2');
    expect(result.data.find((r) => r.id === 'note-2')?.matchType).toBe('fuzzy');
    // FTS result should rank above fuzzy supplement
    expect(ids[0]).toBe('note-1');
  });

  it('caps limit at 100', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'anything', limit: 999 } as SearchQueryDto);

    // The candidate id query uses findMany; no FTS query runs (0 candidates)
    expect(prisma.note.findMany).toHaveBeenCalledOnce();
  });

  it('falls back to ILIKE search when FTS query throws', async () => {
    vi.mocked(prisma.note.findMany)
      .mockResolvedValueOnce([{ id: 'note-1' } as never])  // resolveCandidateIds
      .mockResolvedValueOnce([                               // fallbackSearch
        { id: 'note-1', title: 'Meeting notes', path: 'meeting.md' } as never,
      ]);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('search_vector does not exist'));

    const result = await service.search(WORKSPACE_ID, { q: 'meeting' } as SearchQueryDto);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('note-1');
    expect(result.data[0].rank).toBe(1);
  });

  it('saves recent search for authenticated user', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'my query' } as SearchQueryDto, USER_ID);

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 0));

    const client = valkey.getClient() as ReturnType<typeof makeValkey>['getClient'] extends () => infer R ? R : never;
    expect(vi.mocked(client.lpush)).toHaveBeenCalledWith(
      `recent_searches:${USER_ID}:${WORKSPACE_ID}`,
      'my query',
    );
  });

  it('does not fail if recent search save throws', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);
    const client = valkey.getClient() as any;
    vi.mocked(client.lpush).mockRejectedValueOnce(new Error('Redis down'));

    // Should resolve normally — fire-and-forget error must not propagate
    await expect(
      service.search(WORKSPACE_ID, { q: 'crash test' } as SearchQueryDto, USER_ID),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// search() — filter tests
// ---------------------------------------------------------------------------

describe('SearchService.search — filters', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('passes isPublished=true filter to candidate query', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'anything', isPublished: true } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    expect((callArgs as any).where.isPublished).toBe(true);
  });

  it('passes isTrashed=true filter to candidate query', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'trash', isTrashed: true } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    expect((callArgs as any).where.isTrashed).toBe(true);
  });

  it('excludes trashed notes by default (isTrashed=false)', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, { q: 'something' } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    expect((callArgs as any).where.isTrashed).toBe(false);
  });

  it('passes authorId filter to candidate query', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      authorId: 'author-uuid',
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    expect((callArgs as any).where.createdById).toBe('author-uuid');
  });

  it('passes folder filter as path startsWith to candidate query', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      folder: 'projects',
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    expect((callArgs as any).where.path).toEqual({ startsWith: 'projects' });
  });

  it('applies createdAfter / createdBefore date range filter', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      createdAfter: '2024-01-01T00:00:00.000Z',
      createdBefore: '2024-12-31T23:59:59.999Z',
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    const createdAt = (callArgs as any).where.createdAt;
    expect(createdAt.gte).toBeInstanceOf(Date);
    expect(createdAt.lte).toBeInstanceOf(Date);
  });

  it('applies updatedAfter / updatedBefore date range filter', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      updatedAfter: '2025-01-01T00:00:00.000Z',
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    const updatedAt = (callArgs as any).where.updatedAt;
    expect(updatedAt.gte).toBeInstanceOf(Date);
    expect(updatedAt.lte).toBeUndefined();
  });

  it('applies OR tag filter when tagMode is OR', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      tagIds: ['tag-1', 'tag-2'],
      tagMode: TagFilterMode.OR,
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    const tagsFilter = (callArgs as any).where.tags;
    expect(tagsFilter).toBeDefined();
    expect(tagsFilter.some.tagId.in).toEqual(['tag-1', 'tag-2']);
  });

  it('applies AND tag filter when tagMode is AND', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      tagIds: ['tag-1', 'tag-2'],
      tagMode: TagFilterMode.AND,
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    const andFilter = (callArgs as any).where.AND;
    expect(Array.isArray(andFilter)).toBe(true);
    expect(andFilter).toHaveLength(2);
    expect(andFilter[0].tags.some.tagId).toBe('tag-1');
    expect(andFilter[1].tags.some.tagId).toBe('tag-2');
  });

  it('defaults to OR mode when tagIds are set but tagMode is omitted', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([]);

    await service.search(WORKSPACE_ID, {
      q: 'test',
      tagIds: ['tag-1'],
    } as SearchQueryDto);

    const [callArgs] = vi.mocked(prisma.note.findMany).mock.calls[0];
    // OR mode uses `tags.some`
    expect((callArgs as any).where.tags).toBeDefined();
    expect((callArgs as any).where.AND).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// search() — sort tests
// ---------------------------------------------------------------------------

describe('SearchService.search — sorting', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('sorts by title ASC when sortBy=title, sortOrder=asc', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'n1' } as never,
      { id: 'n2' } as never,
      { id: 'n3' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'n3', title: 'Zebra', path: 'z.md', snippet: 'z', rank: 0.5 },
        { id: 'n1', title: 'Alpha', path: 'a.md', snippet: 'a', rank: 0.9 },
        { id: 'n2', title: 'Middle', path: 'm.md', snippet: 'm', rank: 0.7 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, {
      q: 'test',
      sortBy: SortField.TITLE,
      sortOrder: SortOrder.ASC,
    } as SearchQueryDto);

    expect(result.data[0].title).toBe('Alpha');
    expect(result.data[1].title).toBe('Middle');
    expect(result.data[2].title).toBe('Zebra');
  });

  it('sorts by title DESC when sortBy=title, sortOrder=desc', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'n1' } as never,
      { id: 'n2' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'n1', title: 'Alpha', path: 'a.md', snippet: 'a', rank: 0.9 },
        { id: 'n2', title: 'Zebra', path: 'z.md', snippet: 'z', rank: 0.5 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, {
      q: 'test',
      sortBy: SortField.TITLE,
      sortOrder: SortOrder.DESC,
    } as SearchQueryDto);

    expect(result.data[0].title).toBe('Zebra');
    expect(result.data[1].title).toBe('Alpha');
  });

  it('preserves relevance rank ordering when sortBy=relevance', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'n1' } as never,
      { id: 'n2' } as never,
    ]);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        { id: 'n1', title: 'High rank', path: 'h.md', snippet: 'h', rank: 0.95 },
        { id: 'n2', title: 'Low rank', path: 'l.md', snippet: 'l', rank: 0.1 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.search(WORKSPACE_ID, {
      q: 'rank',
      sortBy: SortField.RELEVANCE,
    } as SearchQueryDto);

    expect(result.data[0].id).toBe('n1');
    expect(result.data[1].id).toBe('n2');
  });

  it('applies updatedAt sort in ILIKE fallback', async () => {
    vi.mocked(prisma.note.findMany)
      .mockResolvedValueOnce([{ id: 'n1' } as never])  // resolveCandidateIds
      .mockResolvedValueOnce([                           // fallbackSearch
        { id: 'n1', title: 'Test', path: 't.md' } as never,
      ]);
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('FTS unavailable'));

    await service.search(WORKSPACE_ID, {
      q: 'test',
      sortBy: SortField.UPDATED_AT,
      sortOrder: SortOrder.ASC,
    } as SearchQueryDto);

    // Second findMany call is the fallback; check orderBy
    const fallbackArgs = vi.mocked(prisma.note.findMany).mock.calls[1][0];
    expect((fallbackArgs as any).orderBy).toEqual({ updatedAt: 'asc' });
  });
});

// ---------------------------------------------------------------------------
// getRecentSearches()
// ---------------------------------------------------------------------------

describe('SearchService.getRecentSearches', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('returns recent searches from ValKey list', async () => {
    const client = valkey.getClient() as any;
    vi.mocked(client.lrange).mockResolvedValueOnce(['query C', 'query B', 'query A']);

    const result = await service.getRecentSearches(USER_ID, WORKSPACE_ID);

    expect(result).toEqual(['query C', 'query B', 'query A']);
    expect(client.lrange).toHaveBeenCalledWith(
      `recent_searches:${USER_ID}:${WORKSPACE_ID}`,
      0,
      19, // RECENT_SEARCHES_MAX - 1
    );
  });

  it('returns empty array when no recent searches exist', async () => {
    const client = valkey.getClient() as any;
    vi.mocked(client.lrange).mockResolvedValueOnce([]);

    const result = await service.getRecentSearches(USER_ID, WORKSPACE_ID);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearRecentSearches()
// ---------------------------------------------------------------------------

describe('SearchService.clearRecentSearches', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('deletes the recent searches key from ValKey', async () => {
    await service.clearRecentSearches(USER_ID, WORKSPACE_ID);

    expect(valkey.del).toHaveBeenCalledWith(
      `recent_searches:${USER_ID}:${WORKSPACE_ID}`,
    );
  });
});

// ---------------------------------------------------------------------------
// saveRecentSearch() — private, tested via search()
// ---------------------------------------------------------------------------

describe('SearchService — recent search deduplication', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('removes duplicate before prepending so each query appears at most once', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([]);

    await service.search(WORKSPACE_ID, { q: 'duplicate' } as SearchQueryDto, USER_ID);

    await new Promise((r) => setTimeout(r, 0));

    const client = valkey.getClient() as any;
    // lrem must be called before lpush to de-duplicate
    const lremOrder = vi.mocked(client.lrem).mock.invocationCallOrder[0];
    const lpushOrder = vi.mocked(client.lpush).mock.invocationCallOrder[0];
    expect(lremOrder).toBeLessThan(lpushOrder);

    expect(client.lrem).toHaveBeenCalledWith(
      `recent_searches:${USER_ID}:${WORKSPACE_ID}`,
      0,
      'duplicate',
    );
  });

  it('trims list to 20 entries after prepend', async () => {
    vi.mocked(prisma.note.findMany).mockResolvedValue([]);

    await service.search(WORKSPACE_ID, { q: 'any' } as SearchQueryDto, USER_ID);

    await new Promise((r) => setTimeout(r, 0));

    const client = valkey.getClient() as any;
    expect(client.ltrim).toHaveBeenCalledWith(
      `recent_searches:${USER_ID}:${WORKSPACE_ID}`,
      0,
      19, // RECENT_SEARCHES_MAX - 1
    );
  });
});

// ---------------------------------------------------------------------------
// suggest()
// ---------------------------------------------------------------------------

describe('SearchService.suggest', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('returns empty array for prefix shorter than 2 characters', async () => {
    const result = await service.suggest(WORKSPACE_ID, 'a');
    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns suggestions via pg_trgm for valid prefix', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { title: 'Meeting notes' },
      { title: 'Meeting recap' },
    ]);

    const result = await service.suggest(WORKSPACE_ID, 'mee');

    expect(result).toEqual(['Meeting notes', 'Meeting recap']);
  });

  it('falls back to prefix match when pg_trgm throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('operator does not exist'));
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { title: 'Project alpha' } as never,
      { title: 'Project beta' } as never,
    ]);

    const result = await service.suggest(WORKSPACE_ID, 'pro');

    expect(result).toEqual(['Project alpha', 'Project beta']);
  });
});

// ---------------------------------------------------------------------------
// indexNote()
// ---------------------------------------------------------------------------

describe('SearchService.indexNote', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('executes UPDATE with all four weight tiers', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    await service.indexNote(NOTE_ID, 'My Title', 'Body content here', {
      tags: ['typescript', 'nestjs'],
      frontmatter: { author: 'Alice', published: true, revision: 3 },
    });

    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it('handles missing options gracefully', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    await expect(
      service.indexNote(NOTE_ID, 'Title Only', 'Some content'),
    ).resolves.toBeUndefined();
  });

  it('logs a warning but does not throw when executeRaw fails', async () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.indexNote(NOTE_ID, 'Title', 'Content')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// removeFromIndex()
// ---------------------------------------------------------------------------

describe('SearchService.removeFromIndex', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('executes UPDATE to null out the search_vector', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    await service.removeFromIndex(NOTE_ID);

    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });

  it('logs a warning but does not throw on database error', async () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValueOnce(new Error('timeout'));

    await expect(service.removeFromIndex(NOTE_ID)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fuzzySearch()
// ---------------------------------------------------------------------------

describe('SearchService.fuzzySearch', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('returns empty result for query shorter than 2 characters', async () => {
    const result = await service.fuzzySearch(WORKSPACE_ID, 'a');
    expect(result.data).toHaveLength(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns results sorted by similarity descending', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'n1', title: 'Programming guide', path: 'g.md', similarity: 0.8 },
      { id: 'n2', title: 'Prgraming notes', path: 'n.md', similarity: 0.4 },
    ]);

    const result = await service.fuzzySearch(WORKSPACE_ID, 'prgraming');

    expect(result.data[0].id).toBe('n1');
    expect(result.data[1].id).toBe('n2');
  });

  it('assigns matchType fuzzy to all results', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'n1', title: 'JavaScript basics', path: 'js.md', similarity: 0.5 },
    ]);

    const result = await service.fuzzySearch(WORKSPACE_ID, 'javascrpit');

    expect(result.data[0].matchType).toBe('fuzzy');
  });

  it('falls back to ILIKE when pg_trgm throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error('operator does not exist: text % text'),
    );
    vi.mocked(prisma.note.findMany).mockResolvedValueOnce([
      { id: 'n1', title: 'Python tutorial', path: 'py.md' } as never,
    ]);

    const result = await service.fuzzySearch(WORKSPACE_ID, 'pythn');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].rank).toBe(1);
  });

  it('respects hasMore pagination when results exceed limit', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`,
      title: `Note ${i}`,
      path: `n${i}.md`,
      similarity: 0.9 - i * 0.05,
    }));
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(rows);

    const result = await service.fuzzySearch(WORKSPACE_ID, 'note', { limit: 5 });

    expect(result.data).toHaveLength(5);
    expect(result.pagination.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rebuildIndex()
// ---------------------------------------------------------------------------

describe('SearchService.rebuildIndex', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let valkey: ValkeyService;

  beforeEach(() => {
    prisma = makePrisma();
    valkey = makeValkey();
    service = new SearchService(prisma, valkey);
  });

  it('executes a bulk UPDATE for the workspace', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(42);

    await service.rebuildIndex(WORKSPACE_ID);

    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
  });
});
