/**
 * Subscript — TipTap Mark extension for subscript text formatting.
 *
 * Features:
 * - Mark-based extension that wraps selected text in a <sub> element
 * - Keyboard shortcut: Ctrl+Shift+, (Mod+Shift+Comma)
 * - InputRule: `~text~` syntax wraps text in subscript
 *   (follows Markdown extra / Pandoc subscript convention)
 * - Commands: setSubscript, unsetSubscript, toggleSubscript
 * - Plain-text serialisation: preserves ~...~ syntax for markdown export
 * - CSS class output: `ns-subscript` for styling
 *
 * Usage:
 * ```ts
 * import { Subscript } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   Subscript,
 * ];
 *
 * // Toggle subscript on selection:
 * editor.commands.toggleSubscript();
 * ```
 *
 * Architecture notes:
 * - This is a TipTap Mark (not a Node) since subscript is inline formatting.
 * - The extension is intentionally simple: no attributes, no color variants.
 * - Mutually exclusive with Superscript — applying one removes the other.
 *   This is enforced via the `excludes` configuration.
 *
 * Note on ~text~ syntax:
 * - The single-tilde syntax is used here for subscript (Pandoc convention).
 * - This does NOT conflict with strikethrough (~~text~~) because strikethrough
 *   requires double tildes. Single ~text~ is unambiguously subscript.
 */

import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the Subscript extension. */
export interface SubscriptOptions {
  /**
   * HTML attributes merged onto every subscript `<sub>` element.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subscript: {
      /**
       * Apply the subscript mark to the current selection.
       */
      setSubscript: () => ReturnType;

      /**
       * Remove the subscript mark from the current selection.
       */
      unsetSubscript: () => ReturnType;

      /**
       * Toggle the subscript mark on the current selection.
       * If the selection already has subscript, removes it.
       */
      toggleSubscript: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a subscript text span to Pandoc/Markdown-extra syntax.
 * e.g. "2" -> "~2~"
 */
export function serializeSubscript(text: string): string {
  return `~${text}~`;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches ~text~ subscript syntax (Pandoc / Markdown Extra convention).
 *
 * The pattern:
 * - Opening ~ must not be preceded by another ~ (prevents matching ~~text~~
 *   which is strikethrough syntax in CommonMark/GFM)
 * - Content must be non-empty and must not contain spaces
 *   (following Pandoc's subscript spec for unambiguous parsing)
 * - Content must not contain another ~
 * - Closing ~ fires the rule
 *
 * Capture group 1: the text to make subscript.
 *
 * Examples that match:
 *   ~2~
 *   ~n~
 *   ~abc~
 *
 * Examples that do NOT match:
 *   ~~  (empty content — double-tilde is strikethrough)
 *   ~~text~~  (double-tilde — strikethrough, not subscript)
 *   ~two words~  (contains space)
 */
export const SUBSCRIPT_INPUT_REGEX = /(?<!~)~([^\s~]+)~$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const Subscript = Mark.create<SubscriptOptions>({
  name: 'subscript',

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Exclusion — subscript and superscript are mutually exclusive
  // -------------------------------------------------------------------------

  excludes: 'superscript',

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'sub' }, { tag: '[data-subscript]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sub',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-subscript': '',
        class: 'ns-subscript',
      }),
      0, // Content hole — ProseMirror renders child text here.
    ];
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      setSubscript:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },

      unsetSubscript:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      toggleSubscript:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — detect ~text~ as the user types
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: SUBSCRIPT_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const text = match[1];
          if (!text?.trim()) return;

          const { tr, schema } = state;
          const markType = schema.marks[this.name];
          if (!markType) return;

          const mark = markType.create();
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
      // Ctrl+Shift+, / Cmd+Shift+,: toggle subscript on selection.
      'Mod-Shift-,': () => {
        return this.editor.commands.toggleSubscript();
      },
    };
  },
});
