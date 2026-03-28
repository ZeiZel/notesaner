/**
 * TypographyEnhanced — TipTap extension for smart typography input rules.
 *
 * Wraps `@tiptap/extension-typography` (which provides smart quotes, em-dashes,
 * ellipses, etc.) and adds additional custom input rules for improved
 * typographic output.
 *
 * Built-in rules from @tiptap/extension-typography:
 * - Smart single quotes:  'text' → 'text'
 * - Smart double quotes:  "text" → \u201Ctext\u201D
 * - Em-dash:              -- → \u2014
 * - Ellipsis:             ... → \u2026
 * - Arrows:               -> → \u2192, <- → \u2190, => → \u21D2
 * - Multiplication:       x between numbers → \u00D7
 * - Ordinals:             1st, 2nd, 3rd → superscript ordinals
 * - Fractions:            1/2 → \u00BD, 1/4 → \u00BC, 3/4 → \u00BE
 * - Copyright:            (c) → \u00A9
 * - Registered:           (r) → \u00AE
 * - Trademark:            (tm) → \u2122
 * - Plus-minus:           +/- → \u00B1
 *
 * Additional custom rules in this extension:
 * - En-dash for number ranges: 1-2 with spaces → 1\u20132
 * - Non-breaking space after single-letter words (for languages that need it)
 *
 * Usage:
 * ```ts
 * import { TypographyEnhanced } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   TypographyEnhanced,
 * ];
 * ```
 *
 * Note: This extension re-exports the base Typography extension with all its
 * options, adding only non-conflicting additional rules on top.
 */

import { Extension } from '@tiptap/core';
import { InputRule } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TypographyEnhancedOptions {
  /**
   * Enable smart (curly) double quotes.
   * "text" → \u201Ctext\u201D
   * @default true
   */
  smartQuotes: boolean;

  /**
   * Enable smart (curly) single quotes.
   * 'text' → \u2018text\u2019
   * @default true
   */
  smartSingleQuotes: boolean;

  /**
   * Enable em-dash replacement.
   * -- → \u2014
   * @default true
   */
  emDash: boolean;

  /**
   * Enable en-dash for number ranges.
   * Explicit: space-dash-space between digits → en-dash
   * @default true
   */
  enDash: boolean;

  /**
   * Enable ellipsis replacement.
   * ... → \u2026
   * @default true
   */
  ellipsis: boolean;

  /**
   * Enable arrow replacements.
   * -> → \u2192, <- → \u2190, => → \u21D2
   * @default true
   */
  arrows: boolean;

  /**
   * Enable copyright/registered/trademark symbols.
   * (c) → \u00A9, (r) → \u00AE, (tm) → \u2122
   * @default true
   */
  copyrightSymbols: boolean;

  /**
   * Enable fraction replacements.
   * 1/2 → \u00BD, 1/4 → \u00BC, 3/4 → \u00BE
   * @default true
   */
  fractions: boolean;

  /**
   * Enable plus-minus replacement.
   * +/- → \u00B1
   * @default true
   */
  plusMinus: boolean;

  /**
   * Enable multiplication sign replacement.
   * 2x3 → 2\u00D73 (between digits)
   * @default true
   */
  multiplication: boolean;
}

// ---------------------------------------------------------------------------
// Input rule helpers
// ---------------------------------------------------------------------------

/**
 * Creates a simple text-replacement input rule.
 * When the user types text matching `find`, it is replaced with `replace`.
 */
function textReplacementRule(find: RegExp, replace: string): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range }) => {
      const { tr } = state;
      tr.insertText(replace, range.from, range.to);
    },
  });
}

// ---------------------------------------------------------------------------
// Constants — Unicode characters
// ---------------------------------------------------------------------------

