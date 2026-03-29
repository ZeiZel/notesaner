/**
 * Superscript — TipTap Mark extension for superscript text formatting.
 *
 * Features:
 * - Mark-based extension that wraps selected text in a <sup> element
 * - Keyboard shortcut: Ctrl+Shift+. (Mod+Shift+Period)
 * - InputRule: `^text^` syntax wraps text in superscript
 *   (follows Markdown extra / Pandoc superscript convention)
 * - Commands: setSuperscript, unsetSuperscript, toggleSuperscript
 * - Plain-text serialisation: preserves ^...^ syntax for markdown export
 * - CSS class output: `ns-superscript` for styling
 *
 * Usage:
 * ```ts
 * import { Superscript } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   Superscript,
 * ];
 *
 * // Toggle superscript on selection:
 * editor.commands.toggleSuperscript();
 * ```
 *
 * Architecture notes:
 * - This is a TipTap Mark (not a Node) since superscript is inline formatting.
 * - The extension is intentionally simple: no attributes, no color variants.
 * - Mutually exclusive with Subscript — applying one should remove the other.
 *   This is enforced via the `excludes` configuration.
 */

import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the Superscript extension. */
export interface SuperscriptOptions {
  /**
   * HTML attributes merged onto every superscript `<sup>` element.
   */
  HTMLAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    superscript: {
      /**
       * Apply the superscript mark to the current selection.
       */
      setSuperscript: () => ReturnType;

      /**
       * Remove the superscript mark from the current selection.
       */
      unsetSuperscript: () => ReturnType;

      /**
       * Toggle the superscript mark on the current selection.
       * If the selection already has superscript, removes it.
       */
      toggleSuperscript: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a superscript text span to Markdown-extra/Pandoc syntax.
 * e.g. "2" -> "^2^"
 */
export function serializeSuperscript(text: string): string {
  return `^${text}^`;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches ^text^ superscript syntax (Pandoc / Markdown Extra convention).
 *
 * The pattern:
 * - Opening ^ must not be preceded by another ^ (prevents matching ^^)
 * - Content must be non-empty, single-line, and must not contain spaces
 *   (Pandoc spec: superscript content may not contain spaces; use ~\ ~ for
 *   escaped space if needed — we follow the simpler no-space rule here)
 * - Closing ^ fires the rule
 *
 * Capture group 1: the text to make superscript.
 *
 * Examples that match:
 *   ^2^
 *   ^th^
 *   ^abc^
 *
 * Examples that do NOT match:
 *   ^^  (empty)
 *   ^two words^  (contains space — Pandoc restriction for unambiguous parsing)
 */
export const SUPERSCRIPT_INPUT_REGEX = /(?<!\^)\^([^\s^]+)\^$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const Superscript = Mark.create<SuperscriptOptions>({
  name: 'superscript',

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Exclusion — superscript and subscript are mutually exclusive
  // -------------------------------------------------------------------------

  excludes: 'subscript',

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'sup' }, { tag: '[data-superscript]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-superscript': '',
        class: 'ns-superscript',
      }),
      0, // Content hole — ProseMirror renders child text here.
    ];
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      setSuperscript:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },

      unsetSuperscript:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      toggleSuperscript:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — detect ^text^ as the user types
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: SUPERSCRIPT_INPUT_REGEX,
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
      // Ctrl+Shift+. / Cmd+Shift+.: toggle superscript on selection.
      'Mod-Shift-.': () => {
        return this.editor.commands.toggleSuperscript();
      },
    };
  },
});
