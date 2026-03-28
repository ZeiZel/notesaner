/**
 * BlockReferencesService unit tests
 *
 * Tests cover:
 *   - extractBlockIds: single block, multiple blocks, no blocks, multi-line paragraphs
 *   - generateBlockId: format and uniqueness
 *   - getBlockContent: happy path, block not found, note not found
 *   - listBlocks: happy path, empty note
 *   - createBlockReference: new block, existing block, custom ID, line out of range
 *   - indexBlockReferences: create links, remove stale, no refs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BlockReferencesService } from '../block-references.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    note: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    noteLink: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeFilesService() {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BlockReferencesService', () => {
  let service: BlockReferencesService;
  let prisma: ReturnType<typeof makePrisma>;
  let filesService: ReturnType<typeof makeFilesService>;

  const WORKSPACE_ID = 'ws-1';
  const NOTE_ID = 'note-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    prisma = makePrisma();
    filesService = makeFilesService();
    service = new BlockReferencesService(prisma as never, filesService as never);
  });

  // ─── extractBlockIds ─────────────────────────────────────────────────────

  describe('extractBlockIds', () => {
    it('extracts a single block ID from a line', () => {
      const content = 'This is a paragraph ^abc123';
      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockId).toBe('abc123');
      expect(blocks[0].content).toBe('This is a paragraph');
      expect(blocks[0].line).toBe(1);
    });

    it('extracts multiple block IDs', () => {
      const content = [
        'First paragraph ^block1',
        '',
        'Second paragraph ^block2',
        '',
        'Third paragraph without block ID',
      ].join('\n');

      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockId).toBe('block1');
      expect(blocks[0].line).toBe(1);
      expect(blocks[1].blockId).toBe('block2');
      expect(blocks[1].line).toBe(3);
    });

    it('returns empty array for content without block IDs', () => {
      const content = 'Just a normal paragraph\n\nAnother paragraph';
      const blocks = service.extractBlockIds(content);
      expect(blocks).toEqual([]);
    });

    it('handles multi-line paragraphs', () => {
      const content = [
        'This is a long paragraph',
        'that spans multiple lines',
        'and has a block ID at the end ^multiline',
      ].join('\n');

      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockId).toBe('multiline');
      expect(blocks[0].content).toContain('This is a long paragraph');
      expect(blocks[0].content).toContain('that spans multiple lines');
      expect(blocks[0].content).toContain('and has a block ID at the end');
    });

    it('stops paragraph extraction at blank lines', () => {
      const content = ['Previous paragraph', '', 'Current paragraph ^myblock'].join('\n');

      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe('Current paragraph');
      expect(blocks[0].content).not.toContain('Previous');
    });

    it('stops paragraph extraction at headings', () => {
      const content = ['# Heading', 'Current paragraph ^myblock'].join('\n');

      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe('Current paragraph');
    });

    it('handles block IDs with hyphens', () => {
      const content = 'Content here ^my-block-id';
      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockId).toBe('my-block-id');
    });

    it('extracts block IDs from list items', () => {
      const content = '- List item content ^listblock';
      const blocks = service.extractBlockIds(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockId).toBe('listblock');
      expect(blocks[0].content).toBe('- List item content');
    });

    it('does not match inline ^caret that is not a block ID', () => {
      // No space before ^ — not a valid block ID declaration
      const content = 'x^2 + y^2 = z^2';
      const blocks = service.extractBlockIds(content);
      expect(blocks).toEqual([]);
    });
  });

  // ─── generateBlockId ─────────────────────────────────────────────────────

  describe('generateBlockId', () => {
    it('generates a 6-character alphanumeric string', () => {
      const id = service.generateBlockId();

      expect(id).toHaveLength(6);
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('generates unique IDs on successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.generateBlockId());
      }
      // With 100 IDs and 36^6 possible values, collision is extremely unlikely
      expect(ids.size).toBe(100);
    });
  });

  // ─── getBlockContent ─────────────────────────────────────────────────────

  describe('getBlockContent', () => {
    it('returns the block content when found', async () => {
      prisma.note.findFirst.mockResolvedValue({
        id: NOTE_ID,
        path: 'test.md',
        title: 'Test',
      });
      filesService.readFile.mockResolvedValue('Some content ^abc123');

      const result = await service.getBlockContent(WORKSPACE_ID, NOTE_ID, 'abc123');

      expect(result.blockId).toBe('abc123');
      expect(result.content).toBe('Some content');
      expect(result.line).toBe(1);
    });

    it('throws NotFoundException when block does not exist', async () => {
      prisma.note.findFirst.mockResolvedValue({
        id: NOTE_ID,
        path: 'test.md',
        title: 'Test',
      });
      filesService.readFile.mockResolvedValue('Content without block IDs');

      await expect(service.getBlockContent(WORKSPACE_ID, NOTE_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      prisma.note.findFirst.mockResolvedValue(null);

      await expect(service.getBlockContent(WORKSPACE_ID, 'missing-note', 'abc123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── listBlocks ──────────────────────────────────────────────────────────

  describe('listBlocks', () => {
    it('returns all blocks in a note', async () => {
      prisma.note.findFirst.mockResolvedValue({
        id: NOTE_ID,
        path: 'test.md',
        title: 'Test',
      });
      filesService.readFile.mockResolvedValue('First block ^block1\n\nSecond block ^block2');

      const result = await service.listBlocks(WORKSPACE_ID, NOTE_ID);

      expect(result.noteId).toBe(NOTE_ID);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].blockId).toBe('block1');
      expect(result.blocks[1].blockId).toBe('block2');
    });

    it('returns empty blocks array for note without block IDs', async () => {
      prisma.note.findFirst.mockResolvedValue({
        id: NOTE_ID,
        path: 'test.md',
        title: 'Test',
      });
      filesService.readFile.mockResolvedValue('Plain content');

      const result = await service.listBlocks(WORKSPACE_ID, NOTE_ID);

      expect(result.noteId).toBe(NOTE_ID);
      expect(result.blocks).toEqual([]);
    });
  });

  // ─── createBlockReference ────────────────────────────────────────────────

  describe('createBlockReference', () => {
    beforeEach(() => {
      prisma.note.findFirst.mockResolvedValue({
        id: NOTE_ID,
        path: 'test.md',
        title: 'Test',
      });
    });

    it('creates a new block ID on the specified line', async () => {
      filesService.readFile.mockResolvedValue('Some paragraph content');

      const result = await service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, {
        line: 1,
      });

      expect(result.created).toBe(true);
      expect(result.blockId).toMatch(/^[a-z0-9]+$/);
      expect(result.line).toBe(1);
      expect(result.content).toBe('Some paragraph content');

      // Verify file was written
      expect(filesService.writeFile).toHaveBeenCalledWith(
        WORKSPACE_ID,
        'test.md',
        expect.stringContaining('^'),
      );

      // Verify note metadata was updated
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { lastEditedById: USER_ID },
      });
    });

    it('uses a custom block ID when provided', async () => {
      filesService.readFile.mockResolvedValue('Some paragraph content');

      const result = await service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, {
        line: 1,
        blockId: 'custom-id',
      });

      expect(result.created).toBe(true);
      expect(result.blockId).toBe('custom-id');
    });

    it('returns existing block ID without modification', async () => {
      filesService.readFile.mockResolvedValue('Already tagged ^existing');

      const result = await service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, {
        line: 1,
      });

      expect(result.created).toBe(false);
      expect(result.blockId).toBe('existing');
      expect(filesService.writeFile).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for out-of-range line', async () => {
      filesService.readFile.mockResolvedValue('Single line');

      await expect(
        service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, { line: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for empty line', async () => {
      filesService.readFile.mockResolvedValue('Content\n\nMore content');

      await expect(
        service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, { line: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid Zod input', async () => {
      filesService.readFile.mockResolvedValue('Content');

      await expect(
        service.createBlockReference(WORKSPACE_ID, NOTE_ID, USER_ID, { line: -1 }),
      ).rejects.toThrow();
    });
  });

  // ─── indexBlockReferences ────────────────────────────────────────────────

  describe('indexBlockReferences', () => {
    const SOURCE_NOTE_ID = 'source-1';

    it('creates NoteLink entries for block reference links', async () => {
      const content = 'See [[My Note#^abc123]] for details';

      prisma.note.findMany.mockResolvedValue([{ id: 'target-1', title: 'My Note' }]);
      prisma.noteLink.findMany.mockResolvedValue([]);

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      expect(prisma.noteLink.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            sourceNoteId: SOURCE_NOTE_ID,
            targetNoteId: 'target-1',
            linkType: 'BLOCK_REF',
            blockId: 'abc123',
          }),
        ],
        skipDuplicates: true,
      });
    });

    it('removes stale BLOCK_REF links', async () => {
      const content = 'No block references here';

      prisma.noteLink.findMany.mockResolvedValue([
        { id: 'link-1', targetNoteId: 'target-1', blockId: 'old-block' },
      ]);

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      expect(prisma.noteLink.deleteMany).toHaveBeenCalledWith({
        where: { sourceNoteId: SOURCE_NOTE_ID, linkType: 'BLOCK_REF' },
      });
    });

    it('handles content with no block references', async () => {
      const content = 'Regular wiki link [[Note]] and no block refs';

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      // Should delete all existing BLOCK_REF links
      expect(prisma.noteLink.deleteMany).toHaveBeenCalledWith({
        where: { sourceNoteId: SOURCE_NOTE_ID, linkType: 'BLOCK_REF' },
      });
      expect(prisma.noteLink.createMany).not.toHaveBeenCalled();
    });

    it('handles multiple block references to different notes', async () => {
      const content = ['See [[Note A#^block1]] and [[Note B#^block2]]'].join('\n');

      prisma.note.findMany.mockResolvedValue([
        { id: 'target-a', title: 'Note A' },
        { id: 'target-b', title: 'Note B' },
      ]);
      prisma.noteLink.findMany.mockResolvedValue([]);

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      expect(prisma.noteLink.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            targetNoteId: 'target-a',
            blockId: 'block1',
          }),
          expect.objectContaining({
            targetNoteId: 'target-b',
            blockId: 'block2',
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('skips references to unresolved note titles', async () => {
      const content = 'See [[Nonexistent Note#^block1]]';

      prisma.note.findMany.mockResolvedValue([]); // no matching notes
      prisma.noteLink.findMany.mockResolvedValue([]);

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      // No valid refs to create, but stale links should still be cleaned
      expect(prisma.noteLink.createMany).not.toHaveBeenCalled();
    });

    it('preserves existing links that are still valid', async () => {
      const content = 'See [[My Note#^abc123]]';

      prisma.note.findMany.mockResolvedValue([{ id: 'target-1', title: 'My Note' }]);
      prisma.noteLink.findMany.mockResolvedValue([
        { id: 'existing-link', targetNoteId: 'target-1', blockId: 'abc123' },
      ]);

      await service.indexBlockReferences(SOURCE_NOTE_ID, WORKSPACE_ID, content);

      // Should not create duplicates
      expect(prisma.noteLink.createMany).not.toHaveBeenCalled();
      // Should not remove existing valid links
      expect(prisma.noteLink.deleteMany).not.toHaveBeenCalled();
    });
  });
});
