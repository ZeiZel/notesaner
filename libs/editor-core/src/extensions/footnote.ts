/**
 * Footnote — TipTap extension for standard Markdown footnote syntax.
 *
 * Implements two nodes that work together:
 *   - `footnoteRef`  — inline atom node rendering [^N] references
 *   - `footnoteDef`  — block node rendering [^N]: definition text at note bottom
 *
 * Features:
 * - [^N] inline reference renders as a superscript link; click scrolls to definition
 * - [^N]: definition block renders at the bottom of the document
 * - InputRule for `[^label]` syntax (fires after the closing `]`)
 * - Auto-numbering: each new footnote gets the next available integer label
 * - Back-link inside the definition scrolls back to the inline reference
 * - Bidirectional scroll: ref → def and def → ref
 * - Markdown serialization: preserves standard `[^1]` / `[^1]:` syntax
 * - Slash command integration via `insertFootnote` command
 *
 * Usage:
 * ```ts
 * import { Footnote } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   Footnote,
 * ];
 *
 * // Insert via command (auto-numbers):
 * editor.commands.insertFootnote();
 * ```
 *
 * Architecture notes:
 *   - `footnoteRef` is an inline atom node (group: 'inline', atom: true).
 *   - `footnoteDef` is a block node (group: 'block', content: 'inline*').
 *   - Both nodes share a `label` attribute that is the unique identifier.
 *   - The React NodeView (FootnoteView.tsx) provides the interactive UI.
 *   - Scroll behaviour is implemented in the NodeView, not in this file.
 */

