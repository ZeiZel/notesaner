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
const mockAccess = vi.fn();

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
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
    // By default, files do NOT exist (access throws → no conflict)
    mockAccess.mockRejectedValue(new Error('ENOENT'));
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.totalNotes).toBe(2);
      // Both should be at root level when flattened
      for (const note of result.notes) {
        expect(note.targetPath).not.toContain('/');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Obsidian frontmatter parsing
  // -----------------------------------------------------------------------

  describe('parseObsidianFrontmatter', () => {
    it('returns empty result for content without frontmatter', () => {
      const result = service.parseObsidianFrontmatter('# Just a heading\n\nSome content.');
      expect(result.tags).toHaveLength(0);
      expect(result.aliases).toHaveLength(0);
      expect(result.title).toBeUndefined();
      expect(result.extra).toEqual({});
    });

    it('parses title from frontmatter', () => {
      const content = '---\ntitle: My Important Note\n---\n# Heading';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.title).toBe('My Important Note');
    });

    it('parses tags as YAML block list', () => {
      const content = '---\ntags:\n  - project\n  - meeting\n  - 2026\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.tags).toEqual(['project', 'meeting', '2026']);
    });

    it('parses tags as inline YAML array', () => {
      const content = '---\ntags: [project, meeting, research]\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.tags).toEqual(['project', 'meeting', 'research']);
    });

    it('strips leading # from Obsidian tag values', () => {
      const content = '---\ntags:\n  - "#project"\n  - "#meeting"\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.tags).toEqual(['project', 'meeting']);
    });

    it('parses aliases from frontmatter', () => {
      const content = '---\naliases:\n  - My Note\n  - Important Doc\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.aliases).toEqual(['My Note', 'Important Doc']);
    });

    it('parses aliases as inline array', () => {
      const content = '---\naliases: [Note A, Note B]\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.aliases).toEqual(['Note A', 'Note B']);
    });

    it('puts unknown keys in extra', () => {
      const content = '---\nstatus: done\npriority: high\nrating: 5\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.extra['status']).toBe('done');
      expect(result.extra['priority']).toBe('high');
      expect(result.extra['rating']).toBe(5);
    });

    it('handles boolean values in frontmatter', () => {
      const content = '---\npublished: true\ndraft: false\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.extra['published']).toBe(true);
      expect(result.extra['draft']).toBe(false);
    });

    it('handles mixed frontmatter with title, tags, aliases and extra', () => {
      const content =
        '---\ntitle: My Project Note\ntags:\n  - project\n  - active\naliases:\n  - Project\nstatus: in-progress\n---\nContent';
      const result = service.parseObsidianFrontmatter(content);
      expect(result.title).toBe('My Project Note');
      expect(result.tags).toEqual(['project', 'active']);
      expect(result.aliases).toEqual(['Project']);
      expect(result.extra['status']).toBe('in-progress');
    });
  });

  // -----------------------------------------------------------------------
  // parseSimpleYaml
  // -----------------------------------------------------------------------

  describe('parseSimpleYaml', () => {
    it('parses scalar string values', () => {
      const result = service.parseSimpleYaml('name: John\ncity: New York');
      expect(result['name']).toBe('John');
      expect(result['city']).toBe('New York');
    });

    it('parses quoted string values', () => {
      const result = service.parseSimpleYaml('title: "Hello: World"\nname: \'simple\'');
      expect(result['title']).toBe('Hello: World');
      expect(result['name']).toBe('simple');
    });

    it('parses block list values', () => {
      const result = service.parseSimpleYaml('tags:\n  - one\n  - two\n  - three');
      expect(result['tags']).toEqual(['one', 'two', 'three']);
    });

    it('parses inline array values', () => {
      const result = service.parseSimpleYaml('tags: [one, two, three]');
      expect(result['tags']).toEqual(['one', 'two', 'three']);
    });

    it('parses boolean values', () => {
      const result = service.parseSimpleYaml('active: true\ndraft: false');
      expect(result['active']).toBe(true);
      expect(result['draft']).toBe(false);
    });

    it('parses integer values', () => {
      const result = service.parseSimpleYaml('count: 42\nrating: 5');
      expect(result['count']).toBe(42);
      expect(result['rating']).toBe(5);
    });

    it('parses float values', () => {
      const result = service.parseSimpleYaml('progress: 0.75');
      expect(result['progress']).toBe(0.75);
    });

    it('parses null values', () => {
      const result = service.parseSimpleYaml('value: null\nother: ~');
      expect(result['value']).toBeNull();
      expect(result['other']).toBeNull();
    });

    it('skips comment lines', () => {
      const result = service.parseSimpleYaml('# This is a comment\nname: test');
      expect(result['name']).toBe('test');
      expect(Object.keys(result)).toHaveLength(1);
    });

    it('handles empty block value with no following list items', () => {
      const result = service.parseSimpleYaml('empty:\nname: test');
      expect(result['empty']).toBe('');
      expect(result['name']).toBe('test');
    });
  });

  // -----------------------------------------------------------------------
  // Obsidian embed conversion
  // -----------------------------------------------------------------------

  describe('convertObsidianEmbeds', () => {
    it('converts a simple image embed to standard markdown', () => {
      const result = service.convertObsidianEmbeds('![[photo.png]]');
      expect(result).toBe('![photo](photo.png)');
    });

    it('converts an image embed with width hint', () => {
      const result = service.convertObsidianEmbeds('![[diagram.png|500]]');
      expect(result).toBe('![500](diagram.png)');
    });

    it('converts an image embed with alt text', () => {
      const result = service.convertObsidianEmbeds('![[chart.png|My Chart]]');
      expect(result).toBe('![My Chart](chart.png)');
    });

    it('converts all supported image formats', () => {
      const formats = ['jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'avif'];
      for (const fmt of formats) {
        const result = service.convertObsidianEmbeds(`![[image.${fmt}]]`);
        expect(result).toContain('![');
        expect(result).not.toContain('obsidian-embed');
      }
    });

    it('converts non-image embeds (note transclusions) to HTML comments', () => {
      const result = service.convertObsidianEmbeds('![[Some Other Note]]');
      expect(result).toBe('<!-- obsidian-embed: Some Other Note -->');
    });

    it('converts non-image embeds with alias to comment using alias label', () => {
      const result = service.convertObsidianEmbeds('![[Note Title|Displayed Title]]');
      expect(result).toBe('<!-- obsidian-embed: Displayed Title -->');
    });

    it('encodes spaces in image paths', () => {
      const result = service.convertObsidianEmbeds('![[my photo.png]]');
      expect(result).toBe('![my photo](my%20photo.png)');
    });

    it('processes multiple embeds in content', () => {
      const content = 'Before ![[img1.png]] middle ![[img2.jpg|200]] after';
      const result = service.convertObsidianEmbeds(content);
      expect(result).toBe('Before ![img1](img1.png) middle ![200](img2.jpg) after');
    });
  });

  // -----------------------------------------------------------------------
  // Dataview inline field detection
  // -----------------------------------------------------------------------

  describe('hasInlineDataviewFields', () => {
    it('returns true when content has a standalone key:: value line', () => {
      const content = '# Note\n\nstatus:: done\n\nSome content.';
      expect(service.hasInlineDataviewFields(content)).toBe(true);
    });

    it('returns false for content without dataview fields', () => {
      const content = '# Note\n\nSome content without any fields.';
      expect(service.hasInlineDataviewFields(content)).toBe(false);
    });

    it('returns false when key:: value is inside a fenced code block', () => {
      const content = '# Note\n\n```\nstatus:: done\n```\n\nContent.';
      expect(service.hasInlineDataviewFields(content)).toBe(false);
    });

    it('returns false when key:: value is inside a dataview block', () => {
      const content = '# Note\n\n```dataview\nWHERE status:: done\n```\n';
      expect(service.hasInlineDataviewFields(content)).toBe(false);
    });

    it('returns true for multiple dataview fields', () => {
      const content = '# Note\n\npriority:: high\ndue:: 2026-12-01\nowner:: alice\n';
      expect(service.hasInlineDataviewFields(content)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Obsidian import (integration-style)
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].linkCount).toBe(2);
    });

    it('extracts tags from Obsidian frontmatter', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('---\ntags:\n  - project\n  - active\n---\n# My Project Note');
      mockStat.mockResolvedValue({ size: 70 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].tags).toEqual(['project', 'active']);
    });

    it('uses frontmatter title over H1 when both present', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue(
        '---\ntitle: Frontmatter Title\n---\n# Heading Title\n\nContent.',
      );
      mockStat.mockResolvedValue({ size: 80 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].title).toBe('Frontmatter Title');
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].warnings).toContainEqual(expect.stringContaining('Dataview'));
    });

    it('detects Obsidian inline dataview fields and adds a warning', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note\n\nstatus:: done\npriority:: high\n\nContent');
      mockStat.mockResolvedValue({ size: 60 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].warnings).toContainEqual(
        expect.stringContaining('Dataview inline fields'),
      );
    });

    it('detects embedded images and counts as attachments', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue(
        '# Note\n\nHere is an image ![[diagram.png]] and another ![[chart.png|500]].',
      );
      mockStat.mockResolvedValue({ size: 80 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].hasAttachments).toBe(true);
      expect(result.totalAttachments).toBe(2);
    });

    it('detects Obsidian comments (%%) and adds a warning', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note\n\n%%This is hidden%% visible text.');
      mockStat.mockResolvedValue({ size: 50 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].warnings).toContainEqual(expect.stringContaining('Obsidian comments'));
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      // Check that mkdir and writeFile were called with the correct path
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('imported'),
        expect.objectContaining({ recursive: true }),
      );
    });

    it('invokes progress callback during import', async () => {
      mockReaddir.mockResolvedValue([
        mockDirEntry('note1.md', false),
        mockDirEntry('note2.md', false),
      ]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      const progressEvents: string[] = [];
      await service.executeImport(
        'ws-001',
        '/tmp/import',
        {
          source: 'markdown',
          preserveFolderStructure: true,
          targetFolder: '',
          convertLinks: true,
          importAttachments: true,
          conflictStrategy: 'rename',
          parseObsidianWorkspace: false,
        },
        (event) => {
          progressEvents.push(event.phase);
        },
      );

      // Should have 'parsing', some 'importing', and a final 'complete'
      expect(progressEvents).toContain('parsing');
      expect(progressEvents).toContain('importing');
      expect(progressEvents[progressEvents.length - 1]).toBe('complete');
    });
  });

  // -----------------------------------------------------------------------
  // Conflict resolution strategies
  // -----------------------------------------------------------------------

  describe('resolveConflict', () => {
    it('returns the target path when file does not exist (no conflict)', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await service.resolveConflict('ws-001', 'notes/note.md', 'skip');
      expect(result).toBe('notes/note.md');
    });

    it('returns null for "skip" strategy when file exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await service.resolveConflict('ws-001', 'notes/note.md', 'skip');
      expect(result).toBeNull();
    });

    it('returns the original path for "overwrite" strategy when file exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await service.resolveConflict('ws-001', 'notes/note.md', 'overwrite');
      expect(result).toBe('notes/note.md');
    });

    it('returns a renamed path for "rename" strategy when file exists', async () => {
      // First call (original path) → exists
      // Second call (renamed path) → does not exist
      mockAccess
        .mockResolvedValueOnce(undefined) // notes/note.md exists
        .mockRejectedValueOnce(new Error('ENOENT')); // notes/note (1).md does not exist

      const result = await service.resolveConflict('ws-001', 'notes/note.md', 'rename');
      expect(result).toBe('notes/note (1).md');
    });

    it('increments rename counter when multiple conflicts exist', async () => {
      // Original, (1), and (2) all exist; (3) does not
      mockAccess
        .mockResolvedValueOnce(undefined) // notes/note.md
        .mockResolvedValueOnce(undefined) // notes/note (1).md
        .mockResolvedValueOnce(undefined) // notes/note (2).md
        .mockRejectedValueOnce(new Error('ENOENT')); // notes/note (3).md

      const result = await service.resolveConflict('ws-001', 'notes/note.md', 'rename');
      expect(result).toBe('notes/note (3).md');
    });
  });

  // -----------------------------------------------------------------------
  // Skip conflict integration
  // -----------------------------------------------------------------------

  describe('executeImport with conflict strategies', () => {
    it('skips notes that already exist when strategy is "skip"', async () => {
      mockReaddir.mockResolvedValue([
        mockDirEntry('existing.md', false),
        mockDirEntry('new.md', false),
      ]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      // existing.md exists, new.md does not
      mockAccess
        .mockResolvedValueOnce(undefined) // existing.md → conflict
        .mockRejectedValueOnce(new Error()); // new.md → no conflict

      const result = await service.executeImport('ws-001', '/tmp/vault', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'skip',
        parseObsidianWorkspace: false,
      });

      expect(result.importedNotes).toBe(1);
      expect(result.skippedFiles).toBe(1);
    });

    it('renames conflicting notes when strategy is "rename"', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('# Note');
      mockStat.mockResolvedValue({ size: 30 });

      // note.md exists, note (1).md does not
      mockAccess.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error());

      const result = await service.executeImport('ws-001', '/tmp/vault', {
        source: 'markdown',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.importedNotes).toBe(1);
      expect(result.skippedFiles).toBe(0);

      // The file should have been written with the renamed path
      const writtenPath: string = mockWriteFile.mock.calls[0]?.[0] as string;
      expect(writtenPath).toContain('note (1).md');
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      // The written content should contain wiki links
      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('[[Other Note]]');
    });

    it('normalizes Obsidian path-based links to note-name-only format', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('Link to [[folder/subfolder/Deep Note]].');
      mockStat.mockResolvedValue({ size: 40 });

      await service.executeImport('ws-001', '/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('[[Deep Note]]');
      expect(writtenContent).not.toContain('folder/subfolder');
    });

    it('preserves heading anchors in Obsidian links', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('See [[My Note#Introduction]] for details.');
      mockStat.mockResolvedValue({ size: 50 });

      await service.executeImport('ws-001', '/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('[[My Note#Introduction]]');
    });

    it('preserves aliases in Obsidian links', async () => {
      mockReaddir.mockResolvedValue([mockDirEntry('note.md', false)]);
      mockReadFile.mockResolvedValue('See [[My Long Note Title|short name]] for details.');
      mockStat.mockResolvedValue({ size: 50 });

      await service.executeImport('ws-001', '/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('[[My Long Note Title|short name]]');
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
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
        conflictStrategy: 'rename',
        parseObsidianWorkspace: false,
      });

      expect(result.notes[0].title).toBe('my-note');
    });
  });

  // -----------------------------------------------------------------------
  // Obsidian workspace config parsing
  // -----------------------------------------------------------------------

  describe('readObsidianWorkspaceConfig', () => {
    it('returns null when workspace.json does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await service.readObsidianWorkspaceConfig('/tmp/vault');
      expect(result).toBeNull();
    });

    it('returns lastOpenFiles when workspace.json is valid', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          lastOpenFiles: ['notes/note1.md', 'notes/note2.md', 'journal/2026-01-01.md'],
        }),
      );

      const result = await service.readObsidianWorkspaceConfig('/tmp/vault');
      expect(result).not.toBeNull();
      expect(result!.lastOpenFiles).toEqual([
        'notes/note1.md',
        'notes/note2.md',
        'journal/2026-01-01.md',
      ]);
    });

    it('returns empty lastOpenFiles when the key is missing', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ someOtherKey: true }));

      const result = await service.readObsidianWorkspaceConfig('/tmp/vault');
      expect(result).not.toBeNull();
      expect(result!.lastOpenFiles).toEqual([]);
    });

    it('returns null when workspace.json contains invalid JSON', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('{ invalid json }');

      const result = await service.readObsidianWorkspaceConfig('/tmp/vault');
      expect(result).toBeNull();
    });

    it('marks wasRecentlyOpen for notes in the lastOpenFiles list', async () => {
      // workspace.json accessible
      mockAccess
        .mockResolvedValueOnce(undefined) // .obsidian/workspace.json exists
        .mockRejectedValue(new Error('ENOENT')); // other access calls (conflict checks)

      // workspace.json content returned first, then note content
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({ lastOpenFiles: ['recent-note.md'] }))
        .mockResolvedValue('# Note Content');

      mockReaddir.mockResolvedValue([
        mockDirEntry('recent-note.md', false),
        mockDirEntry('old-note.md', false),
      ]);
      mockStat.mockResolvedValue({ size: 30 });

      const result = await service.previewImport('/tmp/vault', {
        source: 'obsidian',
        preserveFolderStructure: true,
        targetFolder: '',
        convertLinks: true,
        importAttachments: true,
        conflictStrategy: 'rename',
        parseObsidianWorkspace: true,
      });

      const recent = result.notes.find((n) => n.originalPath === 'recent-note.md');
      const old = result.notes.find((n) => n.originalPath === 'old-note.md');

      expect(recent?.wasRecentlyOpen).toBe(true);
      expect(old?.wasRecentlyOpen).toBeUndefined();
    });
  });
});
