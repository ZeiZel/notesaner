import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ContentHashService } from '../content-hash.service';
import { FilesService } from '../../files/files.service';
import { sha256 } from '../content-hash.utils';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SearchService } from '../../search/search.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTE_ID = 'note-abc123';
const WORKSPACE_ID = 'ws-xyz789';
const NOTE_PATH = 'journal/2026-03-28.md';
const CONTENT = '# Daily Note\n\nToday was productive.';
const STORED_HASH = sha256(CONTENT);

function makeNote(
  overrides: Partial<{
    id: string;
    workspaceId: string;
    path: string;
    title: string;
    contentHash: string | null;
  }> = {},
) {
  return {
    id: NOTE_ID,
    workspaceId: WORKSPACE_ID,
    path: NOTE_PATH,
    title: 'Daily Note',
    contentHash: STORED_HASH,
    ...overrides,
  };
}

function makePrisma(): {
  note: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
} {
  return {
    note: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeFilesService() {
  return {
    readFile: vi.fn().mockResolvedValue(CONTENT),
  };
}

function makeSearchService() {
  return {
    indexNote: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ContentHashService', () => {
  let service: ContentHashService;
  let prisma: ReturnType<typeof makePrisma>;
  let filesService: ReturnType<typeof makeFilesService>;
  let searchService: ReturnType<typeof makeSearchService>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    filesService = makeFilesService();
    searchService = makeSearchService();

    service = new ContentHashService(
      prisma as unknown as PrismaService,
      filesService as unknown as FilesService,
      searchService as unknown as SearchService,
    );
  });

  // ─── computeHash ────────────────────────────────────────────────────────

  describe('computeHash', () => {
    it('returns a 64-character hex string for string input', () => {
      const result = service.computeHash('hello');
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns the same hash as the sha256 utility function', () => {
      const content = '# Note\n\nContent here.';
      expect(service.computeHash(content)).toBe(sha256(content));
    });

    it('returns a 64-character hex string for Buffer input', () => {
      const buf = Buffer.from('buffer content', 'utf-8');
      const result = service.computeHash(buf);
      expect(result).toHaveLength(64);
    });

    it('returns the same hash for equal string and Buffer inputs', () => {
      const str = 'test content';
      const buf = Buffer.from(str, 'utf-8');
      expect(service.computeHash(str)).toBe(service.computeHash(buf));
    });

    it('handles empty string without error', () => {
      const result = service.computeHash('');
      expect(result).toHaveLength(64);
    });
  });

  // ─── compareHash ────────────────────────────────────────────────────────

  describe('compareHash', () => {
    it('returns hashMatched=true and externalChangeDetected=false when hashes match', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(CONTENT); // same content as stored hash

      const result = await service.compareHash(NOTE_ID);

      expect(result.hashMatched).toBe(true);
      expect(result.externalChangeDetected).toBe(false);
      expect(result.contentHash).toBe(STORED_HASH);
    });

    it('returns hashMatched=false and externalChangeDetected=true when content changed', async () => {
      const modifiedContent = CONTENT + '\n\nExtra paragraph added externally.';
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(modifiedContent);

      const result = await service.compareHash(NOTE_ID);

      expect(result.hashMatched).toBe(false);
      expect(result.externalChangeDetected).toBe(true);
      expect(result.contentHash).toBe(sha256(modifiedContent));
    });

    it('returns externalChangeDetected=true when stored hash is null', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: null }));
      filesService.readFile.mockResolvedValue(CONTENT);

      const result = await service.compareHash(NOTE_ID);

      expect(result.hashMatched).toBe(false);
      expect(result.externalChangeDetected).toBe(true);
    });

    it('throws NotFoundException when note does not exist', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(service.compareHash(NOTE_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns externalChangeDetected=true when the file is missing on disk', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote());
      filesService.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const result = await service.compareHash(NOTE_ID);

      expect(result.externalChangeDetected).toBe(true);
      expect(result.hashMatched).toBe(false);
    });

    it('uses the note workspaceId and path when reading the file', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote());
      filesService.readFile.mockResolvedValue(CONTENT);

      await service.compareHash(NOTE_ID);

      expect(filesService.readFile).toHaveBeenCalledWith(WORKSPACE_ID, NOTE_PATH);
    });
  });

  // ─── updateHash ─────────────────────────────────────────────────────────

  describe('updateHash', () => {
    it('updates the contentHash column for a valid note', async () => {
      const newHash = sha256('updated content');
      prisma.note.findUnique.mockResolvedValue(makeNote());

      await service.updateHash(NOTE_ID, newHash);

      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { contentHash: newHash },
      });
    });

    it('throws NotFoundException when the note does not exist', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(service.updateHash(NOTE_ID, 'any-hash')).rejects.toThrow(NotFoundException);
    });

    it('does not call prisma.note.update when the note is not found', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(service.updateHash(NOTE_ID, 'any-hash')).rejects.toThrow();

      expect(prisma.note.update).not.toHaveBeenCalled();
    });

    it('accepts any valid 64-char hex string as the new hash', async () => {
      const newHash = 'a'.repeat(64);
      prisma.note.findUnique.mockResolvedValue(makeNote());

      await expect(service.updateHash(NOTE_ID, newHash)).resolves.toBeUndefined();

      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { contentHash: newHash } }),
      );
    });
  });

  // ─── detectExternalChange ───────────────────────────────────────────────

  describe('detectExternalChange', () => {
    it('returns null when hashes match (no external change)', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(CONTENT);

      const result = await service.detectExternalChange(NOTE_ID);

      expect(result).toBeNull();
      expect(prisma.note.update).not.toHaveBeenCalled();
      expect(searchService.indexNote).not.toHaveBeenCalled();
    });

    it('returns an ExternalChangeEvent when the file has been modified externally', async () => {
      const newContent = CONTENT + '\n\nNew external paragraph.';
      const newHash = sha256(newContent);
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);

      const result = await service.detectExternalChange(NOTE_ID);

      expect(result).not.toBeNull();
      expect(result!.event).toBe('note.external_change');
      expect(result!.noteId).toBe(NOTE_ID);
      expect(result!.workspaceId).toBe(WORKSPACE_ID);
      expect(result!.newHash).toBe(newHash);
      expect(result!.previousHash).toBe(STORED_HASH);
    });

    it('includes a valid ISO 8601 detectedAt timestamp', async () => {
      const newContent = CONTENT + ' changed';
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);

      const result = await service.detectExternalChange(NOTE_ID);

      expect(result).not.toBeNull();
      const date = new Date(result!.detectedAt);
      expect(date.toISOString()).toBe(result!.detectedAt);
    });

    it('updates the stored hash in the database after detecting a change', async () => {
      const newContent = 'completely different content';
      const newHash = sha256(newContent);
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);

      await service.detectExternalChange(NOTE_ID);

      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { contentHash: newHash },
      });
    });

    it('re-indexes the note in the search engine after detecting a change', async () => {
      const newContent = 'modified content for re-indexing';
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);

      await service.detectExternalChange(NOTE_ID);

      expect(searchService.indexNote).toHaveBeenCalledWith(
        NOTE_ID,
        expect.any(String), // title
        newContent,
        {},
      );
    });

    it('throws NotFoundException when the note does not exist in the database', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(service.detectExternalChange(NOTE_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns null when the file is missing on disk (cannot detect change)', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote());
      filesService.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await service.detectExternalChange(NOTE_ID);

      expect(result).toBeNull();
    });

    it('does not update the DB when the file is missing on disk', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote());
      filesService.readFile.mockRejectedValue(new Error('ENOENT'));

      await service.detectExternalChange(NOTE_ID);

      expect(prisma.note.update).not.toHaveBeenCalled();
    });

    it('handles a stored hash of null (first-time detection)', async () => {
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: null }));
      filesService.readFile.mockResolvedValue(CONTENT);

      const result = await service.detectExternalChange(NOTE_ID);

      expect(result).not.toBeNull();
      expect(result!.previousHash).toBeNull();
      expect(result!.newHash).toBe(STORED_HASH);
    });

    it('does not throw when search re-indexing fails (error is swallowed)', async () => {
      const newContent = 'changed content';
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);
      searchService.indexNote.mockRejectedValue(new Error('Search engine unavailable'));

      // Should NOT throw even though indexNote failed
      await expect(service.detectExternalChange(NOTE_ID)).resolves.not.toThrow();
    });

    it('still updates the DB hash even when re-indexing fails', async () => {
      const newContent = 'changed content';
      const newHash = sha256(newContent);
      prisma.note.findUnique.mockResolvedValue(makeNote({ contentHash: STORED_HASH }));
      filesService.readFile.mockResolvedValue(newContent);
      searchService.indexNote.mockRejectedValue(new Error('Index down'));

      await service.detectExternalChange(NOTE_ID);

      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { contentHash: newHash },
      });
    });
  });

  // ─── batchValidateHashes ────────────────────────────────────────────────

  describe('batchValidateHashes', () => {
    it('returns empty buckets for an empty input array', async () => {
      const result = await service.batchValidateHashes([]);

      expect(result.unchanged).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('categorises unchanged notes correctly', async () => {
      prisma.note.findMany.mockResolvedValue([makeNote({ contentHash: STORED_HASH })]);
      filesService.readFile.mockResolvedValue(CONTENT);

      const result = await service.batchValidateHashes([NOTE_ID]);

      expect(result.unchanged).toContain(NOTE_ID);
      expect(result.changed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('categorises changed notes correctly', async () => {
      const modifiedContent = CONTENT + ' changed externally';
      prisma.note.findMany.mockResolvedValue([makeNote({ contentHash: STORED_HASH })]);
      filesService.readFile.mockResolvedValue(modifiedContent);

      const result = await service.batchValidateHashes([NOTE_ID]);

      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].noteId).toBe(NOTE_ID);
      expect(result.changed[0].storedHash).toBe(STORED_HASH);
      expect(result.changed[0].currentHash).toBe(sha256(modifiedContent));
      expect(result.unchanged).toHaveLength(0);
    });

    it('reports an error for notes absent from the database', async () => {
      prisma.note.findMany.mockResolvedValue([]); // no results for given IDs

      const result = await service.batchValidateHashes([NOTE_ID]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].noteId).toBe(NOTE_ID);
      expect(result.errors[0].reason).toContain('not found');
    });

    it('reports an error when the file is missing on disk', async () => {
      prisma.note.findMany.mockResolvedValue([makeNote()]);
      filesService.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await service.batchValidateHashes([NOTE_ID]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].noteId).toBe(NOTE_ID);
      expect(result.errors[0].reason).toContain('path');
    });

    it('handles a mix of unchanged, changed, and error notes', async () => {
      const ID_UNCHANGED = 'note-unchanged';
      const ID_CHANGED = 'note-changed';
      const ID_MISSING = 'note-missing';

      const changedContent = 'modified file content';
      const unchangedContent = 'original content';
      const unchangedHash = sha256(unchangedContent);
      const changedOriginalHash = sha256('original before edit');

      prisma.note.findMany.mockResolvedValue([
        makeNote({ id: ID_UNCHANGED, contentHash: unchangedHash, path: 'a.md' }),
        makeNote({ id: ID_CHANGED, contentHash: changedOriginalHash, path: 'b.md' }),
      ]);

      filesService.readFile.mockImplementation(async (_ws: string, path: string) => {
        if (path === 'a.md') return unchangedContent;
        if (path === 'b.md') return changedContent;
        throw new Error('ENOENT');
      });

      const result = await service.batchValidateHashes([ID_UNCHANGED, ID_CHANGED, ID_MISSING]);

      expect(result.unchanged).toContain(ID_UNCHANGED);
      expect(result.changed.map((c) => c.noteId)).toContain(ID_CHANGED);
      expect(result.errors.map((e) => e.noteId)).toContain(ID_MISSING);
    });

    it('is a read-only operation — never calls prisma.note.update', async () => {
      const modifiedContent = CONTENT + ' changed';
      prisma.note.findMany.mockResolvedValue([makeNote({ contentHash: STORED_HASH })]);
      filesService.readFile.mockResolvedValue(modifiedContent);

      await service.batchValidateHashes([NOTE_ID]);

      expect(prisma.note.update).not.toHaveBeenCalled();
    });

    it('clamps the input to 100 notes maximum', async () => {
      // Generate 150 IDs; only the first 100 should be queried
      const ids = Array.from({ length: 150 }, (_, i) => `note-${i}`);
      prisma.note.findMany.mockResolvedValue([]);

      await service.batchValidateHashes(ids);

      const calledWith = prisma.note.findMany.mock.calls[0][0] as {
        where: { id: { in: string[] } };
      };
      expect(calledWith.where.id.in).toHaveLength(100);
    });

    it('includes storedHash=null in the changed bucket for unhashed notes', async () => {
      prisma.note.findMany.mockResolvedValue([makeNote({ contentHash: null })]);
      filesService.readFile.mockResolvedValue(CONTENT);

      const result = await service.batchValidateHashes([NOTE_ID]);

      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].storedHash).toBeNull();
    });

    it('processes all notes in parallel (all findMany results used)', async () => {
      const ids = ['n1', 'n2', 'n3'];
      const notes = ids.map((id) =>
        makeNote({ id, contentHash: sha256(`content-${id}`), path: `${id}.md` }),
      );

      prisma.note.findMany.mockResolvedValue(notes);
      filesService.readFile.mockImplementation(async (_ws: string, path: string) => {
        const id = path.replace('.md', '');
        return `content-${id}`;
      });

      const result = await service.batchValidateHashes(ids);

      expect(result.unchanged).toHaveLength(3);
      expect(result.changed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
