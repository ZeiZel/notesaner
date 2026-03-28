/**
 * MathBlock — TipTap block node extension for display-mode LaTeX math ($$...$$).
 *
 * Features:
 * - InputRule: typing $$...$$  on its own paragraph converts to a block math node
 * - NodeView: renders via KaTeX as a centered display block in read mode
 * - Editable raw LaTeX textarea appears on click
 * - Error boundary: invalid LaTeX shows a styled error message
 * - Slash command integration: the slash-command list already has a "math"
 *   item whose onSelect is updated by consumers to call insertMathBlock
 * - Plain-text serialisation: preserves $$...$$ syntax for markdown export
 *
 * KaTeX is a peer dependency — it is imported dynamically at render time.
 *
 * Usage:
 * ```ts
 * import { MathBlock } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   MathInline,
 *   MathBlock,
 * ];
 *
 * // Insert via command:
 * editor.commands.insertMathBlock('E = mc^2');
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
    mathBlock: {
      /**
       * Insert a display-mode math block node at the cursor.
       * @param latex - LaTeX source string. Defaults to empty string.
       */
      insertMathBlock: (latex?: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Attribute interface
// ---------------------------------------------------------------------------

export interface MathBlockAttrs {
  /** Raw LaTeX source string. */
  latex: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MathBlockOptions {
  /**
   * HTML attributes merged onto the outer container in static HTML output.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches $$formula$$ display-math delimiters when typed on a single line.
 *
 * The pattern allows an optional leading newline so the rule fires after the
 * user types the closing $$ and presses Enter (typical Markdown workflow).
 *
 * Capture group 1: the LaTeX formula between the delimiters.
 * The content must be non-empty.
 *
 * Examples that trigger:
 *   $$E = mc^2$$
 *   $$\frac{a}{b}$$
 */
const MATH_BLOCK_INPUT_REGEX = /(?<!\$)\$\$([^$]+)\$\$$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',

  // Block-level atom — occupies a full document block.
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: false,

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
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as MathBlockAttrs;
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-math-block': '',
        'data-math-latex': attrs.latex,
        class: 'ns-math-block',
      }),
      `$$${attrs.latex}$$`,
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — preserves $$...$$ for markdown export
  // -------------------------------------------------------------------------

  renderText({ node }) {
    const attrs = node.attrs as MathBlockAttrs;
    return `$$\n${attrs.latex}\n$$`;
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MathBlockView } = require('../components/MathView') as {
      MathBlockView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(MathBlockView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertMathBlock:
        (latex = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: MATH_BLOCK_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (latex === undefined) return;

          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: latex.trim() }));
        },
      }),
    ];
  },
});
