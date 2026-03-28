/**
 * ToggleList — TipTap Node extension for collapsible details/summary blocks.
 *
 * Implements a toggle/disclosure widget using HTML5 <details>/<summary>
 * semantics. Users can create collapsible sections in their notes similar
 * to Notion toggles or HTML details elements.
 *
 * Features:
 * - Block-level node with editable summary (title) and body content
 * - Collapsible: clicking the toggle arrow or summary expands/collapses
 * - Nesting: toggle lists can be nested inside other toggle lists
 * - Keyboard shortcuts:
 *   - Mod+Shift+9: Insert a new toggle list at the cursor
 *   - Tab: Indent (nest) the current toggle list inside the previous sibling
 *   - Shift+Tab: Outdent (un-nest) the current toggle list
 * - InputRule: typing "> " at the start of a line creates a toggle list
 *   (note: distinct from blockquote ">" without trailing space)
 * - Commands: insertToggleList, toggleToggleListOpen
 * - Markdown serialization: preserves as HTML <details>/<summary> tags
 *   (no standard Markdown syntax exists for this)
 * - React NodeView for interactive toggle behavior
 *
 * Usage:
 * ```ts
 * import { ToggleList } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   ToggleList,
 * ];
 *
 * // Insert via command:
 * editor.commands.insertToggleList();
 * ```
 *
 * Architecture notes:
 * - `toggleList` is a block node with `content: 'toggleListSummary toggleListBody'`
 * - `toggleListSummary` is an inline-content block for the visible title
 * - `toggleListBody` is a block-content container for the collapsible content
 * - The `open` attribute tracks the expanded/collapsed state
 * - Nesting is achieved by placing a `toggleList` inside a `toggleListBody`
 * - The React NodeView (ToggleListView.tsx) handles toggle interaction
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Attributes stored on the toggleList node. */
export interface ToggleListAttrs {
  /** Whether the toggle is expanded (open) or collapsed. */
  open: boolean;
}

/** Options for the ToggleList extension. */
export interface ToggleListOptions {
  /**
   * HTML attributes merged onto the outer <details> element.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      /**
       * Insert a new toggle list at the current cursor position.
       * @param open - Whether the toggle starts expanded. Defaults to true.
       */
      insertToggleList: (open?: boolean) => ReturnType;

      /**
       * Toggle the open/closed state of the toggle list at the current cursor.
       */
      toggleToggleListOpen: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a toggle list to HTML (for markdown export).
 * Since there is no standard Markdown syntax for details/summary,
 * we use HTML tags which are valid in CommonMark and GFM.
 */
export function serializeToggleList(summary: string, body: string, open: boolean): string {
  const openAttr = open ? ' open' : '';
  return `<details${openAttr}>\n<summary>${summary}</summary>\n\n${body}\n</details>`;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches a toggle list trigger at the start of a line.
 *
 * Pattern: `>>> ` (three greater-than signs followed by a space) at line start.
 * This is deliberately different from blockquote (>) and is an uncommon
 * enough sequence to avoid accidental triggers.
 *
 * Examples that match:
 *   >>> (at start of block)
 */
export const TOGGLE_LIST_INPUT_REGEX = /^>>>\s$/;

// ---------------------------------------------------------------------------
// ToggleListSummary — the visible title/header of the toggle
// ---------------------------------------------------------------------------

export const ToggleListSummary = Node.create({
  name: 'toggleListSummary',

  // Block node with inline content — the user types the toggle title here.
  group: 'block',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'summary',
      mergeAttributes(HTMLAttributes, {
        class: 'ns-toggle-list__summary',
      }),
      0, // Content hole
    ];
  },
});

// ---------------------------------------------------------------------------
// ToggleListBody — the collapsible content container
// ---------------------------------------------------------------------------

export const ToggleListBody = Node.create({
  name: 'toggleListBody',

  // Block node with block content — can contain paragraphs, lists, nested toggles.
  group: 'block',
  content: 'block+',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-toggle-body]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-body': '',
        class: 'ns-toggle-list__body',
      }),
      0, // Content hole
    ];
  },
});

// ---------------------------------------------------------------------------
// ToggleList — the main extension wrapping details/summary
// ---------------------------------------------------------------------------

export const ToggleList = Node.create<ToggleListOptions>({
  name: 'toggleBlock',

  // Block-level node. Content structure is fixed: exactly one summary + one body.
  group: 'block',
  content: 'toggleListSummary toggleListBody',
  defining: true,
  selectable: true,
  draggable: true,

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
      open: {
        default: true,
        parseHTML: (el) => el.hasAttribute('open'),
        renderHTML: (attrs) => {
          if (attrs['open']) {
            return { open: '' };
          }
          return {};
        },
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'ns-toggle-list',
      }),
      0, // Content hole (summary + body)
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation
  // -------------------------------------------------------------------------

  renderText({ node }) {
    // Collect text from summary and body children.
    let summaryText = '';
    let bodyText = '';

    node.content.forEach((child, _offset, index) => {
      if (index === 0) {
        // First child is always the summary.
        summaryText = child.textContent;
      } else {
        // Second child is the body.
        bodyText = child.textContent;
      }
    });

    return serializeToggleList(summaryText, bodyText, node.attrs['open'] as boolean);
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ToggleListNodeView } = require('../components/ToggleListView') as {
      ToggleListNodeView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(ToggleListNodeView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertToggleList:
        (open = true) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open },
            content: [
              {
                type: 'toggleListSummary',
                content: [{ type: 'text', text: 'Toggle title' }],
              },
              {
                type: 'toggleListBody',
                content: [{ type: 'paragraph' }],
              },
            ],
          });
        },

      toggleToggleListOpen:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const pos = selection.$from;

          // Walk up from cursor to find the nearest toggleList node.
          for (let depth = pos.depth; depth > 0; depth--) {
            const node = pos.node(depth);
            if (node.type.name === 'toggleBlock') {
              if (dispatch) {
                const nodePos = pos.before(depth);
                const { tr } = state;
                tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  open: !node.attrs['open'],
                });
                dispatch(tr);
              }
              return true;
            }
          }

          return false;
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — detect >>> at start of a line
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: TOGGLE_LIST_INPUT_REGEX,
        handler: ({ state, range }) => {
          const { tr, schema } = state;

          const summaryNode = schema.nodes['toggleListSummary']?.create();
          const bodyParagraph = schema.nodes['paragraph']?.create();
          const bodyNode = schema.nodes['toggleListBody']?.create(
            null,
            bodyParagraph ? [bodyParagraph] : undefined,
          );

          if (!summaryNode || !bodyNode) return;

          const toggleNode = this.type.create({ open: true }, [summaryNode, bodyNode]);

          tr.replaceWith(range.from, range.to, toggleNode);
        },
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Mod+Shift+9: Insert a new toggle list.
      'Mod-Shift-9': () => {
        return this.editor.commands.insertToggleList();
      },
    };
  },
});
