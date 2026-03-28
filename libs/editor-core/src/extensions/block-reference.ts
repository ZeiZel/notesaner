/**
 * BlockReference — TipTap extension for selection-based block reference creation.
 *
 * Implements Obsidian-style block references (`^ref-id`) that allow users to
 * create addressable anchors within a note and copy references to them.
 *
 * Workflow:
 *   1. User selects text within a block (paragraph, heading, list item, etc.)
 *   2. User triggers "create block ref" (Ctrl/Cmd+Shift+B or command)
 *   3. Extension generates a unique ID (e.g. `a1b2c3`)
 *   4. Extension appends ` ^a1b2c3` to the end of the containing block
 *   5. Extension copies `[[note-title#^a1b2c3]]` to the clipboard
 *
 * Key design decisions:
 *   - Block IDs are stored inline as text at the end of the block, matching
 *     Obsidian's markdown format: `Some paragraph text ^abc123`
 *   - The `^id` suffix is a plain text marker, NOT a separate node. This keeps
 *     the markdown output clean and compatible with Obsidian/other tools.
 *   - IDs are 6-character alphanumeric strings generated from crypto.getRandomValues
 *     with a fallback to Math.random for non-secure contexts.
 *   - Existing block IDs are detected and reused (no duplicates on the same block).
 *   - The extension provides both a command and a keyboard shortcut.
 *   - The `noteTitle` option can be set dynamically (via configure or the command)
 *     so the clipboard reference includes the correct note path.
 *
 * Markdown output:
 *   ```markdown
 *   This is a paragraph with a block reference ^a1b2c3
 *   ```
 *
 * Clipboard output (when noteTitle is "My Note"):
 *   ```
 *   [[My Note#^a1b2c3]]
 *   ```
 *
 * Usage:
 * ```ts
 * import { BlockReference } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   BlockReference.configure({
 *     noteTitle: 'My Note',
 *     idLength: 6,
 *   }),
 * ];
 *
 * // Create a block reference at the current selection:
 * editor.commands.createBlockReference();
 *
 * // Create with a custom note title override:
 * editor.commands.createBlockReference({ noteTitle: 'Other Note' });
 *
 * // Remove a block reference from the block at cursor:
 * editor.commands.removeBlockReference();
 * ```
 */

import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options accepted by BlockReference.configure(). */
export interface BlockReferenceOptions {
  /**
   * The title/path of the current note, used when building the clipboard
   * reference string `[[noteTitle#^id]]`.
   *
   * If not set, the clipboard output will be `#^id` (local reference only).
   */
  noteTitle?: string | null;

  /**
   * Length of the generated block ID (number of alphanumeric characters).
   * Defaults to 6, producing IDs like "a1b2c3".
   * Minimum: 4, Maximum: 12.
   */
  idLength?: number;