import type React from 'react';
import { Node, Extension, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shared attributes for both footnote nodes. */
export interface FootnoteAttrs {
  /**
   * The footnote label — an integer string like "1", "2", "3".
   * This is the unique identifier that links ref ↔ def.
   * Auto-assigned when inserting via `insertFootnote`.
   */
  label: string;
}

/** Options for the combined Footnote extension bundle. */
export interface FootnoteOptions {
  /**
   * HTML attributes applied to the footnote reference element.
   * Merged via mergeAttributes.
   */
  refHTMLAttributes?: Record<string, string>;

  /**
   * HTML attributes applied to the footnote definition container.
   */
  defHTMLAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /**
       * Insert a new footnote at the current cursor position.
       * Inserts both an inline reference and a definition block at the end
       * of the document. Auto-assigns the next available integer label.
       */
      insertFootnote: () => ReturnType;

      /**
       * Remove the footnote reference and its corresponding definition block
       * for the given label. If label is omitted, operates on the node at
       * the current selection.
       */
      removeFootnote: (label?: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scan the ProseMirror document and collect all labels used by existing
 * footnoteRef nodes. Returns the set of integer labels in use.
 */
export function collectUsedLabels(doc: import('@tiptap/pm/model').Node): Set<number> {
  const used = new Set<number>();
  doc.descendants((node) => {
    if (node.type.name === 'footnoteRef') {
      const n = parseInt(node.attrs['label'] as string, 10);
      if (!isNaN(n)) used.add(n);
    }
  });
  return used;
}

/**
 * Return the smallest positive integer not in `used`.
 * Guarantees a unique auto-increment label for a new footnote.
 */
export function nextAvailableLabel(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/**
 * Build the DOM id used for footnote ref anchors.
 * e.g. label "3" → "fnref-3"
 */
export function footnoteRefId(label: string): string {
  return `fnref-${label}`;
}

/**
 * Build the DOM id used for footnote definition anchors.
 * e.g. label "3" → "fndef-3"
 */
export function footnoteDefId(label: string): string {
  return `fndef-${label}`;
}

/**
 * Serialize a footnoteRef label to standard Markdown syntax.
 * e.g. "3" → "[^3]"
 */
export function serializeFootnoteRef(label: string): string {
  return `[^${label}]`;
}

/**
 * Serialize a footnoteDef label to the Markdown definition prefix.
 * e.g. "3" → "[^3]: "
 * (The content text is appended by the serializer separately.)
 */
export function serializeFootnoteDefPrefix(label: string): string {
  return `[^${label}]: `;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Input rule regex for [^label] footnote references.
 *
 * Fires after the closing `]`. The capture group captures the label
 * (any non-whitespace, non-bracket characters) between `^` and `]`.
 *
 * Examples that match:
 *   [^1]
 *   [^note-id]
 *   [^abc]
 */
export const FOOTNOTE_REF_INPUT_REGEX = /\[\^([^\s\]]+)\]$/;

// ---------------------------------------------------------------------------
// FootnoteRef — inline atom node for [^N] references
// ---------------------------------------------------------------------------

export const FootnoteRef = Node.create<FootnoteOptions>({
  name: 'footnoteRef',

  // Inline atom: does not contain child nodes, lives inside paragraphs/headings.
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      refHTMLAttributes: {},
      defHTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      label: {
        default: '1',
        parseHTML: (el) => el.getAttribute('data-footnote-ref') ?? '1',
        renderHTML: (attrs) => ({
          'data-footnote-ref': attrs['label'] as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote-ref]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs['label'] as string;
    return [
      'sup',
      mergeAttributes(this.options.refHTMLAttributes ?? {}, HTMLAttributes, {
        'data-footnote-ref': label,
        id: footnoteRefId(label),
        class: 'ns-footnote-ref',
      }),
      [
        'a',
        {
          href: `#${footnoteDefId(label)}`,
          class: 'ns-footnote-ref__link',
          'aria-label': `Footnote ${label}`,
        },
        `[^${label}]`,
      ],
    ];
  },

  renderText({ node }) {
    return serializeFootnoteRef(node.attrs['label'] as string);
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FootnoteRefView } = require('../components/FootnoteView') as {
      FootnoteRefView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(FootnoteRefView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: FOOTNOTE_REF_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const label = match[1];
          if (!label) return;

          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ label }));
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Alt+Enter on a selected footnote ref jumps to its definition.
      'Alt-Enter': () => {
        const { selection, schema } = this.editor.state;
        const node = selection.$from.nodeAfter;
        if (!node || node.type !== schema.nodes['footnoteRef']) return false;

        const label = node.attrs['label'] as string;
        scrollToFootnoteDef(label);
        return true;
      },
    };
  },
});

// ---------------------------------------------------------------------------
// FootnoteDef — block node for [^N]: definitions
// ---------------------------------------------------------------------------

export const FootnoteDef = Node.create<FootnoteOptions>({
  name: 'footnoteDef',

  // Block node with inline content (the definition text).
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      refHTMLAttributes: {},
      defHTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      label: {
        default: '1',
        parseHTML: (el) => el.getAttribute('data-footnote-def') ?? '1',
        renderHTML: (attrs) => ({
          'data-footnote-def': attrs['label'] as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-footnote-def]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs['label'] as string;
    return [
      'div',
      mergeAttributes(this.options.defHTMLAttributes ?? {}, HTMLAttributes, {
        'data-footnote-def': label,
        id: footnoteDefId(label),
        class: 'ns-footnote-def',
        role: 'note',
        'aria-label': `Footnote ${label} definition`,
      }),
      // Back-link anchor — clicking returns focus to the inline reference.
      [
        'a',
        {
          href: `#${footnoteRefId(label)}`,
          class: 'ns-footnote-def__backlink',
          'aria-label': `Return to footnote ${label} reference`,
        },
        `[^${label}]:`,
      ],
      // Content hole — ProseMirror renders child nodes here.
      ['span', { class: 'ns-footnote-def__content' }, 0],
    ];
  },

  renderText({ node }) {
    return serializeFootnoteDefPrefix(node.attrs['label'] as string);
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FootnoteDefView } = require('../components/FootnoteView') as {
      FootnoteDefView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(FootnoteDefView);
  },
});

// ---------------------------------------------------------------------------
// Scroll helpers (browser-side only — safe to call in NodeView event handlers)
// ---------------------------------------------------------------------------

/**
 * Scroll smoothly to the footnote definition element for the given label.
 * No-ops in non-browser environments.
 */
export function scrollToFootnoteDef(label: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(footnoteDefId(label));
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.focus({ preventScroll: true });
}

/**
 * Scroll smoothly back to the footnote reference element for the given label.
 * No-ops in non-browser environments.
 */
export function scrollToFootnoteRef(label: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(footnoteRefId(label));
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Footnote — combined Extension that registers commands and wires up nodes.
//
// Note: The two Node definitions (FootnoteRef, FootnoteDef) are standalone
// exported constants. This Extension wraps them with shared command logic.
// Host code should add [FootnoteRef, FootnoteDef, Footnote] to extensions.
// ---------------------------------------------------------------------------

export const Footnote = Extension.create<FootnoteOptions>({
  name: 'footnote',

  addOptions() {
    return {
      refHTMLAttributes: {},
      defHTMLAttributes: {},
    };
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ state, dispatch, editor }) => {
          if (!dispatch) return true;

          const { doc, tr, schema } = state;

          // --- 1. Determine the next available label -----------------------
          const usedLabels = collectUsedLabels(doc);
          const label = String(nextAvailableLabel(usedLabels));

          // --- 2. Insert the inline reference at the current selection -----
          const refNode = schema.nodes['footnoteRef']?.create({ label });
          if (!refNode) return false;

          // Replace the current selection with the footnoteRef node.
          tr.replaceSelectionWith(refNode);

          // --- 3. Append the definition block at the end of the document ---
          // The definition is always at the document tail so footnotes
          // collect at the bottom, matching standard Markdown rendering.
          const defNode = schema.nodes['footnoteDef']?.create(
            { label },
            // Start with an empty text node so the user can type into it.
            schema.text(' '),
          );
          if (!defNode) return false;

          // Insert after the last child of the document.
          const insertPos = tr.doc.content.size;
          tr.insert(insertPos, defNode);

          dispatch(tr);
          editor.view.focus();
          return true;
        },

      removeFootnote:
        (label?: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const { doc, tr } = state;

          // If no label provided, attempt to read it from the current selection.
          let targetLabel = label;
          if (!targetLabel) {
            const node = state.selection.$from.nodeAfter;
            if (node?.type.name === 'footnoteRef') {
              targetLabel = node.attrs['label'] as string;
            }
          }

          if (!targetLabel) return false;

          // Collect positions of nodes to delete (process in reverse to keep
          // positions valid after each deletion).
          const toDelete: Array<{ from: number; to: number }> = [];

          doc.descendants((node, pos) => {
            if (
              (node.type.name === 'footnoteRef' || node.type.name === 'footnoteDef') &&
              node.attrs['label'] === targetLabel
            ) {
              toDelete.push({ from: pos, to: pos + node.nodeSize });
            }
          });

          // Delete in reverse document order so earlier positions stay valid.
          toDelete.sort((a, b) => b.from - a.from).forEach(({ from, to }) => tr.delete(from, to));

          dispatch(tr);
          return true;
        },
    };
  },
});
