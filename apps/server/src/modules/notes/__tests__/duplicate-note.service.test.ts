/**
 * Unit tests for NotesService.duplicateNote
 *
 * All filesystem operations and downstream service calls are mocked so no
 * real I/O is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock dependencies — must be declared before importing the service so the
// module resolution picks up the mocked versions.
// ---------------------------------------------------------------------------

const mockScheduleNoteIndex = vi.fn();

vi.mock('../../jobs/jobs.service', () => ({
  JobsService: class {
    scheduleNoteIndex = mockScheduleNoteIndex;
  },
}));

vi.mock('@nestjs/config', () => ({
  ConfigService: class {
    get(key: string): string | undefined {
      if (key === 'storage.root') return '/test/storage';
      return undefined;
    }
  },
}));

// Track calls to fs.promises methods
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('fs', () => ({
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks
// ---------------------------------------------------------------------------

import { NotesService } from '../notes.service';
import { JobsService } from '../../jobs/jobs.service';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-aaa';
const NOTE_ID = 'note-bbb';
const USER_ID = 'user-ccc';

const SOURCE_NOTE = {
  id: NOTE_ID,
  workspaceId: WORKSPACE_ID,
  path: 'projects/my-note.md',
  title: 'My Note',
  frontmatter: { tags: ['project'], status: 'draft' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const CREATED_NOTE = {
  id: 'note-new-001',
  workspaceId: WORKSPACE_ID,
  path: 'projects/my-note-copy.md',
  title: 'Copy of My Note',
  frontmatter: { tags: ['project'], status: 'draft' },
  createdAt: new Date('2026-03-29T10:00:00.000Z'),
};

const SOURCE_CONTENT = `---
title: My Note
tags: [project]
status: draft
---

# My Note

Some content here.
`;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('NotesService.duplicateNote', () => {
  let service: NotesService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockScheduleNoteIndex.mockResolvedValue(undefined);

    service = new NotesService(
      new JobsService(
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
      ),
      new ConfigService(),
    );

    // Stub findById and create — they throw NotImplementedException by default
    vi.spyOn(service, 'findById').mockResolvedValue(SOURCE_NOTE);
    vi.spyOn(service, 'create').mockResolvedValue(CREATED_NOTE);
  });

  // -------------------------------------------------------------------------
  // Happy path — same folder, include properties (defaults)
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('should duplicate a note in the same folder with copied properties', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      const result = await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
      });

      // Returns the new note metadata
      expect(result.title).toBe('Copy of My Note');
      expect(result.path).toBe('projects/my-note-copy.md');
      expect(result.workspaceId).toBe(WORKSPACE_ID);
      expect(result.frontmatter).toEqual({ tags: ['project'], status: 'draft' });
      expect(result.createdAt).toBe('2026-03-29T10:00:00.000Z');
    });

    it('should write a file to the derived destination path', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
      });

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/storage/ws-aaa/projects/my-note-copy.md',
        SOURCE_CONTENT,
        'utf-8',
      );
    });

    it('should call create() with the correct title and path', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);
      const createSpy = vi.spyOn(service, 'create').mockResolvedValue(CREATED_NOTE);

      await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
      });

      expect(createSpy).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        expect.objectContaining({
          path: 'projects/my-note-copy.md',
          title: 'Copy of My Note',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // includeProperties: false — frontmatter should be stripped
  // -------------------------------------------------------------------------

  describe('includeProperties: false', () => {
    it('should return empty frontmatter when includeProperties is false', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      const result = await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: false,
      });

      expect(result.frontmatter).toEqual({});
    });

    it('should strip YAML frontmatter from the written file content', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: false,
      });

      const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
      expect(writtenContent).not.toContain('title: My Note');
      expect(writtenContent).toContain('# My Note');
    });
  });

  // -------------------------------------------------------------------------
  // targetFolderId — place copy in a different folder
  // -------------------------------------------------------------------------

  describe('targetFolderId', () => {
    it('should place the duplicate in the target folder when targetFolderId is provided', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      const result = await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
        targetFolderId: 'archive',
      });

      expect(result.path).toBe('archive/my-note-copy.md');
    });

    it('should write the file to the target folder path', async () => {
      mockReadFile.mockResolvedValue(SOURCE_CONTENT);

      await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
        targetFolderId: 'archive',
      });

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/storage/ws-aaa/archive/my-note-copy.md',
        SOURCE_CONTENT,
        'utf-8',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Note at workspace root (no sub-folder)
  // -------------------------------------------------------------------------

  describe('root-level note', () => {
    it('should handle notes at the workspace root (no directory prefix)', async () => {
      vi.spyOn(service, 'findById').mockResolvedValue({
        ...SOURCE_NOTE,
        path: 'standalone.md',
        title: 'Standalone',
      });
      vi.spyOn(service, 'create').mockResolvedValue({
        ...CREATED_NOTE,
        path: 'standalone-copy.md',
        title: 'Copy of Standalone',
      });
      mockReadFile.mockResolvedValue('# Standalone');

      const result = await service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, {
        includeProperties: true,
      });

      expect(result.path).toBe('standalone-copy.md');
    });
  });

  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------

  describe('error cases', () => {
    it('should throw NotFoundException when the source note does not exist', async () => {
      vi.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        service.duplicateNote(WORKSPACE_ID, 'nonexistent-id', USER_ID, {
          includeProperties: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should proceed with empty content and not throw when source file is missing on disk', async () => {
      mockReadFile.mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }),
      );

      // Should not throw — logs a warning and writes empty content instead
      await expect(
        service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, { includeProperties: true }),
      ).resolves.toBeDefined();

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should propagate errors from the filesystem write', async () => {
      mockReadFile.mockResolvedValue('# Content');
      mockWriteFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(
        service.duplicateNote(WORKSPACE_ID, NOTE_ID, USER_ID, { includeProperties: true }),
      ).rejects.toThrow('ENOSPC');
    });
  });
});