  /**
   * Custom clipboard write function. By default uses `navigator.clipboard.writeText`.
   * Override for testing or non-browser environments.
   */
  writeToClipboard?: (text: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex that matches a block reference marker at the end of a text block. */
export const BLOCK_REF_REGEX = /\s\^([a-zA-Z0-9-]+)\s*$/;

/** Regex for validating block reference IDs (alphanumeric + hyphens). */
export const BLOCK_REF_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

/** Characters used for generating random block IDs. */
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a random alphanumeric ID of the specified length.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 *
 * @param length - Number of characters (clamped to 4-12).
 * @returns A random alphanumeric string.
 */
export function generateBlockId(length: number = 6): string {
  const safeLength = Math.max(4, Math.min(12, length));

  // Prefer crypto API for better randomness.
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(safeLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => ID_ALPHABET[b % ID_ALPHABET.length])
      .join('');
  }

  // Fallback for non-secure contexts.
  let id = '';
  for (let i = 0; i < safeLength; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

/**
 * Extract an existing block reference ID from the text content of a node.
 * Returns the ID string (without the `^` prefix) if found, or null.
 */
export function extractBlockRefId(text: string): string | null {
  const match = BLOCK_REF_REGEX.exec(text);
  return match?.[1] ?? null;
}

/**
 * Build the Obsidian-style reference string for clipboard.
 *
 * @param noteTitle - Note title/path, or null for a local-only reference.
 * @param blockId   - The block reference ID (without `^`).
 * @returns The formatted reference string.
 */
export function buildReferenceString(noteTitle: string | null, blockId: string): string {
  if (noteTitle) {
    return `[[${noteTitle}#^${blockId}]]`;
  }
  return `#^${blockId}`;
}

/**
 * Build the block reference suffix to append to a block's text.
 *
 * @param blockId - The block reference ID.
 * @returns The suffix string including a leading space and caret.
 */
export function buildBlockRefSuffix(blockId: string): string {
  return ` ^${blockId}`;
}

/**
 * Check whether a node's text content already contains a block reference.
 */
export function hasBlockRef(node: PmNode): boolean {
  return BLOCK_REF_REGEX.test(node.textContent);
}

/**
 * Validate that a block reference ID conforms to the expected format.
 */
export function isValidBlockRefId(id: string): boolean {
  if (id.length < 1 || id.length > 12) return false;
  return BLOCK_REF_ID_REGEX.test(id);
}

/**
 * Collect all block reference IDs used in a document.
 * Returns a Set of ID strings (without `^` prefix).
 */
export function collectBlockRefIds(doc: PmNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (node.isBlock && node.textContent) {
      const id = extractBlockRefId(node.textContent);
      if (id) ids.add(id);
    }
  });
  return ids;
}

/**
 * Generate a block ID that does not conflict with any existing ID in the document.
 *
 * @param existingIds - Set of IDs already in use.
 * @param length      - Desired ID length.
 * @param maxAttempts - Maximum generation attempts before giving up.
 * @returns A unique block ID.
 */
export function generateUniqueBlockId(
  existingIds: Set<string>,
  length: number = 6,
  maxAttempts: number = 100,
): string {
  for (let i = 0; i < maxAttempts; i++) {
    const id = generateBlockId(length);
    if (!existingIds.has(id)) return id;
  }

  // Extremely unlikely with 6-char IDs (36^6 = ~2 billion possibilities).
  // Fall back to a longer ID.
  return generateBlockId(Math.min(length + 2, 12));
}

// ---------------------------------------------------------------------------
// Default clipboard writer
// ---------------------------------------------------------------------------

async function defaultWriteToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / non-HTTPS contexts.
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockReference: {
      /**
       * Create a block reference for the block containing the current selection.
       * If the block already has a reference, reuses the existing ID.
       * Copies the reference string to the clipboard.
       *
       * @param options.noteTitle - Override the note title for this invocation.
       */
      createBlockReference: (options?: { noteTitle?: string }) => ReturnType;

      /**
       * Remove the block reference (^id suffix) from the block at the current
       * cursor position.
       */
      removeBlockReference: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const BlockReference = Extension.create<BlockReferenceOptions>({
  name: 'blockReference',

  addOptions() {
    return {
      noteTitle: null,
      idLength: 6,
      writeToClipboard: undefined,
    };
  },

  addCommands() {
    return {
      createBlockReference:
        (options) =>
        ({ state, dispatch, editor }) => {
          if (!dispatch) return true;

          const { $from } = state.selection;
          const { tr, doc } = state;

          // Find the enclosing block node at depth 1 (direct child of doc).
          let blockPos: number | null = null;
          let blockNode: PmNode | null = null;

          for (let depth = $from.depth; depth >= 1; depth--) {
            const node = $from.node(depth);
            if (node.isBlock) {
              blockPos = $from.before(depth);
              blockNode = node;
              break;
            }
          }

          if (blockPos === null || blockNode === null) return false;

          // Check if the block already has a reference ID.
          const existingId = extractBlockRefId(blockNode.textContent);
          const idLength = this.options.idLength ?? 6;
          const existingIds = collectBlockRefIds(doc);

          const blockId = existingId ?? generateUniqueBlockId(existingIds, idLength);

          // If the block does not already have the reference, append it.
          if (!existingId) {
            const suffix = buildBlockRefSuffix(blockId);
            const insertPos = blockPos + blockNode.nodeSize - 1; // Before closing tag.
            tr.insertText(suffix, insertPos);
          }

          dispatch(tr);

          // Build reference string and copy to clipboard.
          const noteTitle = options?.noteTitle ?? this.options.noteTitle ?? null;
          const refString = buildReferenceString(noteTitle, blockId);

          const clipboardWriter = this.options.writeToClipboard ?? defaultWriteToClipboard;

          // Clipboard write is async but we do not block the command on it.
          void clipboardWriter(refString).catch(() => {
            // Silently ignore clipboard failures (e.g., permissions denied).
          });

          editor.view.focus();
          return true;
        },

      removeBlockReference:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const { $from } = state.selection;
          const { tr } = state;

          // Find the enclosing block node.
          let blockPos: number | null = null;
          let blockNode: PmNode | null = null;

          for (let depth = $from.depth; depth >= 1; depth--) {
            const node = $from.node(depth);
            if (node.isBlock) {
              blockPos = $from.before(depth);
              blockNode = node;
              break;
            }
          }

          if (blockPos === null || blockNode === null) return false;

          const text = blockNode.textContent;
          const match = BLOCK_REF_REGEX.exec(text);
          if (!match) return false;

          // Calculate the absolute position of the reference suffix.
          // match.index gives the start within the text content.
          // We need to find the corresponding position within the ProseMirror node.
          const suffixStart = blockPos + 1 + match.index; // +1 for node open token
          const suffixEnd = suffixStart + match[0].length;

          tr.delete(suffixStart, suffixEnd);
          dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.createBlockReference(),
    };
  },
});
