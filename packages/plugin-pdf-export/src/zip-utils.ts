/**
 * zip-utils — Client-side zip creation for batch export.
 *
 * Uses `fflate` for deflate compression to create valid .zip archives
 * entirely in the browser (or Node.js test environment) without any server
 * round-trip.
 *
 * The primary entry point is `createZipBlob()` which accepts a map of
 * filename → content (string or Uint8Array) and returns a Promise<Blob>.
 *
 * For DOCX export the `packDocxEntries()` helper wraps a `DocxEntries` map
 * (from docx-renderer) into the structure expected by `createZipBlob`.
 */

import { strToU8, zipSync, type Zippable, type ZipOptions } from 'fflate';
import type { DocxEntries } from './docx-renderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A map of archive entry path → string or binary content. */
export type ZipFileMap = Record<string, string | Uint8Array>;

/** Progress information emitted during batch zip creation. */
export interface ZipProgress {
  /** Number of files processed so far. */
  processed: number;
  /** Total number of files in the archive. */
  total: number;
  /** 0–1 progress fraction. */
  fraction: number;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Encode a string to UTF-8 bytes using `fflate`'s `strToU8`.
 */
export function encodeText(text: string): Uint8Array {
  return strToU8(text);
}

/**
 * Create a Blob representing a zip archive from a map of paths to content.
 *
 * All string values are UTF-8 encoded.  Uint8Array values are used as-is.
 *
 * @param files    Map of archive entry paths → content
 * @param options  Optional compression level (0 = store, 9 = max; default: 6)
 * @returns        A Blob with MIME type `application/zip`
 */
export function createZipBlob(files: ZipFileMap, options: { level?: number } = {}): Blob {
  const level = options.level ?? 6;

  const zippable: Zippable = {};

  for (const [path, content] of Object.entries(files)) {
    const bytes = typeof content === 'string' ? encodeText(content) : content;
    const opts: ZipOptions = { level: level as ZipOptions['level'] };
    zippable[path] = [bytes, opts];
  }

  const zipped = zipSync(zippable);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Convert a DocxEntries map (from `renderToDocx`) into a ZipFileMap
 * suitable for `createZipBlob`.
 *
 * All DOCX entries are XML strings; no binary content is required for
 * text-only documents.
 */
export function packDocxEntries(entries: DocxEntries): ZipFileMap {
  const files: ZipFileMap = {};
  for (const [path, content] of Object.entries(entries)) {
    files[path] = content;
  }
  return files;
}

/**
 * Trigger a browser download of a Blob.
 *
 * Creates a temporary <a> element, sets its href to a blob: URL, clicks it,
 * and revokes the URL afterwards.  Safe to call in any browser context;
 * no-op in Node.js environments.
 *
 * @param blob      The Blob to download
 * @param filename  The suggested filename shown in the save dialog
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Revoke after a short delay to allow the download to start.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Sanitise a note title for use as a filename.
 *
 * Strips characters that are invalid in common filesystems and trims whitespace.
 *
 * @param title  The raw note title
 * @param ext    Optional file extension to append (with leading dot)
 */
export function titleToFilename(title: string, ext = ''): string {
  const sanitised = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 200); // maximum filename length

  return (sanitised || 'untitled') + ext;
}

// ---------------------------------------------------------------------------
// Batch export helpers
// ---------------------------------------------------------------------------

export interface BatchExportItem {
  /** Note ID (used for ordering / deduplication). */
  noteId: string;
  /** Filename within the zip archive. */
  filename: string;
  /** File content (string or bytes). */
  content: string | Uint8Array;
}

/**
 * Build a zip archive from a list of BatchExportItems with de-duplicated
 * filenames (appends _2, _3, etc. when names collide).
 *
 * @param items    Array of {noteId, filename, content}
 * @param level    Compression level (0–9; default: 6)
 * @returns        A ready-to-download zip Blob
 */
export function createBatchZipBlob(items: BatchExportItem[], level = 6): Blob {
  const seen = new Map<string, number>();
  const files: ZipFileMap = {};

  for (const item of items) {
    let filename = item.filename;
    const count = seen.get(filename) ?? 0;

    if (count > 0) {
      // Insert suffix before extension: "note.pdf" → "note_2.pdf"
      const dotIdx = filename.lastIndexOf('.');
      if (dotIdx > 0) {
        filename = `${filename.slice(0, dotIdx)}_${count + 1}${filename.slice(dotIdx)}`;
      } else {
        filename = `${filename}_${count + 1}`;
      }
    }

    seen.set(item.filename, count + 1);
    files[filename] = typeof item.content === 'string' ? encodeText(item.content) : item.content;
  }

  return createZipBlob(files, { level });
}

/**
 * Process a list of export items with optional progress callbacks.
 * Yields control back to the event loop between items so the UI doesn't freeze.
 *
 * @param items       Array of {noteId, filename, content}
 * @param onProgress  Called after each item is processed
 * @returns           The final zip Blob
 */
export async function createBatchZipBlobAsync(
  items: BatchExportItem[],
  onProgress?: (progress: ZipProgress) => void,
  level = 6,
): Promise<Blob> {
  const total = items.length;

  // Yield to let UI updates through before CPU-intensive work
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const seen = new Map<string, number>();
  const files: ZipFileMap = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let filename = item.filename;
    const count = seen.get(filename) ?? 0;

    if (count > 0) {
      const dotIdx = filename.lastIndexOf('.');
      if (dotIdx > 0) {
        filename = `${filename.slice(0, dotIdx)}_${count + 1}${filename.slice(dotIdx)}`;
      } else {
        filename = `${filename}_${count + 1}`;
      }
    }

    seen.set(item.filename, count + 1);
    files[filename] = typeof item.content === 'string' ? encodeText(item.content) : item.content;

    onProgress?.({
      processed: i + 1,
      total,
      fraction: (i + 1) / total,
    });

    // Yield every 10 items to keep UI responsive
    if (i % 10 === 9) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return createZipBlob(files, { level });
}
