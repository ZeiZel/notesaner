import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../search.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

const mockJobsService = {
  scheduleNoteIndex: vi.fn(),
  scheduleWorkspaceReindex: vi.fn(),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchService(mockPrisma as never, mockJobsService as never);
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------

  describe('search', () => {
    it('returns empty results for blank query', async () => {
      const result = await service.search('ws-1', { q: '   ' });
      expect(result).toEqual({ results: [], nextCursor: null, total: 0 });
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns paginated results', async () => {
      // Count query
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(2) }]);
      // Results query
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'note-1',
          workspace_id: 'ws-1',
          path: 'notes/one.md',
          title: 'First Note',
          snippet: 'This is a <b>match</b>',
          rank: 0.9,
          updated_at: new Date('2024-01-01'),
        },
        {
          id: 'note-2',
          workspace_id: 'ws-1',
          path: 'notes/two.md',
          title: 'Second Note',
          snippet: 'Another <b>match</b>',
          rank: 0.7,
          updated_at: new Date('2024-01-02'),
        },
      ]);

      const result = await service.search('ws-1', { q: 'match', limit: 20 });

      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(result.results[0]).toMatchObject({
        id: 'note-1',
        title: 'First Note',
        snippet: 'This is a <b>match</b>',
      });
    });

    it('provides nextCursor when there are more results', async () => {
      // Count
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(100) }]);
      // 3 rows returned for limit=2 → hasMore=true
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'n1', workspace_id: 'ws-1', path: 'a.md', title: 'A', snippet: '', rank: 0.9, updated_at: new Date() },
        { id: 'n2', workspace_id: 'ws-1', path: 'b.md', title: 'B', snippet: '', rank: 0.8, updated_at: new Date() },
        { id: 'n3', workspace_id: 'ws-1', path: 'c.md', title: 'C', snippet: '', rank: 0.7, updated_at: new Date() },
      ]);

      const result = await service.search('ws-1', { q: 'test', limit: 2 });

      expect(result.results).toHaveLength(2);
      expect(result.nextCursor).toBe('n2');
    });

    it('passes cursor for second page queries', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(5) }]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await service.search('ws-1', { q: 'test', cursor: 'note-5' });

      // Second call should have been made with cursor logic
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('clamps limit to max 100', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await service.search('ws-1', { q: 'test', limit: 9999 });

      // Should not throw — internal clamping prevents absurd LIMIT values
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // suggest
  // -------------------------------------------------------------------------

  describe('suggest', () => {
    it('returns empty array for short prefix', async () => {
      const result = await service.suggest('ws-1', 'a');
      expect(result).toEqual([]);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns completions for valid prefix', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { word: 'typescript' },
        { word: 'typesafe' },
      ]);

      const result = await service.suggest('ws-1', 'type');
      expect(result).toEqual(['typescript', 'typesafe']);
    });

    it('returns empty array for no matches', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      const result = await service.suggest('ws-1', 'zzznonexistent');
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // indexNote
  // -------------------------------------------------------------------------

  describe('indexNote', () => {
    it('delegates to jobsService.scheduleNoteIndex', async () => {
      mockJobsService.scheduleNoteIndex.mockResolvedValue(undefined);
      await service.indexNote('note-1', 'ws-1', '/vault/ws-1/note.md');
      expect(mockJobsService.scheduleNoteIndex).toHaveBeenCalledWith(
        'note-1',
        'ws-1',
        '/vault/ws-1/note.md',
      );
    });
  });

  // -------------------------------------------------------------------------
  // removeFromIndex
  // -------------------------------------------------------------------------

  describe('removeFromIndex', () => {
    it('clears search vectors via raw SQL', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1);
      await service.removeFromIndex('note-1');
      expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // rebuildIndex
  // -------------------------------------------------------------------------

  describe('rebuildIndex', () => {
    it('delegates to jobsService and returns job ID', async () => {
      mockJobsService.scheduleWorkspaceReindex.mockResolvedValue('job-abc123');
      const jobId = await service.rebuildIndex('ws-1');
      expect(jobId).toBe('job-abc123');
      expect(mockJobsService.scheduleWorkspaceReindex).toHaveBeenCalledWith('ws-1');
    });
  });
});
