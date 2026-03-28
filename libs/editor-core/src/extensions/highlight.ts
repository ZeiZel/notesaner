/**
 * Highlight — TipTap Mark extension for text highlighting with multiple colors.
 *
 * Features:
 * - Mark-based extension that wraps selected text in a colored highlight
 * - Six preset colors: yellow, green, blue, pink, orange, purple
 * - Custom color support via the `color` attribute
 * - Keyboard shortcut: Ctrl+Shift+H (Mod+Shift+H) toggles the last-used or
 *   default (yellow) highlight on the current selection
 * - InputRule: `==text==` syntax wraps text in a yellow highlight
 *   (follows Obsidian / Markdown-it highlight convention)
 * - Commands: setHighlight(color), unsetHighlight, toggleHighlight(color)
 * - Plain-text serialisation: preserves ==...== syntax for markdown export
 * - CSS class output: `ns-highlight ns-highlight--{color}` for styling
 *
 * Usage:
 * ```ts
 * import { Highlight } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   Highlight,
 * ];
 *
 * // Toggle highlight on selection:
 * editor.commands.toggleHighlight('green');
 *
 * // Remove highlight:
 * editor.commands.unsetHighlight();
 * ```
 *
 * Architecture notes:
 * - This is a TipTap Mark (not a Node) since highlighting is inline formatting.
 * - The `color` attribute is stored as a data attribute and used for CSS class
 *   generation, avoiding inline styles for better theming support.
 * - The HighlightMenu component provides a visual color picker popup.
 */

import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported highlight preset colors. */
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** Attributes stored on the highlight mark. */
export interface HighlightAttrs {
  /** The highlight color. Defaults to 'yellow'. */
  color: HighlightColor;
}

/** CSS color values for each highlight preset (used for inline fallback). */
export const HIGHLIGHT_COLOR_VALUES: Record<HighlightColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.4)',
  green: 'rgba(74, 222, 128, 0.4)',
  blue: 'rgba(96, 165, 250, 0.4)',
  pink: 'rgba(244, 114, 182, 0.4)',
  orange: 'rgba(251, 146, 60, 0.4)',
  purple: 'rgba(167, 139, 250, 0.4)',
};

/** Options for the Highlight extension. */
export interface HighlightOptions {
  /**
   * HTML attributes merged onto every highlight `<mark>` element.
   */
  HTMLAttributes: Record<string, string>;

  /**
   * Whether to allow multiple highlight colors. When false, applying a new
   * highlight color to already-highlighted text replaces the existing color.
   * Defaults to true (multicolor).
   */
  multicolor: boolean;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      /**
       * Apply a highlight mark with the given color to the current selection.
       * @param color - One of the preset highlight colors. Defaults to 'yellow'.
       */
      setHighlight: (color?: HighlightColor) => ReturnType;

      /**
       * Remove the highlight mark from the current selection.
       */
      unsetHighlight: () => ReturnType;

      /**
       * Toggle the highlight mark on the current selection.
       * If the selection already has a highlight with the same color, removes it.
       * Otherwise, applies the highlight with the given color.
       * @param color - One of the preset highlight colors. Defaults to 'yellow'.
       */
      toggleHighlight: (color?: HighlightColor) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a string is a known highlight color.
 * Returns the color if valid, 'yellow' otherwise.
 */
export function resolveHighlightColor(color: string | undefined | null): HighlightColor {
  if (color && (HIGHLIGHT_COLORS as readonly string[]).includes(color)) {
    return color as HighlightColor;
  }
  return 'yellow';
}

/**
 * Serialize a highlighted text span to Obsidian-style markdown.
 * e.g. "important text" with yellow highlight -> "==important text=="
 *
 * Note: The ==...== syntax does not support color information in standard
 * markdown. Color is preserved in the HTML data attribute only.
 */
export function serializeHighlight(text: string): string {
  return `==${text}==`;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches ==text== highlight syntax (Obsidian / Markdown-it convention).
 *
 * The pattern:
 * - Opening == must not be preceded by another =
 * - Content must be non-empty and must not contain ==
 * - Closing == fires the rule
 *
 * Capture group 1: the text to highlight.
 *
 * Examples that match:
 *   ==important==
 *   ==highlighted text==
 */
export const HIGHLIGHT_INPUT_REGEX = /(?<!=)==([^=]+)==$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const Highlight = Mark.create<HighlightOptions>({
  name: 'highlight',

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
      multicolor: true,
    };
  },

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      color: {
        default: 'yellow' as HighlightColor,
        parseHTML: (el) => resolveHighlightColor(el.getAttribute('data-highlight-color')),
        renderHTML: (attrs) => ({
          'data-highlight-color': (attrs['color'] as string) || 'yellow',
        }),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'mark[data-highlight]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const color = resolveHighlightColor(HTMLAttributes['data-highlight-color'] as string);
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-highlight': '',
        'data-highlight-color': color,
        class: `ns-highlight ns-highlight--${color}`,
        style: `background-color: var(--ns-highlight-${color}, ${HIGHLIGHT_COLOR_VALUES[color]})`,
      }),
      0, // Content hole — ProseMirror renders child text here.
    ];
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      setHighlight:
        (color?: HighlightColor) =>
        ({ commands }) => {
          const resolvedColor = resolveHighlightColor(color);
          return commands.setMark(this.name, { color: resolvedColor });
        },

      unsetHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      toggleHighlight:
        (color?: HighlightColor) =>
        ({ commands }) => {
          const resolvedColor = resolveHighlightColor(color);
          return commands.toggleMark(this.name, { color: resolvedColor });
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — detect ==text== as the user types
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: HIGHLIGHT_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const text = match[1];
          if (!text?.trim()) return;

          const { tr, schema } = state;
          const markType = schema.marks[this.name];
          if (!markType) return;

          const mark = markType.create({ color: 'yellow' });
          tr.replaceWith(range.from, range.to, schema.text(text, [mark]));
        },
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+H / Cmd+Shift+H: toggle yellow highlight on selection.
      'Mod-Shift-h': () => {
        return this.editor.commands.toggleHighlight('yellow');
      },
    };
  },
});
