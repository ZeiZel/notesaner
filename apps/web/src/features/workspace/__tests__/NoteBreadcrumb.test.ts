/**
 * Tests for NoteBreadcrumb — breadcrumb navigation for the note hierarchy.
 *
 * Tests cover pure-function logic only (no DOM/React rendering required):
 *   - buildBreadcrumbSegments: segment construction from path + metadata
 *   - deriveFilename: display-name extraction from file paths
 *
 * UI interaction tests (click handlers, dropdown) are left to Playwright e2e.
 */

import { describe, it, expect } from 'vitest';
import { buildBreadcrumbSegments, deriveFilename } from '../ui/NoteBreadcrumb';

// ---------------------------------------------------------------------------
// deriveFilename
// ---------------------------------------------------------------------------

describe('deriveFilename', () => {
  it('strips .md extension', () => {
    expect(deriveFilename('todo.md')).toBe('todo');
  });

  it('strips .txt extension', () => {
    expect(deriveFilename('notes.txt')).toBe('notes');
  });

  it('strips .canvas extension', () => {
    expect(deriveFilename('diagram.canvas')).toBe('diagram');
  });

  it('strips .mdx extension', () => {
    expect(deriveFilename('page.mdx')).toBe('page');
  });

  it('strips extension case-insensitively', () => {
    expect(deriveFilename('note.MD')).toBe('note');
    expect(deriveFilename('note.Md')).toBe('note');
  });

  it('does not strip unknown extensions', () => {
    expect(deriveFilename('image.png')).toBe('image.png');
  });

  it('handles filename without extension', () => {
    expect(deriveFilename('readme')).toBe('readme');
  });

  it('returns the last segment of a full path', () => {
    expect(deriveFilename('Projects/Web/todo.md')).toBe('todo');
  });

  it('handles empty string gracefully', () => {
    expect(deriveFilename('')).toBe('');
  });

  it('handles path with only slashes', () => {
    expect(deriveFilename('/')).toBe('');
  });

  it('preserves hyphens and underscores', () => {
    expect(deriveFilename('my-great_note.md')).toBe('my-great_note');
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — workspace root only
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — workspace root only', () => {
  it('returns a single root segment when notePath is undefined', () => {
    const segments = buildBreadcrumbSegments('My Vault');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      label: 'My Vault',
      path: '',
      isLast: true,
      isFolder: false,
    });
  });

  it('returns a single root segment when notePath is empty string', () => {
    const segments = buildBreadcrumbSegments('My Vault', '');
    expect(segments).toHaveLength(1);
    expect(segments[0]!.isLast).toBe(true);
  });

  it('returns a single root segment when notePath is whitespace only', () => {
    const segments = buildBreadcrumbSegments('My Vault', '   ');
    expect(segments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — flat note (no folders)
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — flat note', () => {
  it('builds two segments for a root-level note', () => {
    const segments = buildBreadcrumbSegments('Vault', 'todo.md');
    expect(segments).toHaveLength(2);
  });

  it('workspace root is first and not last', () => {
    const [root] = buildBreadcrumbSegments('Vault', 'todo.md');
    expect(root).toMatchObject({ label: 'Vault', path: '', isLast: false, isFolder: false });
  });

  it('note segment is last and not a folder', () => {
    const segments = buildBreadcrumbSegments('Vault', 'todo.md');
    const note = segments[segments.length - 1]!;
    expect(note).toMatchObject({ isLast: true, isFolder: false });
  });

  it('derives note label from filename when noteTitle is omitted', () => {
    const segments = buildBreadcrumbSegments('Vault', 'todo.md');
    const note = segments[segments.length - 1]!;
    expect(note.label).toBe('todo');
  });

  it('uses noteTitle over derived filename when provided', () => {
    const segments = buildBreadcrumbSegments('Vault', 'todo.md', 'My Todo List');
    const note = segments[segments.length - 1]!;
    expect(note.label).toBe('My Todo List');
  });

  it('note path equals the full notePath', () => {
    const segments = buildBreadcrumbSegments('Vault', 'todo.md');
    const note = segments[segments.length - 1]!;
    expect(note.path).toBe('todo.md');
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — nested folders
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — nested folders', () => {
  const PATH = 'Projects/Web/Frontend/todo.md';

  it('returns workspace + folder count + note', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    // Vault + Projects + Web + Frontend + todo = 5
    expect(segments).toHaveLength(5);
  });

  it('folder segments have isFolder=true', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    const folders = segments.slice(1, -1);
    expect(folders.every((s) => s.isFolder)).toBe(true);
  });

  it('folder paths are cumulative', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    expect(segments[1]!.path).toBe('Projects');
    expect(segments[2]!.path).toBe('Projects/Web');
    expect(segments[3]!.path).toBe('Projects/Web/Frontend');
  });

  it('note path is the full path', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    const note = segments[segments.length - 1]!;
    expect(note.path).toBe(PATH);
  });

  it('folder labels match path segment names', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    expect(segments[1]!.label).toBe('Projects');
    expect(segments[2]!.label).toBe('Web');
    expect(segments[3]!.label).toBe('Frontend');
  });

  it('note label is derived from filename when noteTitle is absent', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    expect(segments[4]!.label).toBe('todo');
  });

  it('no folder segment has isLast=true', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    const folders = segments.slice(1, -1);
    expect(folders.every((s) => !s.isLast)).toBe(true);
  });

  it('only the last segment has isLast=true', () => {
    const segments = buildBreadcrumbSegments('Vault', PATH);
    const lastCount = segments.filter((s) => s.isLast).length;
    expect(lastCount).toBe(1);
    expect(segments[segments.length - 1]!.isLast).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — URL-encoded paths
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — URL-encoded paths', () => {
  it('decodes percent-encoded folder names', () => {
    const segments = buildBreadcrumbSegments('Vault', 'My%20Projects/note.md');
    expect(segments[1]!.label).toBe('My Projects');
  });

  it('handles paths with spaces in folder names (non-encoded)', () => {
    const segments = buildBreadcrumbSegments('Vault', 'My Projects/note.md');
    expect(segments[1]!.label).toBe('My Projects');
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — ordering and stability
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — ordering', () => {
  it('always starts with workspace segment at index 0', () => {
    const workspaceName = 'Specific Vault';
    const segments = buildBreadcrumbSegments(workspaceName, 'a/b/c.md');
    expect(segments[0]!.label).toBe(workspaceName);
    expect(segments[0]!.path).toBe('');
  });

  it('does not mutate input arguments', () => {
    const name = 'Vault';
    const path = 'A/B/note.md';
    const pathCopy = path;
    buildBreadcrumbSegments(name, path);
    expect(path).toBe(pathCopy);
  });

  it('handles deeply nested paths (10 levels)', () => {
    const deepPath = 'a/b/c/d/e/f/g/h/i/note.md';
    const segments = buildBreadcrumbSegments('Vault', deepPath);
    // workspace + 9 folders + note = 11
    expect(segments).toHaveLength(11);
    expect(segments[segments.length - 1]!.isLast).toBe(true);
  });

  it('handles a path with only the filename (no folders)', () => {
    const segments = buildBreadcrumbSegments('Vault', 'standalone.md');
    expect(segments).toHaveLength(2);
    expect(segments[0]!.isFolder).toBe(false); // workspace root
    expect(segments[1]!.isLast).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBreadcrumbSegments — workspace name edge cases
// ---------------------------------------------------------------------------

describe('buildBreadcrumbSegments — workspace name', () => {
  it('preserves workspace name exactly', () => {
    const name = '  Vault with Spaces  ';
    const segments = buildBreadcrumbSegments(name, 'note.md');
    expect(segments[0]!.label).toBe(name);
  });

  it('handles empty workspace name', () => {
    const segments = buildBreadcrumbSegments('', 'note.md');
    expect(segments[0]!.label).toBe('');
  });
});
