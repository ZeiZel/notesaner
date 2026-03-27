import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteIndexingProcessor } from '../processors/note-indexing.processor';
import { INDEX_NOTE_JOB, REINDEX_WORKSPACE_JOB } from '../jobs.constants';
import type { IndexNoteJobData, ReindexWorkspaceJobData } from '../jobs.types';

// ---------------------------------------------------------------------------
// Mock fs/promises.readFile
// ---------------------------------------------------------------------------
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'fs/promises';
const mockReadFile = vi.mocked(readFile);

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------
const mockPrisma = {
  note: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

// ---------------------------------------------------------------------------
// BullMQ Job mock factory
// ---------------------------------------------------------------------------
function makeJob<T>(name: string, data: T) {
  return {
    name,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NoteIndexingProcessor', () => {
  let processor: NoteIndexingProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new NoteIndexingProcessor(mockPrisma as never);
  });

  // -------------------------------------------------------------------------
  // index-note job
  // -------------------------------------------------------------------------

  describe('process — index-note', () => {
    const data: IndexNoteJobData = {
      noteId: 'note-uuid-1',
      workspaceId: 'ws-uuid-1',
      filePath: '/vault/ws-uuid-1/notes/my-note.md',
    };

    it('indexes a note successfully', async () => {
      const mockNote = {
        id: 'note-uuid-1',
        title: 'My Note',
        tags: [
          { tag: { name: 'typescript' } },
          { tag: { name: 'testing' } },
        ],
      };

      mockPrisma.note.findFirst.mockResolvedValue(mockNote);
      mockReadFile.mockResolvedValue(`---
title: My Note
---

# Introduction

This is the body text.`) ;
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const job = makeJob(INDEX_NOTE_JOB, data);
      const result = await processor.process(job as never);

      expect(result).toMatchObject({ noteId: 'note-uuid-1', indexed: true });
      expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('returns indexed=false when note is not found or trashed', async () => {
      mockPrisma.note.findFirst.mockResolvedValue(null);

      const job = makeJob(INDEX_NOTE_JOB, data);
      const result = await processor.process(job as never);

      expect(result).toMatchObject({ noteId: 'note-uuid-1', indexed: false });
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('returns indexed=false when file cannot be read', async () => {
      const mockNote = {
        id: 'note-uuid-1',
        title: 'My Note',
        tags: [],
      };

      mockPrisma.note.findFirst.mockResolvedValue(mockNote);
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const job = makeJob(INDEX_NOTE_JOB, data);
      const result = await processor.process(job as never);

      expect(result).toMatchObject({ noteId: 'note-uuid-1', indexed: false });
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('includes durationMs in result', async () => {
      const mockNote = { id: 'note-uuid-1', title: 'T', tags: [] };
      mockPrisma.note.findFirst.mockResolvedValue(mockNote);
      mockReadFile.mockResolvedValue('# Heading\n\nBody.');
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const job = makeJob(INDEX_NOTE_JOB, data);
      const result = await processor.process(job as never);

      expect((result as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // reindex-workspace job
  // -------------------------------------------------------------------------

  describe('process — reindex-workspace', () => {
    const data: ReindexWorkspaceJobData = { workspaceId: 'ws-uuid-1' };

    it('throws when workspace not found', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      const job = makeJob(REINDEX_WORKSPACE_JOB, data);
      await expect(processor.process(job as never)).rejects.toThrow('ws-uuid-1 not found');
    });

    it('processes all notes and returns summary', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-uuid-1',
        storagePath: '/vault/ws-uuid-1',
      });

      const notes = [
        {
          id: 'note-1',
          path: 'notes/one.md',
          title: 'One',
          tags: [],
        },
        {
          id: 'note-2',
          path: 'notes/two.md',
          title: 'Two',
          tags: [{ tag: { name: 'tag1' } }],
        },
      ];

      // First call returns notes, second returns empty (end of pages)
      mockPrisma.note.findMany
        .mockResolvedValueOnce(notes)
        .mockResolvedValueOnce([]);

      mockReadFile.mockResolvedValue('# Heading\n\nBody text here.');
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const job = makeJob(REINDEX_WORKSPACE_JOB, data);
      const result = await processor.process(job as never);

      expect(result).toMatchObject({
        workspaceId: 'ws-uuid-1',
        total: 2,
        succeeded: 2,
        failed: 0,
      });
    });

    it('counts file-read failures in the failed counter', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-uuid-1',
        storagePath: '/vault/ws-uuid-1',
      });

      const notes = [
        { id: 'note-1', path: 'notes/one.md', title: 'One', tags: [] },
        { id: 'note-2', path: 'notes/two.md', title: 'Two', tags: [] },
      ];

      mockPrisma.note.findMany
        .mockResolvedValueOnce(notes)
        .mockResolvedValueOnce([]);

      // First note reads fine, second fails
      mockReadFile
        .mockResolvedValueOnce('# H\n\nBody.')
        .mockRejectedValueOnce(new Error('Permission denied'));

      mockPrisma.$executeRaw.mockResolvedValue(1);

      const job = makeJob(REINDEX_WORKSPACE_JOB, data);
      const result = await processor.process(job as never);

      expect(result).toMatchObject({
        total: 2,
        succeeded: 1,
        failed: 1,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Unknown job name
  // -------------------------------------------------------------------------

  it('throws for unknown job name', async () => {
    const job = makeJob('unknown-job', {});
    await expect(processor.process(job as never)).rejects.toThrow('Unknown job name');
  });
});
