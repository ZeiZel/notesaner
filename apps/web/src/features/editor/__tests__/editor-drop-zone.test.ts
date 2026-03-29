/**
 * Unit tests for EditorDropZone pure helper logic.
 *
 * Since @testing-library/react and @vitejs/plugin-react are not installed,
 * we test the exported pure functions that encode the business logic. The
 * React component rendering is covered by E2E / integration tests.
 *
 * Helpers tested:
 *   - buildMarkdownLink     — image vs. file markdown syntax
 *   - isImageFile           — MIME type and extension classification
 *   - getEditorFileExtension — filename parsing
 *   - generateId            — uniqueness
 *   - MAX_FILE_SIZE constants
 */

import { describe, it, expect } from 'vitest';
import {
  buildMarkdownLink,
  isImageFile,
  getEditorFileExtension,
  generateId,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
} from '../ui/EditorDropZone';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

// ---------------------------------------------------------------------------
// buildMarkdownLink
// ---------------------------------------------------------------------------

describe('buildMarkdownLink', () => {
  it('creates an image link when asImage is true', () => {
    expect(buildMarkdownLink('photo.png', 'https://cdn.example.com/photo.png', true)).toBe(
      '![photo](https://cdn.example.com/photo.png)',
    );
  });

  it('creates a file link when asImage is false', () => {
    expect(buildMarkdownLink('report.pdf', 'https://cdn.example.com/report.pdf', false)).toBe(
      '[report](https://cdn.example.com/report.pdf)',
    );
  });

  it('strips file extension from the label', () => {
    expect(buildMarkdownLink('my-document.docx', '/files/my-document.docx', false)).toBe(
      '[my-document](/files/my-document.docx)',
    );
  });

  it('handles filenames without extension', () => {
    expect(buildMarkdownLink('README', '/files/README', false)).toBe('[README](/files/README)');
  });

  it('preserves URL with query params', () => {
    const url = 'https://cdn.example.com/img.png?v=123';
    expect(buildMarkdownLink('img.png', url, true)).toBe(`![img](${url})`);
  });

  it('handles filenames with multiple dots — strips only last extension', () => {
    // "archive.tar.gz" → label "archive.tar"
    // But our regex removes only the last extension group
    const result = buildMarkdownLink('archive.tar.gz', '/files/archive.tar.gz', false);
    expect(result).toBe('[archive.tar](/files/archive.tar.gz)');
  });
});

// ---------------------------------------------------------------------------
// isImageFile
// ---------------------------------------------------------------------------

describe('isImageFile', () => {
  it('returns true for image MIME types (regardless of filename)', () => {
    for (const mime of IMAGE_MIME_TYPES) {
      expect(isImageFile(makeFile('unnamed', mime)), mime).toBe(true);
    }
  });

  it('returns true for files with image extensions', () => {
    for (const ext of IMAGE_EXTENSIONS) {
      const file = makeFile(`file.${ext}`);
      expect(isImageFile(file), `.${ext}`).toBe(true);
    }
  });

  it('returns false for PDF files', () => {
    expect(isImageFile(makeFile('doc.pdf', 'application/pdf'))).toBe(false);
  });

  it('returns false for markdown files', () => {
    expect(isImageFile(makeFile('note.md', 'text/markdown'))).toBe(false);
  });

  it('returns false for text files', () => {
    expect(isImageFile(makeFile('readme.txt', 'text/plain'))).toBe(false);
  });

  it('returns false for zip files', () => {
    expect(isImageFile(makeFile('archive.zip', 'application/zip'))).toBe(false);
  });

  it('classifies image/svg+xml as image', () => {
    expect(isImageFile(makeFile('icon.svg', 'image/svg+xml'))).toBe(true);
  });

  it('classifies image/webp as image', () => {
    expect(isImageFile(makeFile('photo.webp', 'image/webp'))).toBe(true);
  });

  it('is case-insensitive for extensions (PNG, JPG)', () => {
    expect(isImageFile(makeFile('photo.PNG'))).toBe(true);
    expect(isImageFile(makeFile('photo.JPG'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getEditorFileExtension
// ---------------------------------------------------------------------------

describe('getEditorFileExtension', () => {
  it('extracts lowercase extension from standard filename', () => {
    expect(getEditorFileExtension('photo.png')).toBe('png');
    expect(getEditorFileExtension('document.PDF')).toBe('pdf');
  });

  it('returns empty string for filename without extension', () => {
    expect(getEditorFileExtension('README')).toBe('');
  });

  it('uses last dot for multiple-dot filenames', () => {
    expect(getEditorFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('handles empty string', () => {
    expect(getEditorFileExtension('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe('generateId', () => {
  it('generates a string starting with editor-upload-', () => {
    const id = generateId();
    expect(id.startsWith('editor-upload-')).toBe(true);
  });

  it('generates unique IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('EditorDropZone — constants', () => {
  it('MAX_FILE_SIZE_MB is 50', () => {
    expect(MAX_FILE_SIZE_MB).toBe(50);
  });

  it('MAX_FILE_SIZE_BYTES equals 50 * 1024 * 1024', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});
