/**
 * Unit tests for ImportService.
 *
 * Filesystem operations are mocked so no real I/O is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException as _BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn();
const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

vi.mock('@nestjs/config', () => ({
  ConfigService: class {
    get(key: string) {
      if (key === 'storage.root') return '/test/storage';
      return undefined;
    }
  },
}));

import { ImportService } from '../import.service';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function mockDirEntry(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImportService(new ConfigService());
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // previewImport
  // -----------------------------------------------------------------------

  describe('previewImport', () => {
    it('returns empty result for directory with no markdown files', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await service.previewImport('/tmp/empty', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.totalNotes).toBe(0);
      expect(result.warnings).toContain('No markdown files found in the uploaded content.');
    });

    it('parses markdown files and returns preview', async () => {
      mockReaddir.mockResolvedValue([
        mockDirEntry('note1.md', false),
        mockDirEntry('note2.md', false),
        mockDirEntry('image.png', false),
      ]);
      mockReadFile.mockResolvedValue('# Test Note\n\nSome content.');
      mockStat.mockResolvedValue({ size: 100 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.totalNotes).toBe(2);
      expect(result.notes[0].title).toBe('Test Note');
    });

    it('respects targetFolder in preview paths', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# My Note');
      mockStat.mockResolvedValue({ size: 50 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: 'imported/obsidian',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].targetPath).toBe('imported/obsidian/note.md');
    });

    it('flattens folder structure when preserveFolderStructure is false', async () => {
      // Root has a subfolder
      mockReaddir
        .mockResolvedValueOnce([
          mockDirEntry('subfolder', true),
          mockDirEntry('root-note.md', false),
        ])
        .mockResolvedValueOnce([mockDirEntry('nested-note.md', false)]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: false,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.totalNotes).toBe(2);
      // Both should be at root level when flattened
      for (const note of result.notes) {
        expect(note.targetPath).not.toContain('/');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Obsidian parsing
  // -----------------------------------------------------------------------

  describe('Obsidian import', () => {
    it('skips .obsidian and .trash directories', async () => {
      mockReaddir.mockResolvedValueOnce([
        mockDirEntry('.obsidian', true),
        mockDirEntry('.trash', true),
        mockDirEntry('note.md', false),
      ]);
      mockReadFile.mockResolvedValue('# Valid Note');
      mockStat.mockResolvedValue({ size: 50 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.totalNotes).toBe(1);
      expect(result.notes[0].title).toBe('Valid Note');
    });

    it('extracts wiki links from Obsidian content', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note\n\nLink to [[Other Note]] and [[Folder/Deep|alias]].');
      mockStat.mockResolvedValue({ size: 80 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].linkCount).toBe(2);
    });

    it('detects Dataview queries and adds warnings', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note\n\n```dataview\nTABLE file.name\n```');
      mockStat.mockResolvedValue({ size: 60 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].warnings).toContainEqual(expect.stringContaining('Dataview'));
    });
  });

  // -----------------------------------------------------------------------
  // Notion parsing
  // -----------------------------------------------------------------------

  describe('Notion import', () => {
    it('cleans Notion hex suffixes from paths', async () => {
      mockReaddir.mockResolvedValue([
        mockDirEntry('My Page a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4.md', false),
      ]);
      mockReadFile.mockResolvedValue('# My Page\n\nContent.');
      mockStat.mockResolvedValue({ size: 40 });

      const result = await service.previewImport('/tmp/notion', {
        source: 'notion',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].originalPath).not.toContain('a1b2c3d4e5f6');
    });

    it('converts CSV files to markdown tables', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('database.csv', false)]);
      mockReadFile.mockResolvedValue(
        'Name,Status,Date\nTask 1,Done,2026-01-01\nTask 2,In Progress,2026-01-02',
      );
      mockStat.mockResolvedValue({ size: 80 });

      const result = await service.previewImport('/tmp/notion', {
        source: 'notion',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.totalNotes).toBe(1);
      expect(result.notes[0].warnings).toContainEqual(expect.stringContaining('CSV'));
    });
  });

  // -----------------------------------------------------------------------
  // Logseq parsing
  // -----------------------------------------------------------------------

  describe('Logseq import', () => {
    it('skips logseq/ config directory', async () => {
      // Root dir has logseq/ and pages/
      mockReaddir
        .mockResolvedValueOnce([mockDirEntry('logseq', true), mockDirEntry('pages', true)])
        // pages/ dir
        .mockResolvedValueOnce([mockDirEntry('note.md', false)])
        // logseq/ dir
        .mockResolvedValueOnce([mockDirEntry('config.edn', false)]);
      mockReadFile.mockResolvedValue('- # My Page\n- Some bullet point');
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true }) // pages dir check
        .mockRejectedValueOnce(new Error('ENOENT')) // journals dir check
        .mockResolvedValue({ size: 50 }); // file stat

      const result = await service.previewImport('/tmp/logseq', {
        source: 'logseq',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      // Should only have the note, not config files
      const configNotes = result.notes.filter((n) => n.originalPath.startsWith('logseq/'));
      expect(configNotes).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // executeImport
  // -----------------------------------------------------------------------

  describe('executeImport', () => {
    it('writes markdown files to the workspace storage', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Test Note\n\nContent.');
      mockStat.mockResolvedValue({ size: 40 });

      const result = await service.executeImport('ws-001', '/tmp/import', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.importedNotes).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('handles write errors gracefully and continues importing', async () => {
      mockReaddir.mockResolvedValue([
        mockDirEntry('note1.md', false),
        mockDirEntry('note2.md', false),
      ]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      // First write fails, second succeeds
      mockWriteFile.mockRejectedValueOnce(new Error('EACCES')).mockResolvedValueOnce(undefined);

      const result = await service.executeImport('ws-001', '/tmp/import', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.importedNotes).toBe(1);
      expect(result.skippedFiles).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].recoverable).toBe(true);
    });

    it('places notes in the target folder', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      await service.executeImport('ws-001', '/tmp/import', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: 'imported',
        convertLinks: true,
        importAttachments: true,
      });

      // Check that mkdir and writeFile were called with the correct path
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('imported'),
        expect.objectContaining({ recursive: true }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Link conversion
  // -----------------------------------------------------------------------

  describe('link conversion', () => {
    it('preserves wiki links for Obsidian sources', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('Link to [[Other Note]].');
      mockStat.mockResolvedValue({ size: 30 });

      await service.executeImport('ws-001', '/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      // The written content should contain wiki links
      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('[[Other Note]]');
    });

    it('does not convert links when convertLinks is false', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      const originalContent = 'Link to [Other](other%20page.md).';
      mockReadFile.mockResolvedValue(originalContent);
      mockStat.mockResolvedValue({ size: 40 });

      await service.executeImport('ws-001', '/tmp/notion', {
        source: 'notion',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: false,
        importAttachments: true,
      });

      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toBe(originalContent);
    });
  });

  // -----------------------------------------------------------------------
  // Title extraction
  // -----------------------------------------------------------------------

  describe('title extraction', () => {
    it('extracts title from frontmatter', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('---\ntitle: My Custom Title\n---\n# Heading');
      mockStat.mockResolvedValue({ size: 50 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].title).toBe('My Custom Title');
    });

    it('extracts title from first H1 when no frontmatter', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# First Heading\n\nContent.');
      mockStat.mockResolvedValue({ size: 30 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].title).toBe('First Heading');
    });

    it('falls back to filename when no title found', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('my-note.md', false)]);
      mockReadFile.mockResolvedValue('Some content without headings.');
      mockStat.mockResolvedValue({ size: 30 });

      const result = await service.previewImport('/tmp/notes', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
      });

      expect(result.notes[0].title).toBe('my-note');
    });
  });
});
