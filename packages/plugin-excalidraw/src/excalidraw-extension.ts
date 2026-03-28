/**
 * ExcalidrawExtension — TipTap block node extension for embedding Excalidraw whiteboards.
 *
 * Node structure:
 *   - Block-level atom (rendered as a resizable embed within the note)
 *   - Stores the .excalidraw file path in `data-excalidraw-path`
 *   - Stores the embed height in `data-excalidraw-height`
 *   - Stores an optional link target note ID in `data-excalidraw-note-id`
 *
 * Slash command integration:
 *   The built-in slash command item for 'excalidraw' (already registered in
 *   libs/editor-core/src/extensions/slash-command.ts) calls
 *   `editor.commands.insertExcalidrawEmbed()` when activated.
 *
 * Usage:
 * ```ts
 * import { ExcalidrawExtension } from '@notesaner/plugin-excalidraw';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   ExcalidrawExtension.configure({
 *     generateFilePath: (noteId) => `drawings/${noteId}-${Date.now()}.excalidraw`,
 *   }),
 * ];
 * ```
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type React from 'react';

// Required for the lazy require() pattern used in addNodeView below.
// This matches the same pattern used in wiki-link.ts, footnote.ts, etc.
declare let require: (module: string) => unknown;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default embed height in pixels. */
export const DEFAULT_EMBED_HEIGHT = 400;

/** Minimum allowed embed height in pixels. */
export const MIN_EMBED_HEIGHT = 120;

/** Maximum allowed embed height in pixels. */
export const MAX_EMBED_HEIGHT = 2400;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExcalidrawNodeAttrs {
  /** Path to the .excalidraw file relative to workspace root. */
  filePath: string | null;
  /**
   * Embed height in pixels.
   * The user can drag a resize handle to change this.
   */
  height: number;
  /**
   * Optional ID of the note this whiteboard is linked to.
   * When set, the host can provide navigation between the note and the whiteboard.
   */
  linkedNoteId: string | null;
}

export interface ExcalidrawNodeOptions {
  /**
   * Called to generate a default file path when a new Excalidraw node is inserted.
   * Receives the current note ID (may be null if the note is not yet persisted).
   * Should return a relative path ending in ".excalidraw".
   *
   * Defaults to a timestamp-based path: "drawings/{timestamp}.excalidraw".
   */
  generateFilePath?: (noteId: string | null) => string;

  /**
   * Called when the user requests to open the whiteboard in full-screen mode.
   * Receives the file path of the drawing.
   */
  onOpenFullscreen?: (filePath: string) => void;

  /**
   * Called when the user exports the drawing as PNG or SVG.
   * Receives the file path and the export data (a Blob).
   */
  onExport?: (filePath: string, format: 'png' | 'svg', data: Blob) => void | Promise<void>;

  /** HTML attributes merged onto the rendered container element. */
  HTMLAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command declarations
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    excalidrawEmbed: {
      /**
       * Insert an Excalidraw embed block at the current cursor position.
       *
       * @param options.filePath     - Optional explicit file path; auto-generated when absent.
       * @param options.height       - Initial embed height in pixels (default: 400).
       * @param options.linkedNoteId - Optional note ID to link the drawing to.
       */
      insertExcalidrawEmbed: (options?: {
        filePath?: string;
        height?: number;
        linkedNoteId?: string | null;
      }) => ReturnType;

      /**
       * Update the file path of the Excalidraw node at the current selection.
       * Used after a new drawing is first saved.
       */
      setExcalidrawFilePath: (filePath: string) => ReturnType;

      /**
       * Update the embed height of the Excalidraw node at the current selection.
       * Called by the resize handle in ExcalidrawEmbed.tsx.
       */
      setExcalidrawHeight: (height: number) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const ExcalidrawExtension = Node.create<ExcalidrawNodeOptions>({
  name: 'excalidrawEmbed',

  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: false,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      generateFilePath: (noteId) => {
        const prefix = noteId ? noteId.slice(0, 8) : 'drawing';
        return `drawings/${prefix}-${Date.now()}.excalidraw`;
      },
      onOpenFullscreen: undefined,
      onExport: undefined,
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      filePath: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-excalidraw-path') ?? null,
        renderHTML: (attrs) =>
          attrs['filePath'] ? { 'data-excalidraw-path': attrs['filePath'] } : {},
      },
      height: {
        default: DEFAULT_EMBED_HEIGHT,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-excalidraw-height');
          const parsed = raw ? parseInt(raw, 10) : DEFAULT_EMBED_HEIGHT;
          return Number.isFinite(parsed) ? parsed : DEFAULT_EMBED_HEIGHT;
        },
        renderHTML: (attrs) => ({
          'data-excalidraw-height': String(attrs['height'] ?? DEFAULT_EMBED_HEIGHT),
        }),
      },
      linkedNoteId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-excalidraw-note-id') ?? null,
        renderHTML: (attrs) =>
          attrs['linkedNoteId'] ? { 'data-excalidraw-note-id': attrs['linkedNoteId'] } : {},
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'div[data-excalidraw-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as ExcalidrawNodeAttrs;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes, {
        'data-excalidraw-embed': '',
        ...(attrs.filePath ? { 'data-excalidraw-path': attrs.filePath } : {}),
        'data-excalidraw-height': String(attrs.height ?? DEFAULT_EMBED_HEIGHT),
        ...(attrs.linkedNoteId ? { 'data-excalidraw-note-id': attrs.linkedNoteId } : {}),
        class: 'ns-excalidraw-embed',
      }),
      // Static fallback for server-side rendering / copy-paste
      [
        'p',
        { class: 'ns-excalidraw-fallback' },
        attrs.filePath ? `[Excalidraw: ${attrs.filePath}]` : '[Excalidraw whiteboard]',
      ],
    ];
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // ExcalidrawEmbed is imported directly here. The heavy @excalidraw/excalidraw
    // package itself is dynamically imported INSIDE ExcalidrawEmbed via
    // `import('@excalidraw/excalidraw')`, so the initial bundle remains lean.

    const mod = require('./ExcalidrawEmbed') as {
      ExcalidrawEmbed: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(mod.ExcalidrawEmbed);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertExcalidrawEmbed:
        (options = {}) =>
        ({ commands, editor }) => {
          // Resolve the current note ID from editor storage if available.
          // The host application stores noteId in editor.storage.noteId.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const noteId: string | null = (editor.storage as any)?.noteId ?? null;

          const filePath =
            options.filePath ??
            this.options.generateFilePath?.(noteId) ??
            `drawings/${Date.now()}.excalidraw`;

          return commands.insertContent({
            type: this.name,
            attrs: {
              filePath,
              height: options.height ?? DEFAULT_EMBED_HEIGHT,
              linkedNoteId: options.linkedNoteId ?? null,
            } satisfies ExcalidrawNodeAttrs,
          });
        },

      setExcalidrawFilePath:
        (filePath) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { filePath }),

      setExcalidrawHeight:
        (height) =>
        ({ commands }) => {
          const clamped = Math.max(MIN_EMBED_HEIGHT, Math.min(MAX_EMBED_HEIGHT, height));
          return commands.updateAttributes(this.name, { height: clamped });
        },
    };
  },
});
