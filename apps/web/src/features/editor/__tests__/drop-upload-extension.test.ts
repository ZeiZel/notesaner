/**
 * @vitest-environment jsdom
 *
 * Unit tests for the DropUploadExtension logic.
 *
 * Strategy: rather than trying to instantiate TipTap's Extension internals
 * (which use read-only getters on the prototype), we test the exported pure
 * helper functions that encode all the decision logic:
 *
 *   - isAcceptedDropFile  — which files pass the type filter
 *   - extractImageFilesFromClipboard  — clipboard image extraction
 *   - getFileExtension  — filename parsing
 *
 * The ProseMirror plugin just wires these helpers to TipTap callbacks; the
 * helpers themselves carry all the business rules and are fully testable.
 *
 * We also verify the extension module exports the expected shape.
 */

import { describe, it, expect } from 'vitest';
import {
  isAcceptedDropFile,
  extractImageFilesFromClipboard,
  getFileExtension,
  DropUploadExtension,
} from '../lib/drop-upload-extension';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

interface MockClipboardItem {
  kind: string;
  type: string;
  getAsFile: () => File | null;
}

function makeClipboardEvent(items: MockClipboardItem[]): ClipboardEvent {
  const clipboardData = {
    items: {
      ...items,
      length: items.length,
      [Symbol.iterator]: function* () {
        for (const item of items) yield item;
      },
    } as unknown as DataTransferItemList,
  } as DataTransfer;

  return { clipboardData } as unknown as ClipboardEvent;
}

// ---------------------------------------------------------------------------
// getFileExtension
// ---------------------------------------------------------------------------

describe('getFileExtension', () => {
  it('extracts lowercase extension', () => {
    expect(getFileExtension('photo.PNG')).toBe('png');
    expect(getFileExtension('document.MD')).toBe('md');
  });

  it('returns empty string for files without extension', () => {
    expect(getFileExtension('README')).toBe('');
    expect(getFileExtension('')).toBe('');
  });

  it('handles dotfiles (no extension)', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore');
  });

  it('handles multiple dots — uses last segment', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
    expect(getFileExtension('my.note.md')).toBe('md');
  });
});

// ---------------------------------------------------------------------------
// isAcceptedDropFile
// ---------------------------------------------------------------------------

