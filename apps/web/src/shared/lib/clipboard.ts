/**
 * clipboard.ts — Clipboard utility functions.
 *
 * Provides cross-browser clipboard write operations with:
 *   - Plain text copy
 *   - Rich text (HTML) copy
 *   - Markdown-formatted copy
 *   - Fallback for browsers without Clipboard API
 *
 * All functions are async and return a boolean indicating success.
 * They are framework-agnostic — React integration is in useClipboard hook.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClipboardWriteOptions {
  /** When true, also writes HTML to the clipboard for rich paste support. */
  html?: string;
  /** When provided, writes this as the plain text representation. */
  plainText?: string;
}

export type ClipboardFormat = 'plain' | 'markdown' | 'html';

// ---------------------------------------------------------------------------
// Core copy functions
// ---------------------------------------------------------------------------

/**
 * Copies plain text to the clipboard.
 *
 * Uses the modern Clipboard API when available, falls back to
 * execCommand('copy') for older browsers.
 *
 * @returns true if the copy succeeded.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  } catch {
    return fallbackCopy(text);
  }
}

/**
 * Copies rich content to the clipboard with both plain text and HTML representations.
 * This allows pasting into rich text editors with formatting preserved.
 *
 * @returns true if the copy succeeded.
 */
export async function copyRichText(plainText: string, html: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.write) {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob,
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    // Fallback: copy plain text only
    return await copyText(plainText);
  } catch {
    return copyText(plainText);
  }
}

// ---------------------------------------------------------------------------
// Specialized copy helpers
// ---------------------------------------------------------------------------

/**
 * Copies a code block's content to the clipboard.
 * Trims trailing whitespace and normalizes line endings.
 */
export async function copyCodeBlock(code: string): Promise<boolean> {
  const normalized = code.replace(/\r\n/g, '\n').trimEnd();
  return copyText(normalized);
}

/**
 * Copies a note link in the format [[Note Title]].
 * Optionally includes a plain URL for external paste targets.
 */
export async function copyNoteLink(noteTitle: string, noteUrl?: string): Promise<boolean> {
  const wikiLink = `[[${noteTitle}]]`;

  if (noteUrl) {
    // Rich copy: wiki link as plain text, HTML anchor for rich editors
    const html = `<a href="${escapeHtml(noteUrl)}">${escapeHtml(noteTitle)}</a>`;
    return copyRichText(wikiLink, html);
  }

  return copyText(wikiLink);
}

/**
 * Copies a block reference in the format [[Note Title#^block-id]].
 */
export async function copyBlockReference(
  noteTitle: string,
  blockId: string,
  noteUrl?: string,
): Promise<boolean> {
  const ref = `[[${noteTitle}#^${blockId}]]`;

  if (noteUrl) {
    const url = `${noteUrl}#${blockId}`;
    const html = `<a href="${escapeHtml(url)}">${escapeHtml(noteTitle)} &gt; ${escapeHtml(blockId)}</a>`;
    return copyRichText(ref, html);
  }

  return copyText(ref);
}

/**
 * Copies a note title as plain text.
 */
export async function copyNoteTitle(title: string): Promise<boolean> {
  return copyText(title);
}

// ---------------------------------------------------------------------------
// Fallback for browsers without Clipboard API
// ---------------------------------------------------------------------------

function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;

  // Prevent scrolling to bottom
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }

  document.body.removeChild(textarea);
  return success;
}

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
