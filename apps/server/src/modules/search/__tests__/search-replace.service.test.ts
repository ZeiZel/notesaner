import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SearchReplaceService } from '../search-replace.service';
import { SearchReplaceMode } from '../dto/search-replace-preview.dto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  note: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

const mockFilesService = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
};

const mockVersionService = {
  createVersion: vi.fn(),
};

const mockJobsService = {
  scheduleWorkspaceReindex: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test content fixtures
// ---------------------------------------------------------------------------

const SAMPLE_CONTENT = `# Meeting Notes

This is a TODO item that needs attention.
Another TODO here as well.
And a final line with no matches.
`;

const MULTI_LINE_CONTENT = `Line 1: Hello World
Line 2: hello world
Line 3: HELLO WORLD
Line 4: hello-world
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchReplaceService', () => {
  let service: SearchReplaceService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new SearchReplaceService(
      mockPrisma as never,
      mockFilesService as never,
      mockVersionService as never,
      mockJobsService as never,
    );

    // Default: return one note
    mockPrisma.note.findMany.mockResolvedValue([
      { id: 'note-1', title: 'Meeting Notes', path: 'meetings/2024-01.md' },
    ]);
  });

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  describe('preview', () => {
    it('finds plain text matches with context', async () => {
      mockFilesService.readFile.mockResolvedValue(SAMPLE_CONTENT);

      const result = await service.preview('ws-1', {
        query: 'TODO',
        replacement: 'DONE',
      });

      expect(result.totalMatches).toBe(2);
      expect(result.notesAffected).toBe(1);
      expect(result.truncated).toBe(false);
      expect(result.matches).toHaveLength(2);

      // First match
      const first = result.matches[0];
      expect(first?.noteId).toBe('note-1');
      expect(first?.matchText).toBe('TODO');
      expect(first?.lineNumber).toBe(3); // "This is a TODO..."
      expect(first?.replacementPreview).toBe('DONE');
    });

    it('respects case-sensitive flag', async () => {
      mockFilesService.readFile.mockResolvedValue(MULTI_LINE_CONTENT);

      // Case-insensitive (default)
      const insensitiveResult = await service.preview('ws-1', {
        query: 'hello',
        replacement: 'hi',
        caseSensitive: false,
      });
      expect(insensitiveResult.totalMatches).toBe(4); // Matches Hello, hello, HELLO, hello

      // Case-sensitive
      const sensitiveResult = await service.preview('ws-1', {
        query: 'hello',
        replacement: 'hi',
        caseSensitive: true,
      });
      expect(sensitiveResult.totalMatches).toBe(2); // Only lowercase "hello"
    });

    it('supports whole-word matching', async () => {
      mockFilesService.readFile.mockResolvedValue('The cat concatenated the catalog.');

      const result = await service.preview('ws-1', {
        query: 'cat',
        replacement: 'dog',
        wholeWord: true,
      });

      expect(result.totalMatches).toBe(1);
      expect(result.matches[0]?.matchText).toBe('cat');
    });

    it('supports regex mode', async () => {
      mockFilesService.readFile.mockResolvedValue('Date: 2024-01-15\nDate: 2024-12-31\n');

      const result = await service.preview('ws-1', {
        query: '\\d{4}-\\d{2}-\\d{2}',
        replacement: 'REDACTED',
        mode: SearchReplaceMode.REGEX,
      });

      expect(result.totalMatches).toBe(2);
      expect(result.matches[0]?.matchText).toBe('2024-01-15');
      expect(result.matches[1]?.matchText).toBe('2024-12-31');
    });

    it('throws BadRequestException for invalid regex', async () => {
      await expect(
        service.preview('ws-1', {
          query: '[invalid',
          replacement: 'x',
          mode: SearchReplaceMode.REGEX,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns empty results when no notes match filters', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);

      const result = await service.preview('ws-1', {
        query: 'TODO',
        replacement: 'DONE',
        filters: { folder: 'nonexistent/' },
      });

      expect(result.totalMatches).toBe(0);
      expect(result.matches).toHaveLength(0);
    });

    it('truncates results when maxMatches is exceeded', async () => {
      // Content with many matches
      const content = Array.from({ length: 100 }, (_, i) => `Line ${i}: TODO`).join('\n');
      mockFilesService.readFile.mockResolvedValue(content);

      const result = await service.preview('ws-1', {
        query: 'TODO',
        replacement: 'DONE',
        maxMatches: 10,
      });

      expect(result.matches).toHaveLength(10);
      expect(result.totalMatches).toBe(100);
      expect(result.truncated).toBe(true);
    });

    it('skips notes where file is not readable', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 'note-1', title: 'Note 1', path: 'note1.md' },
        { id: 'note-2', title: 'Note 2', path: 'note2.md' },
      ]);

      mockFilesService.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('TODO item here');

      const result = await service.preview('ws-1', {
        query: 'TODO',
        replacement: 'DONE',
      });

      expect(result.totalMatches).toBe(1);
      expect(result.notesAffected).toBe(1);
      expect(result.matches[0]?.noteId).toBe('note-2');
    });

    it('provides correct line and column offsets', async () => {
      const content = 'first line\nsecond line with TARGET here\nthird line';
      mockFilesService.readFile.mockResolvedValue(content);

      const result = await service.preview('ws-1', {
        query: 'TARGET',
        replacement: 'REPLACED',
      });

      expect(result.matches).toHaveLength(1);
      const match = result.matches[0];
      expect(match?.lineNumber).toBe(2);
      expect(match?.columnOffset).toBe(17); // "second line with " is 17 chars
    });

    it('applies folder filter', async () => {
      await service.preview('ws-1', {
        query: 'test',
        replacement: 'x',
        filters: { folder: 'projects/' },
      });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            path: expect.objectContaining({ startsWith: 'projects/' }),
          }),
        }),
      );
    });

    it('applies tag filter', async () => {
      await service.preview('ws-1', {
        query: 'test',
        replacement: 'x',
        filters: { tagIds: ['tag-uuid-1'] },
      });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { some: { tagId: { in: ['tag-uuid-1'] } } },
          }),
        }),
      );
    });

    it('applies date range filter', async () => {
      await service.preview('ws-1', {
        query: 'test',
        replacement: 'x',
        filters: {
          updatedAfter: '2024-01-01T00:00:00Z',
          updatedBefore: '2024-12-31T23:59:59Z',
        },
      });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            updatedAt: {
              gte: new Date('2024-01-01T00:00:00Z'),
              lte: new Date('2024-12-31T23:59:59Z'),
            },
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Execute — replace all
  // -------------------------------------------------------------------------

  describe('execute (replace all)', () => {
    it('replaces all matches and creates versions', async () => {
      mockFilesService.readFile.mockResolvedValue(SAMPLE_CONTENT);
      mockFilesService.writeFile.mockResolvedValue(undefined);
      mockVersionService.createVersion.mockResolvedValue({});

      const result = await service.execute('ws-1', 'user-1', {
        query: 'TODO',
        replacement: 'DONE',
      });

      expect(result.replacedCount).toBe(2);
      expect(result.modifiedNotes).toEqual(['note-1']);
      expect(result.jobId).toBeUndefined();

      // Verify version was created before writing
      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        'note-1',
        'user-1',
        SAMPLE_CONTENT,
        expect.stringContaining('Before search-replace'),
      );

      // Verify file was written
      expect(mockFilesService.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFilesService.writeFile.mock.calls[0]?.[2] as string;
      expect(writtenContent).toContain('DONE');
      expect(writtenContent).not.toContain('TODO');
    });

    it('skips notes excluded via excludeNoteIds', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 'note-1', title: 'Note 1', path: 'note1.md' },
        { id: 'note-2', title: 'Note 2', path: 'note2.md' },
      ]);

      mockFilesService.readFile
        .mockResolvedValueOnce('TODO in note 1')
        .mockResolvedValueOnce('TODO in note 2');
      mockFilesService.writeFile.mockResolvedValue(undefined);
      mockVersionService.createVersion.mockResolvedValue({});

      const result = await service.execute('ws-1', 'user-1', {
        query: 'TODO',
        replacement: 'DONE',
        excludeNoteIds: ['note-1'],
      });

      expect(result.replacedCount).toBe(1);
      expect(result.modifiedNotes).toEqual(['note-2']);
    });

    it('does not modify notes with no matches', async () => {
      mockFilesService.readFile.mockResolvedValue('No matches here');
      mockFilesService.writeFile.mockResolvedValue(undefined);

      const result = await service.execute('ws-1', 'user-1', {
        query: 'NONEXISTENT',
        replacement: 'x',
      });

      expect(result.replacedCount).toBe(0);
      expect(result.modifiedNotes).toEqual([]);
      expect(mockFilesService.writeFile).not.toHaveBeenCalled();
      expect(mockVersionService.createVersion).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Execute — selective replacement
  // -------------------------------------------------------------------------

  describe('execute (selective replacement)', () => {
    it('replaces only specified matches', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({
        id: 'note-1',
        path: 'meetings/2024-01.md',
        title: 'Meeting Notes',
      });
      mockFilesService.readFile.mockResolvedValue(SAMPLE_CONTENT);
      mockFilesService.writeFile.mockResolvedValue(undefined);
      mockVersionService.createVersion.mockResolvedValue({});

      const result = await service.execute('ws-1', 'user-1', {
        query: 'TODO',
        replacement: 'DONE',
        matches: [
          {
            noteId: 'note-1',
            lineNumber: 3,
            columnOffset: 10,
            matchText: 'TODO',
          },
        ],
      });

      expect(result.replacedCount).toBe(1);
      expect(result.modifiedNotes).toEqual(['note-1']);

      // Verify only the first TODO was replaced
      const writtenContent = mockFilesService.writeFile.mock.calls[0]?.[2] as string;
      expect(writtenContent).toContain('DONE');
      // The second TODO (line 4) should still be there
      expect(writtenContent).toContain('TODO');
    });

    it('skips match when text no longer matches at position', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({
        id: 'note-1',
        path: 'note1.md',
        title: 'Note 1',
      });
      mockFilesService.readFile.mockResolvedValue('Changed content without the expected match');
      mockVersionService.createVersion.mockResolvedValue({});

      const result = await service.execute('ws-1', 'user-1', {
        query: 'TODO',
        replacement: 'DONE',
        matches: [
          {
            noteId: 'note-1',
            lineNumber: 1,
            columnOffset: 0,
            matchText: 'TODO',
          },
        ],
      });

      // No replacement should have been made
      expect(result.replacedCount).toBe(0);
      expect(mockFilesService.writeFile).not.toHaveBeenCalled();
    });

    it('skips missing notes gracefully', async () => {
      mockPrisma.note.findUnique.mockResolvedValue(null);

      const result = await service.execute('ws-1', 'user-1', {
        query: 'TODO',
        replacement: 'DONE',
        matches: [
          {
            noteId: 'nonexistent',
            lineNumber: 1,
            columnOffset: 0,
            matchText: 'TODO',
          },
        ],
      });

      expect(result.replacedCount).toBe(0);
      expect(result.modifiedNotes).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty content gracefully', async () => {
      mockFilesService.readFile.mockResolvedValue('');

      const result = await service.preview('ws-1', {
        query: 'test',
        replacement: 'x',
      });

      expect(result.totalMatches).toBe(0);
    });

    it('handles regex with capture groups in replacement', async () => {
      mockFilesService.readFile.mockResolvedValue('Date: 2024-01-15\nDate: 2024-12-31\n');

      const result = await service.preview('ws-1', {
        query: '(\\d{4})-(\\d{2})-(\\d{2})',
        replacement: '$2/$3/$1',
        mode: SearchReplaceMode.REGEX,
      });

      expect(result.matches[0]?.replacementPreview).toBe('01/15/2024');
      expect(result.matches[1]?.replacementPreview).toBe('12/31/2024');
    });

    it('escapes special regex characters in plain mode', async () => {
      mockFilesService.readFile.mockResolvedValue('Use array.map() to transform data.');

      const result = await service.preview('ws-1', {
        query: 'array.map()',
        replacement: 'arr.map()',
        mode: SearchReplaceMode.PLAIN,
      });

      expect(result.totalMatches).toBe(1);
      expect(result.matches[0]?.matchText).toBe('array.map()');
    });

    it('handles regex with zero-length matches without infinite loop', async () => {
      mockFilesService.readFile.mockResolvedValue('abc');

      const result = await service.preview('ws-1', {
        query: '(?=a)',
        replacement: 'X',
        mode: SearchReplaceMode.REGEX,
      });

      // Should not hang — zero-length match at position 0 is handled
      expect(result.totalMatches).toBeGreaterThanOrEqual(1);
    });
  });
});