describe('isAcceptedDropFile', () => {
  it('accepts common image extensions', () => {
    for (const name of [
      'photo.png',
      'photo.jpg',
      'photo.jpeg',
      'icon.gif',
      'logo.svg',
      'img.webp',
    ]) {
      expect(isAcceptedDropFile(makeFile(name)), name).toBe(true);
    }
  });

  it('accepts markdown and text files', () => {
    expect(isAcceptedDropFile(makeFile('note.md'))).toBe(true);
    expect(isAcceptedDropFile(makeFile('readme.txt'))).toBe(true);
  });

  it('accepts PDF attachments', () => {
    expect(isAcceptedDropFile(makeFile('report.pdf'))).toBe(true);
  });

  it('accepts files by MIME type regardless of extension', () => {
    // clipboard paste: name may be generic but MIME is set
    expect(isAcceptedDropFile(makeFile('blob', 'image/png'))).toBe(true);
    expect(isAcceptedDropFile(makeFile('data', 'image/jpeg'))).toBe(true);
    expect(isAcceptedDropFile(makeFile('frame', 'image/gif'))).toBe(true);
    expect(isAcceptedDropFile(makeFile('vector', 'image/svg+xml'))).toBe(true);
    expect(isAcceptedDropFile(makeFile('shot', 'image/webp'))).toBe(true);
  });

  it('rejects unsupported file types', () => {
    for (const name of ['archive.zip', 'video.mp4', 'audio.mp3', 'sheet.xlsx', 'script.js']) {
      expect(isAcceptedDropFile(makeFile(name)), name).toBe(false);
    }
  });

  it('rejects files with no extension and no recognized MIME type', () => {
    expect(isAcceptedDropFile(makeFile('binary', 'application/octet-stream'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractImageFilesFromClipboard
// ---------------------------------------------------------------------------

describe('extractImageFilesFromClipboard', () => {
  it('returns empty array when clipboardData is null', () => {
    const event = { clipboardData: null } as unknown as ClipboardEvent;
    expect(extractImageFilesFromClipboard(event)).toHaveLength(0);
  });

  it('returns empty array when no image items are present', () => {
    const event = makeClipboardEvent([
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
    ]);
    expect(extractImageFilesFromClipboard(event)).toHaveLength(0);
  });

  it('extracts a PNG image item and assigns a pasted-image filename', () => {
    const rawFile = makeFile('tmpfile', 'image/png');
    const event = makeClipboardEvent([
      { kind: 'file', type: 'image/png', getAsFile: () => rawFile },
    ]);

    const result = extractImageFilesFromClipboard(event);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('image/png');
    expect(result[0]?.name).toMatch(/^pasted-image-\d+\.png$/);
  });

  it('extracts a JPEG image item with correct extension', () => {
    const rawFile = makeFile('shot', 'image/jpeg');
    const event = makeClipboardEvent([
      { kind: 'file', type: 'image/jpeg', getAsFile: () => rawFile },
    ]);

    const result = extractImageFilesFromClipboard(event);

    expect(result[0]?.name).toMatch(/^pasted-image-\d+\.jpeg$/);
  });

  it('extracts WebP image item', () => {
    const rawFile = makeFile('frame', 'image/webp');
    const event = makeClipboardEvent([
      { kind: 'file', type: 'image/webp', getAsFile: () => rawFile },
    ]);

    const result = extractImageFilesFromClipboard(event);

    expect(result[0]?.name).toMatch(/^pasted-image-\d+\.webp$/);
  });

  it('skips non-file items (kind !== file)', () => {
    const event = makeClipboardEvent([
      { kind: 'string', type: 'image/png', getAsFile: () => null },
    ]);

    expect(extractImageFilesFromClipboard(event)).toHaveLength(0);
  });

  it('skips items where getAsFile() returns null', () => {
    const event = makeClipboardEvent([{ kind: 'file', type: 'image/png', getAsFile: () => null }]);

    expect(extractImageFilesFromClipboard(event)).toHaveLength(0);
  });

  it('skips non-image file items (e.g. application/pdf)', () => {
    const rawFile = makeFile('doc.pdf', 'application/pdf');
    const event = makeClipboardEvent([
      { kind: 'file', type: 'application/pdf', getAsFile: () => rawFile },
    ]);

    // PDFs are not accepted as clipboard pastes (only image/* types)
    expect(extractImageFilesFromClipboard(event)).toHaveLength(0);
  });

  it('extracts multiple image items from a single paste', () => {
    const png = makeFile('a.png', 'image/png');
    const jpg = makeFile('b.jpg', 'image/jpeg');
    const event = makeClipboardEvent([
      { kind: 'file', type: 'image/png', getAsFile: () => png },
      { kind: 'file', type: 'image/jpeg', getAsFile: () => jpg },
    ]);

    const result = extractImageFilesFromClipboard(event);

    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('image/png');
    expect(result[1]?.type).toBe('image/jpeg');
  });
});

// ---------------------------------------------------------------------------
// DropUploadExtension — module shape
// ---------------------------------------------------------------------------

describe('DropUploadExtension — module shape', () => {
  it('is defined', () => {
    expect(DropUploadExtension).toBeDefined();
  });

  it('has the correct extension name', () => {
    expect(DropUploadExtension.name).toBe('dropUpload');
  });

  it('exposes config.addProseMirrorPlugins', () => {
    expect(typeof DropUploadExtension.config.addProseMirrorPlugins).toBe('function');
  });

  it('exposes config.addOptions returning correct defaults', () => {
    const opts = DropUploadExtension.config.addOptions?.call({}) as {
      onFiles: unknown;
      disabled: unknown;
    };
    expect(typeof opts.onFiles).toBe('function');
    expect(opts.disabled).toBe(false);
  });
});