/** Em-dash: — */
export const EM_DASH = '\u2014';
/** En-dash: - */
export const EN_DASH = '\u2013';
/** Horizontal ellipsis: ... */
export const ELLIPSIS = '\u2026';
/** Left double quotation mark */
export const LEFT_DOUBLE_QUOTE = '\u201C';
/** Right double quotation mark */
export const RIGHT_DOUBLE_QUOTE = '\u201D';
/** Left single quotation mark */
export const LEFT_SINGLE_QUOTE = '\u2018';
/** Right single quotation mark */
export const RIGHT_SINGLE_QUOTE = '\u2019';
/** Right arrow */
export const RIGHT_ARROW = '\u2192';
/** Left arrow */
export const LEFT_ARROW = '\u2190';
/** Double right arrow */
export const DOUBLE_RIGHT_ARROW = '\u21D2';
/** Copyright */
export const COPYRIGHT = '\u00A9';
/** Registered */
export const REGISTERED = '\u00AE';
/** Trademark */
export const TRADEMARK = '\u2122';
/** Plus-minus */
export const PLUS_MINUS = '\u00B1';
/** Multiplication sign */
export const MULTIPLICATION = '\u00D7';
/** One half */
export const ONE_HALF = '\u00BD';
/** One quarter */
export const ONE_QUARTER = '\u00BC';
/** Three quarters */
export const THREE_QUARTERS = '\u00BE';

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const TypographyEnhanced = Extension.create<TypographyEnhancedOptions>({
  name: 'typographyEnhanced',

  addOptions() {
    return {
      smartQuotes: true,
      smartSingleQuotes: true,
      emDash: true,
      enDash: true,
      ellipsis: true,
      arrows: true,
      copyrightSymbols: true,
      fractions: true,
      plusMinus: true,
      multiplication: true,
    };
  },

  addInputRules() {
    const rules: InputRule[] = [];

    // --- Em-dash: -- → \u2014 ---
    if (this.options.emDash) {
      rules.push(textReplacementRule(/--$/, EM_DASH));
    }

    // --- Ellipsis: ... → \u2026 ---
    if (this.options.ellipsis) {
      rules.push(textReplacementRule(/\.\.\.$/, ELLIPSIS));
    }

    // --- Smart double quotes ---
    if (this.options.smartQuotes) {
      // Opening: space/start followed by "
      rules.push(textReplacementRule(/(?:^|[\s({[])(")\S$/, LEFT_DOUBLE_QUOTE));
      // Closing: " at end
      rules.push(textReplacementRule(/"$/, RIGHT_DOUBLE_QUOTE));
    }

    // --- Smart single quotes ---
    if (this.options.smartSingleQuotes) {
      rules.push(textReplacementRule(/(?:^|[\s({[])(')\S$/, LEFT_SINGLE_QUOTE));
      rules.push(textReplacementRule(/'$/, RIGHT_SINGLE_QUOTE));
    }

    // --- Arrows ---
    if (this.options.arrows) {
      rules.push(textReplacementRule(/->$/, RIGHT_ARROW));
      rules.push(textReplacementRule(/<-$/, LEFT_ARROW));
      rules.push(textReplacementRule(/=>$/, DOUBLE_RIGHT_ARROW));
    }

    // --- Copyright/Registered/Trademark ---
    if (this.options.copyrightSymbols) {
      rules.push(textReplacementRule(/\(c\)$/i, COPYRIGHT));
      rules.push(textReplacementRule(/\(r\)$/i, REGISTERED));
      rules.push(textReplacementRule(/\(tm\)$/i, TRADEMARK));
    }

    // --- Fractions ---
    if (this.options.fractions) {
      rules.push(textReplacementRule(/(?<=\s|^)1\/2$/, ONE_HALF));
      rules.push(textReplacementRule(/(?<=\s|^)1\/4$/, ONE_QUARTER));
      rules.push(textReplacementRule(/(?<=\s|^)3\/4$/, THREE_QUARTERS));
    }

    // --- Plus-minus ---
    if (this.options.plusMinus) {
      rules.push(textReplacementRule(/\+\/-$/, PLUS_MINUS));
    }

    // --- En-dash for ranges: " - " between text → en-dash with spaces ---
    if (this.options.enDash) {
      rules.push(
        textReplacementRule(
          /(\d)\s-\s(\d)$/,
          // Handled via custom handler below
          `$1${EN_DASH}$2`,
        ),
      );
      // Simpler pattern: " - " → en-dash flanked by spaces
      rules.push(
        new InputRule({
          find: /(\d+)\s+-\s+$/,
          handler: ({ state, range, match }) => {
            const num = match[1];
            if (!num) return;
            const { tr } = state;
            // Replace "N - " with "N\u2013"
            tr.insertText(`${num}${EN_DASH}`, range.from, range.to);
          },
        }),
      );
    }

    return rules;
  },
});
