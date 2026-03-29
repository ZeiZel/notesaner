/**
 * HorizontalRule — TipTap Node extension for horizontal rule (divider) elements.
 *
 * Replaces the default TipTap HorizontalRule with configurable appearance
 * variants: thin, thick, and dashed.
 *
 * Markdown syntax:
 *   ---  (three or more hyphens at the start of a line)
 *   ***  (three or more asterisks)
 *   ___  (three or more underscores)
 *
 * Features:
 * - InputRule: typing `---` at the start of a line inserts an hr node
 * - Configurable appearance: thin | thick | dashed
 * - NodeView: renders via HorizontalRuleView with CSS custom properties
 * - Commands: insertHorizontalRule
 * - Keyboard shortcut: Mod+Shift+- to insert hr
 * - Plain-text serialisation: outputs `---\n`
 * - Markdown import: parseHTML matches <hr> elements and `data-hr-style` attr
 *
 * CSS classes applied to the rendered element:
 *   .ns-hr                 — base class on all horizontal rules
 *   .ns-hr--thin           — 1px solid line (default)
 *   .ns-hr--thick          — 3px solid line
 *   .ns-hr--dashed         — 2px dashed line
 *
 * Usage:
 * ```ts
 * import { HorizontalRule } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   HorizontalRule.configure({ defaultStyle: 'thin' }),
 * ];
 *
 * // Insert via command:
 * editor.commands.insertHorizontalRule({ style: 'dashed' });
 *
 * // With keyboard shortcut Mod+Shift+-:
 * // Automatically detected and handled by the extension.
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Style variants
// ---------------------------------------------------------------------------

/** Visual style variants for horizontal rules. */
export const HR_STYLES = ['thin', 'thick', 'dashed'] as const;

export type HrStyle = (typeof HR_STYLES)[number];

// ---------------------------------------------------------------------------
// Attribute interface
// ---------------------------------------------------------------------------

export interface HorizontalRuleAttrs {
  /** Visual style of the horizontal rule. */
  style: HrStyle;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HorizontalRuleOptions {
  /**
   * Default style used when inserting a horizontal rule without specifying one.
   * Defaults to 'thin'.
   */
  defaultStyle: HrStyle;

  /**
   * HTML attributes merged onto the rendered <hr> element.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// TipTap commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    horizontalRule: {
      /**
       * Insert a horizontal rule at the current cursor position.
       * @param options.style — Visual style (thin | thick | dashed). Uses defaultStyle when omitted.
       */
      insertHorizontalRule: (options?: { style?: HrStyle }) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Input rule regexes
// ---------------------------------------------------------------------------

/**
 * Matches three or more hyphens at the start of a line, optionally surrounded
 * by spaces. The standard Markdown horizontal rule syntax.
 *
 * Matches: ---  ----  --- (with spaces between)
 * Does not match: --- text (would be a setext heading underline)
 */
export const HR_INPUT_REGEX = /^(?:---+|___+|\*\*\*+)\s*$/;

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Produce the Markdown plain-text representation of a horizontal rule.
 * Always uses `---` for maximum compatibility.
 */
export function serializeHorizontalRule(): string {
  return '---\n';
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

/**
 * Validate and normalise an hr style string. Returns 'thin' as the fallback
 * for any unrecognised value.
 */
export function resolveHrStyle(value: unknown): HrStyle {
  if (typeof value === 'string' && (HR_STYLES as readonly string[]).includes(value)) {
    return value as HrStyle;
  }
  return 'thin';
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const HorizontalRule = Node.create<HorizontalRuleOptions>({
  name: 'horizontalRule',

  // Atomic block node — no editable content inside.
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      defaultStyle: 'thin',
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      style: {
        default: 'thin' as HrStyle,
        parseHTML: (el) => resolveHrStyle(el.getAttribute('data-hr-style')),
        renderHTML: (attrs) => ({
          'data-hr-style': attrs['style'] as string,
        }),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [
      {
        tag: 'hr',
        getAttrs: (el) => ({
          style: resolveHrStyle((el as HTMLElement).getAttribute('data-hr-style')),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const hrStyle = node.attrs['style'] as HrStyle;
    return [
      'hr',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-hr-style': hrStyle,
        class: `ns-hr ns-hr--${hrStyle}`,
        'aria-orientation': 'horizontal',
        role: 'separator',
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — Markdown `---`
  // -------------------------------------------------------------------------

  renderText() {
    return serializeHorizontalRule();
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HorizontalRuleView } = require('../components/HorizontalRuleView') as {
      HorizontalRuleView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(HorizontalRuleView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertHorizontalRule:
        (options = {}) =>
        ({ commands }) => {
          const hrStyle = options.style ?? this.options.defaultStyle;
          return commands.insertContent({
            type: this.name,
            attrs: { style: hrStyle },
          });
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — --- / *** / ___ → insert horizontal rule
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: HR_INPUT_REGEX,
        handler: ({ state, range }) => {
          const node = this.type.create({ style: this.options.defaultStyle });
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
      // Mod+Shift+-: Insert a horizontal rule at the cursor position.
      'Mod-Shift--': () => {
        return this.editor.commands.insertHorizontalRule();
      },
    };
  },
});
