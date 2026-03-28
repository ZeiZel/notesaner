import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnlinkedMentionsService } from '../unlinked-mentions.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePrisma() {
  const $queryRaw = vi.fn().mockResolvedValue([]);
  const noteFindFirst = vi.fn().mockResolvedValue(null);

  return {
    $queryRaw,
    note: { findFirst: noteFindFirst },
    _mocks: { $queryRaw, noteFindFirst },
  };
}

function makeFilesService() {
  return {
    readFile: vi.fn().mockResolvedValue(''),
  };
}

function makeNotesService() {
  return {
    update: vi.fn().mockResolvedValue({}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides: Partial<{ id: string; title: string; path: string }> = {}) {
  return {
    id: overrides.id ?? 'note-1',
    title: overrides.title ?? 'My Note',
    path: overrides.path ?? 'My Note.md',
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('UnlinkedMentionsService', () => {
  let service: UnlinkedMentionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let filesService: ReturnType<typeof makeFilesService>;
  let notesService: ReturnType<typeof makeNotesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    filesService = makeFilesService();
    notesService = makeNotesService();

    service = new UnlinkedMentionsService(
      prisma as never,
      filesService as never,
      notesService as never,
    );
  });

  // ─── findUnlinkedMentions ──────────────────────────────────────────────────

  describe('findUnlinkedMentions', () => {
    it('returns empty array when target note is not found', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue(null);

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toEqual([]);
      expect(prisma._mocks.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns empty array when note title is empty', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: '   ' });

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when FTS query fails (graceful fallback)', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'My Note' });
      prisma._mocks.$queryRaw.mockRejectedValue(new Error('FTS not available'));

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when no candidate notes are returned by FTS', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'My Note' });
      prisma._mocks.$queryRaw.mockResolvedValue([]);

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toEqual([]);
      expect(filesService.readFile).not.toHaveBeenCalled();
    });

    it('enriches results with context snippet from file content', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Target Note' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Source', path: 'Source.md' }),
      ]);

      const fileContent = 'Some text before. Target Note is mentioned here. Some text after.';
      filesService.readFile.mockResolvedValue(fileContent);

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toHaveLength(1);
      expect(result[0].sourceNoteId).toBe('src-1');
      expect(result[0].context).toContain('Target Note');
      expect(result[0].position).toBeGreaterThanOrEqual(0);
    });

    it('excludes candidates where mention is inside a wiki link', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Target Note' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Source', path: 'Source.md' }),
      ]);

      // Content only contains [[Target Note]] — already a wiki link, not unlinked
      filesService.readFile.mockResolvedValue('See [[Target Note]] for details.');

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      // Should be filtered out — no unlinked plain-text mention found
      expect(result).toHaveLength(0);
    });

    it('excludes candidates where mention is inside a markdown link', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Target Note' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Source', path: 'Source.md' }),
      ]);

      // Content only contains [text](Target Note) — already a markdown link
      filesService.readFile.mockResolvedValue('Read [this](Target Note) for info.');

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toHaveLength(0);
    });

    it('returns generic context when file cannot be read', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Target Note' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Source', path: 'Source.md' }),
      ]);

      filesService.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toHaveLength(1);
      expect(result[0].context).toContain('Target Note');
      expect(result[0].position).toBe(0);
    });

    it('adds ellipsis when context is truncated from the start', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Mention' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Source', path: 'Source.md' }),
      ]);

      // Put mention deep into a long string to trigger leading ellipsis
      const longPrefix = 'a '.repeat(200);
      const fileContent = `${longPrefix}Mention is here.`;
      filesService.readFile.mockResolvedValue(fileContent);

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result[0].context).toMatch(/^\u2026/);
    });

    it('processes multiple candidates and returns all valid results', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue({ title: 'Topic' });
      prisma._mocks.$queryRaw.mockResolvedValue([
        makeNote({ id: 'src-1', title: 'Note A', path: 'A.md' }),
        makeNote({ id: 'src-2', title: 'Note B', path: 'B.md' }),
        makeNote({ id: 'src-3', title: 'Note C', path: 'C.md' }),
      ]);

      // A and C have plain-text mentions; B only has a wiki link (filtered out)
      filesService.readFile
        .mockResolvedValueOnce('I discuss Topic here in depth.')
        .mockResolvedValueOnce('See [[Topic]] for more.')
        .mockResolvedValueOnce('Topic appears again in this note.');

      const result = await service.findUnlinkedMentions('ws-1', 'note-1');

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.sourceNoteId);
      expect(ids).toContain('src-1');
      expect(ids).toContain('src-3');
      expect(ids).not.toContain('src-2');
    });
  });

  // ─── createLinkFromMention ─────────────────────────────────────────────────

  describe('createLinkFromMention', () => {
    it('returns success=false when target note is not found', async () => {
      prisma._mocks.noteFindFirst.mockResolvedValue(null);

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/target note not found/i);
    });

    it('returns success=false when source note is not found', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Target Note' }) // target note
        .mockResolvedValueOnce(null); // source note missing

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/source note not found/i);
    });

    it('returns success=false when file cannot be read', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Target Note' })
        .mockResolvedValueOnce({ path: 'Source.md' });

      filesService.readFile.mockRejectedValue(new Error('Read error'));

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/could not read/i);
    });

    it('returns success=false when no plain-text mention is found in content', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Target Note' })
        .mockResolvedValueOnce({ path: 'Source.md' });

      // Only has a wiki link, not a plain-text mention
      filesService.readFile.mockResolvedValue('See [[Target Note]] here.');

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/no unlinked plain-text mention/i);
      expect(notesService.update).not.toHaveBeenCalled();
    });

    it('inserts [[wiki-link]] and calls NotesService.update on success', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Target Note' })
        .mockResolvedValueOnce({ path: 'Source.md' });

      filesService.readFile.mockResolvedValue('I mention Target Note in this paragraph.');

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(true);
      expect(notesService.update).toHaveBeenCalledOnce();

      const updateCall = notesService.update.mock.calls[0];
      expect(updateCall[0]).toBe('ws-1'); // workspaceId
      expect(updateCall[1]).toBe('src-1'); // noteId
      expect(updateCall[2]).toBe('user-1'); // userId
      expect(updateCall[3].content).toContain('[[Target Note]]');
    });

    it('replaces only the first plain-text mention, leaving subsequent occurrences intact', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Topic' })
        .mockResolvedValueOnce({ path: 'Source.md' });

      filesService.readFile.mockResolvedValue(
        'Topic is interesting. I also like Topic in general.',
      );

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(true);

      const updatedContent = notesService.update.mock.calls[0][3].content as string;
      // First occurrence replaced, second left as plain text
      expect(updatedContent).toBe('[[Topic]] is interesting. I also like Topic in general.');
    });

    it('returns success=false when NotesService.update throws', async () => {
      prisma._mocks.noteFindFirst
        .mockResolvedValueOnce({ title: 'Target Note' })
        .mockResolvedValueOnce({ path: 'Source.md' });

      filesService.readFile.mockResolvedValue('A mention of Target Note here.');
      notesService.update.mockRejectedValue(new Error('DB error'));

      const result = await service.createLinkFromMention('ws-1', 'target-1', 'src-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/failed to persist/i);
    });
  });
});
