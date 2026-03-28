/**
 * CalloutBlock — TipTap Node extension for Obsidian/GitHub-style callout blocks.
 *
 * Supports callout types: info, warning, tip, danger, note (plus aliases).
 *
 * Markdown syntax (Obsidian-compatible):
 *   > [!info] Optional title
 *   > Content here
 *
 * Features:
 * - InputRule: typing `> [!type]` on its own paragraph creates a callout
 * - NodeView: renders via CalloutBlockView with themed icons and colours
 * - Collapsible: click on the header to toggle content visibility
 * - Editable title and content
 * - Plain-text serialisation: preserves `> [!type]` syntax for markdown export
 * - Slash command integration via `insertCallout` command
 *
 * Callout types:
 * - info    (aliases: information)  — blue
 * - warning (aliases: caution, attention) — amber/orange
 * - tip     (aliases: hint, important) — green
 * - danger  (aliases: error, bug) — red
 * - note    (aliases: abstract, summary, tldr) — purple
 *
 * Usage:
 * ```ts
 * import { CalloutBlock } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   CalloutBlock,
 * ];
 *
 * // Insert via command:
 * editor.commands.insertCallout({ type: 'info', title: 'Note' });
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Callout types
// ---------------------------------------------------------------------------

/** Canonical callout types supported by the extension. */
export const CALLOUT_TYPES = ['info', 'warning', 'tip', 'danger', 'note'] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** Maps alias keywords to their canonical callout type. */
export const CALLOUT_ALIASES: Record<string, CalloutType> = {
  info: 'info',
  information: 'info',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
  note: 'note',
  abstract: 'note',
  summary: 'note',
  tldr: 'note',
};

/**
 * Resolve a callout keyword (possibly an alias) to a canonical CalloutType.
 * Returns 'note' as default when the keyword is unrecognised.
 */
export function resolveCalloutType(keyword: string): CalloutType {
  const normalised = keyword.trim().toLowerCase();
  return CALLOUT_ALIASES[normalised] ?? 'note';
}

/**
 * Default titles for each callout type (used when no custom title is given).
 */
export const CALLOUT_DEFAULT_TITLES: Record<CalloutType, string> = {
  info: 'Info',
  warning: 'Warning',
  tip: 'Tip',
  danger: 'Danger',
  note: 'Note',
};

// ---------------------------------------------------------------------------
// Attribute interface
// ---------------------------------------------------------------------------

export interface CalloutBlockAttrs {
  /** Canonical callout type. */
  calloutType: CalloutType;
  /** User-visible title. */
  title: string;
  /** Whether the callout body is collapsed. */
  collapsed: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CalloutBlockOptions {
  /**
   * HTML attributes merged onto the outer container in static HTML output.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// TipTap commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    calloutBlock: {
      /**
       * Insert a callout block at the current cursor position.
       * @param options.type — Callout type (info, warning, tip, danger, note). Defaults to 'info'.
       * @param options.title — Custom title. Defaults to the type's default title.
       */
      insertCallout: (options?: { type?: CalloutType; title?: string }) => ReturnType;

      /**
       * Toggle the collapse state of a callout block at the current selection.
       */
      toggleCalloutCollapse: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches Obsidian callout syntax at the start of a line:
 *   > [!type] Optional title
 *
 * Capture groups:
 *   1: callout type keyword (e.g. "info", "warning")
 *   2: optional title (everything after the type until end of line)
 */
export const CALLOUT_INPUT_REGEX = /^>\s*\[!(\w+)\]\s*(.*)?$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const CalloutBlock = Node.create<CalloutBlockOptions>({
  name: 'calloutBlock',

  // Block node with rich text content
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  selectable: true,
  isolating: true,

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
      calloutType: {
        default: 'info' as CalloutType,
        parseHTML: (el) => resolveCalloutType(el.getAttribute('data-callout-type') ?? 'info'),
        renderHTML: (attrs) => ({
          'data-callout-type': attrs['calloutType'] as string,
        }),
      },
      title: {
        default: 'Info',
        parseHTML: (el) => el.getAttribute('data-callout-title') ?? 'Info',
        renderHTML: (attrs) => ({
          'data-callout-title': attrs['title'] as string,
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-callout-collapsed') === 'true',
        renderHTML: (attrs) => ({
          'data-callout-collapsed': String(attrs['collapsed']),
        }),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'div[data-callout-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as CalloutBlockAttrs;
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout-block': '',
        'data-callout-type': attrs.calloutType,
        'data-callout-title': attrs.title,
        'data-callout-collapsed': String(attrs.collapsed),
        class: `ns-callout ns-callout--${attrs.calloutType}`,
      }),
      // Title section (static HTML fallback)
      ['div', { class: 'ns-callout__header' }, attrs.title],
      // Content hole — ProseMirror renders child nodes here.
      ['div', { class: 'ns-callout__body' }, 0],
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — preserves > [!type] syntax for markdown
  // -------------------------------------------------------------------------

  renderText({ node }) {
    const attrs = node.attrs as CalloutBlockAttrs;
    return `> [!${attrs.calloutType}] ${attrs.title}\n`;
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CalloutBlockView } = require('../components/CalloutBlockView') as {
      CalloutBlockView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(CalloutBlockView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertCallout:
        (options = {}) =>
        ({ commands }) => {
          const calloutType = options.type ?? 'info';
          const title = options.title ?? CALLOUT_DEFAULT_TITLES[calloutType];

          return commands.insertContent({
            type: this.name,
            attrs: {
              calloutType,
              title,
              collapsed: false,
            },
            content: [
              {
                type: 'paragraph',
              },
            ],
          });
        },

      toggleCalloutCollapse:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const { selection } = state;
          const $pos = selection.$from;

          // Walk up to find the calloutBlock node.
          for (let depth = $pos.depth; depth >= 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name === 'calloutBlock') {
              const pos = $pos.before(depth);
              const { tr } = state;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                collapsed: !node.attrs['collapsed'],
              });
              dispatch(tr);
              return true;
            }
          }

          return false;
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: CALLOUT_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const typeKeyword = match[1];
          if (!typeKeyword) return;

          const calloutType = resolveCalloutType(typeKeyword);
          const title = match[2]?.trim() || CALLOUT_DEFAULT_TITLES[calloutType];

          const node = this.type.create(
            {
              calloutType,
              title,
              collapsed: false,
            },
            [state.schema.nodes['paragraph']?.create() ?? state.schema.text(' ')],
          );

          const { tr } = state;
          tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Toggle callout collapse with Mod+Shift+C when inside a callout
      'Mod-Shift-c': () => {
        return this.editor.commands.toggleCalloutCollapse();
      },
    };
  },
});
