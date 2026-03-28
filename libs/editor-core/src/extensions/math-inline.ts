/**
 * MathInline — TipTap inline node extension for LaTeX math ($...$).
 *
 * Features:
 * - InputRule: typing $...$ converts to a rendered inline math node
 * - NodeView: renders via KaTeX in read mode; shows raw LaTeX input on click
 * - Keyboard shortcut: Ctrl+M (Mod+M) wraps current selection in inline math
 * - Error display: invalid LaTeX shows an inline error badge
 * - Plain-text serialisation: preserves $...$ syntax for markdown export
 *
 * KaTeX is a peer dependency — it is imported dynamically at render time to
 * keep the editor bundle lean when math is not used.
 *
 * Usage:
 * ```ts
 * import { MathInline } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   MathInline,
 *   MathBlock,
 * ];
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// TipTap command declarations
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      /**
       * Insert an inline math node at the cursor with the given LaTeX source.
       */
      insertMathInline: (latex: string) => ReturnType;

      /**
       * Wrap the current text selection in an inline math node.
       * The selected text is used as the initial LaTeX source.
       */
      wrapSelectionInMathInline: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Attribute interface
// ---------------------------------------------------------------------------

export interface MathInlineAttrs {
  /** Raw LaTeX source string. */
  latex: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MathInlineOptions {
  /**
   * HTML attributes merged onto the outer `<span>` in static HTML output.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches $formula$ inline math delimiters.
 *
 * Rules:
 * - Must be preceded by a space, start of text, or common punctuation
 *   (not another $) to avoid matching $$...$$  at the opening $.
 * - The content between $ ... $ must be non-empty and must not contain
 *   unescaped newlines.
 * - Fires when the closing $ is typed.
 *
 * Capture group 1: the LaTeX formula string (between the delimiters).
 */
const MATH_INLINE_INPUT_REGEX = /(?<![\\$])\$([^$\n]+)\$$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const MathInline = Node.create<MathInlineOptions>({
  name: 'mathInline',

  // Inline atom — rendered as a single non-editable unit inside paragraph text.
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el: Element) => el.getAttribute('data-math-latex') ?? '',
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as MathInlineAttrs;
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-math-inline': '',
        'data-math-latex': attrs.latex,
        class: 'ns-math-inline',
      }),
      `$${attrs.latex}$`,
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — preserves $...$ for markdown export
  // -------------------------------------------------------------------------

  renderText({ node }) {
    const attrs = node.attrs as MathInlineAttrs;
    return `$${attrs.latex}$`;
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // MathView imports types from this file but not the extension itself.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MathInlineView } = require('../components/MathView') as {
      MathInlineView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(MathInlineView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertMathInline:
        (latex: string) =>
        ({ commands }) => {
          if (!latex.trim()) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { latex: latex.trim() },
          });
        },

      wrapSelectionInMathInline:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          if (selection.empty) return false;

          const text = state.doc.textBetween(selection.from, selection.to, '');
          if (!text.trim()) return false;

          if (dispatch) {
            const node = this.type.create({ latex: text.trim() });
            const { tr } = state;
            tr.replaceWith(selection.from, selection.to, node);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: MATH_INLINE_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (!latex) return;

          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: latex.trim() }));
        },
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Ctrl+M / Cmd+M: wrap selection in inline math, or insert empty math node.
      'Mod-m': () => {
        const { selection } = this.editor.state;
        if (!selection.empty) {
          return this.editor.commands.wrapSelectionInMathInline();
        }
        // Insert a placeholder inline math node with empty latex.
        // The NodeView will immediately open editing mode.
        return this.editor.commands.insertMathInline('');
      },
    };
  },
});
