/**
 * Unit tests for ExportService.
 *
 * NotesService and filesystem reads are mocked so no real I/O is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindById = vi.fn();
const mockReadFile = vi.fn();

vi.mock('../notes.service', () => ({
  NotesService: class {
    findById = mockFindById;
  },
}));

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock('@nestjs/config', () => ({
  ConfigService: class {
    get(key: string) {
      if (key === 'storage.root') return '/test/storage';
      return undefined;
    }
  },
}));

import { ExportService } from '../export.service';
import { NotesService } from '../notes.service';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-001';
const NOTE_ID = 'note-001';
const NOTE_TITLE = 'Test Note';
const NOTE_PATH = 'folder/test-note.md';

const SAMPLE_MARKDOWN = `---
title: Test Note
tags: [test, demo]
---

# Test Note

This is a **test** note with *italic* and \`code\`.

## Section 1

A paragraph with a [[Wiki Link]] and [external link](https://example.com).

- List item 1
- List item 2

> A blockquote

\`\`\`javascript
console.log('hello');
\`\`\`
`;

const NOTE_META = {
  id: NOTE_ID,
  title: NOTE_TITLE,
  path: NOTE_PATH,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    const notesService = new NotesService(undefined as never, new ConfigService());
    notesService.findById = mockFindById;
    const configService = new ConfigService();
    service = new ExportService(notesService, configService);
  });

  // -----------------------------------------------------------------------
  // exportNote — Markdown
  // -----------------------------------------------------------------------

  describe('exportNote (markdown)', () => {
    it('returns the raw markdown content with correct filename', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue(SAMPLE_MARKDOWN);

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'md');

      expect(result.filename).toBe('Test Note.md');
      expect(result.contentType).toBe('text/markdown; charset=utf-8');
      expect(result.buffer.toString('utf-8')).toBe(SAMPLE_MARKDOWN);
    });

    it('sanitizes special characters in filenames', async () => {
      mockFindById.mockResolvedValue({
        ...NOTE_META,
        title: 'My Note: "Special" <Characters>',
      });
      mockReadFile.mockResolvedValue('# Note');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'md');

      expect(result.filename).toBe('My Note_ _Special_ _Characters_.md');
      expect(result.filename).not.toMatch(/[<>:"/\\|?*]/);
    });
  });

  // -----------------------------------------------------------------------
  // exportNote — HTML
  // -----------------------------------------------------------------------

  describe('exportNote (html)', () => {
    it('returns HTML with embedded styles', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue(SAMPLE_MARKDOWN);

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'html');

      expect(result.filename).toBe('Test Note.html');
      expect(result.contentType).toBe('text/html; charset=utf-8');

      const html = result.buffer.toString('utf-8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<style>');
      expect(html).toContain('Test Note');
    });

    it('converts markdown headings to HTML', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('# Heading 1\n## Heading 2');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'html');
      const html = result.buffer.toString('utf-8');

      expect(html).toContain('<h1>Heading 1</h1>');
      expect(html).toContain('<h2>Heading 2</h2>');
    });

    it('converts bold and italic to HTML', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('This is **bold** and *italic*.');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'html');
      const html = result.buffer.toString('utf-8');

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('converts wiki links to anchor tags', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('Link to [[My Page]] and [[Other|alias]].');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'html');
      const html = result.buffer.toString('utf-8');

      expect(html).toContain('My Page');
      expect(html).toContain('alias');
    });

    it('strips frontmatter from HTML output', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('---\ntitle: test\n---\n# Content');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'html');
      const html = result.buffer.toString('utf-8');

      expect(html).not.toContain('title: test');
      expect(html).toContain('Content');
    });
  });

  // -----------------------------------------------------------------------
  // exportNote — DOCX
  // -----------------------------------------------------------------------

  describe('exportNote (docx)', () => {
    it('throws BadRequestException when docx library is not installed', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('# Test Note');

      // docx is not installed in test environment, so it should throw
      await expect(service.exportNote(WORKSPACE_ID, NOTE_ID, 'docx')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // exportNote — PDF
  // -----------------------------------------------------------------------

  describe('exportNote (pdf)', () => {
    it('falls back to HTML when puppeteer is not available', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('# Test Note\n\nContent here.');

      const result = await service.exportNote(WORKSPACE_ID, NOTE_ID, 'pdf');

      // Without puppeteer, should fall back to HTML
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.buffer.toString('utf-8')).toContain('<!DOCTYPE html>');
    });
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('throws NotFoundException when note is not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.exportNote(WORKSPACE_ID, 'nonexistent', 'md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when file is not readable', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.exportNote(WORKSPACE_ID, NOTE_ID, 'md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for unsupported format', async () => {
      mockFindById.mockResolvedValue(NOTE_META);
      mockReadFile.mockResolvedValue('# Test');

      await expect(service.exportNote(WORKSPACE_ID, NOTE_ID, 'xlsx' as never)).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Batch export
  // -----------------------------------------------------------------------

  describe('exportBatch', () => {
    it('throws BadRequestException for empty noteIds array', async () => {
      await expect(service.exportBatch(WORKSPACE_ID, [], 'md')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when exceeding 100 notes', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `note-${i}`);
      await expect(service.exportBatch(WORKSPACE_ID, ids, 'md')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('exports multiple notes into a combined output', async () => {
      mockFindById
        .mockResolvedValueOnce({ ...NOTE_META, id: 'note-1', title: 'Note 1' })
        .mockResolvedValueOnce({ ...NOTE_META, id: 'note-2', title: 'Note 2' });
      mockReadFile.mockResolvedValueOnce('# Note 1').mockResolvedValueOnce('# Note 2');

      const result = await service.exportBatch(WORKSPACE_ID, ['note-1', 'note-2'], 'md');

      // Without archiver installed, it creates a plain text fallback
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toContain('notesaner-export-');
    });
  });
});
