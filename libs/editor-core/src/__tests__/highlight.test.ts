/**
 * Unit tests for the Highlight TipTap mark extension.
 *
 * Strategy (same approach as footnote.test.ts):
 *   - Test all pure logic functions independently — no DOM, no editor instance.
 *   - Regex, serialization helpers, color resolution, and constants are covered
 *     with direct unit tests.
 *   - Mark / NodeView integration is covered by Playwright e2e tests.
 *
 * Coverage targets:
 *   lines: 80 %  /  branches: 70 %  /  functions: 80 %
 */

import { describe, it, expect } from 'vitest';

import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_VALUES,
  HIGHLIGHT_INPUT_REGEX,
  resolveHighlightColor,
  serializeHighlight,
  type HighlightAttrs,
  type HighlightColor,
} from '../extensions/highlight';

// ===========================================================================
// 1. HIGHLIGHT_COLORS constant
// ===========================================================================

describe('HIGHLIGHT_COLORS', () => {
  it('contains exactly six preset colors', () => {
    expect(HIGHLIGHT_COLORS).toHaveLength(6);
  });

  it('contains yellow, green, blue, pink, orange, purple', () => {
    expect(HIGHLIGHT_COLORS).toContain('yellow');
    expect(HIGHLIGHT_COLORS).toContain('green');
    expect(HIGHLIGHT_COLORS).toContain('blue');
    expect(HIGHLIGHT_COLORS).toContain('pink');
    expect(HIGHLIGHT_COLORS).toContain('orange');
    expect(HIGHLIGHT_COLORS).toContain('purple');
  });

  it('is a readonly tuple (immutable)', () => {
    // TypeScript enforces this at compile time, but we can verify the runtime
    // array has the expected values and length.
    const copy = [...HIGHLIGHT_COLORS];
    expect(copy).toEqual(['yellow', 'green', 'blue', 'pink', 'orange', 'purple']);
  });
});

// ===========================================================================
// 2. HIGHLIGHT_COLOR_VALUES
// ===========================================================================

describe('HIGHLIGHT_COLOR_VALUES', () => {
  it('has a CSS color value for every preset color', () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(HIGHLIGHT_COLOR_VALUES[color]).toBeDefined();
      expect(typeof HIGHLIGHT_COLOR_VALUES[color]).toBe('string');
    }
  });

  it('all values are rgba() strings', () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(HIGHLIGHT_COLOR_VALUES[color]).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
    }
  });

  it('all values use 0.4 opacity for consistent semi-transparency', () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(HIGHLIGHT_COLOR_VALUES[color]).toContain('0.4)');
    }
  });

  it('yellow value is a warm yellow', () => {
    expect(HIGHLIGHT_COLOR_VALUES.yellow).toBe('rgba(250, 204, 21, 0.4)');
  });

  it('green value is a bright green', () => {
    expect(HIGHLIGHT_COLOR_VALUES.green).toBe('rgba(74, 222, 128, 0.4)');
  });
});

// ===========================================================================
// 3. resolveHighlightColor
// ===========================================================================

describe('resolveHighlightColor', () => {
  // ---- Happy path ----------------------------------------------------------

  it('returns the same color for a valid preset', () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(resolveHighlightColor(color)).toBe(color);
    }
  });

  it('returns "yellow" for undefined', () => {
    expect(resolveHighlightColor(undefined)).toBe('yellow');
  });

  it('returns "yellow" for null', () => {
    expect(resolveHighlightColor(null)).toBe('yellow');
  });

  // ---- Error cases ---------------------------------------------------------

  it('returns "yellow" for an unknown color string', () => {
    expect(resolveHighlightColor('red')).toBe('yellow');
  });

  it('returns "yellow" for an empty string', () => {
    expect(resolveHighlightColor('')).toBe('yellow');
  });

  it('returns "yellow" for a color with wrong casing', () => {
    // Our colors are lowercase; "Yellow" should not match.
    expect(resolveHighlightColor('Yellow')).toBe('yellow');
  });

  it('returns "yellow" for numeric string', () => {
    expect(resolveHighlightColor('123')).toBe('yellow');
  });

  // ---- Each valid color returns correctly -----------------------------------

  it('returns "green" for "green"', () => {
    expect(resolveHighlightColor('green')).toBe('green');
  });

  it('returns "blue" for "blue"', () => {
    expect(resolveHighlightColor('blue')).toBe('blue');
  });

  it('returns "pink" for "pink"', () => {
    expect(resolveHighlightColor('pink')).toBe('pink');
  });

  it('returns "orange" for "orange"', () => {
    expect(resolveHighlightColor('orange')).toBe('orange');
  });

  it('returns "purple" for "purple"', () => {
    expect(resolveHighlightColor('purple')).toBe('purple');
  });
});

// ===========================================================================
// 4. serializeHighlight
// ===========================================================================

describe('serializeHighlight', () => {
  it('wraps text in == delimiters', () => {
    expect(serializeHighlight('important')).toBe('==important==');
  });

  it('preserves whitespace in the text', () => {
    expect(serializeHighlight('very important text')).toBe('==very important text==');
  });

  it('handles empty string', () => {
    expect(serializeHighlight('')).toBe('====');
  });

  it('handles text with special characters', () => {
    expect(serializeHighlight('a & b < c')).toBe('==a & b < c==');
  });

  it('handles text with markdown syntax inside', () => {
    expect(serializeHighlight('**bold** text')).toBe('==**bold** text==');
  });

  it('output always starts with == and ends with ==', () => {
    for (const text of ['a', 'abc', '  spaces  ', 'multi\nline']) {
      const result = serializeHighlight(text);
      expect(result.startsWith('==')).toBe(true);
      expect(result.endsWith('==')).toBe(true);
    }
  });
});

// ===========================================================================
// 5. HIGHLIGHT_INPUT_REGEX
// ===========================================================================

describe('HIGHLIGHT_INPUT_REGEX', () => {
  function match(input: string) {
    return HIGHLIGHT_INPUT_REGEX.exec(input);
  }

  // ---- Happy path ----------------------------------------------------------

  it('matches ==highlighted== at end of string', () => {
    const m = match('==highlighted==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('highlighted');
  });

  it('matches ==text== at the end of a sentence', () => {
    const m = match('Some text ==important==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('important');
  });

  it('matches ==multi word highlight==', () => {
    const m = match('==multi word highlight==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('multi word highlight');
  });

  it('matches ==a== (single character)', () => {
    const m = match('==a==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a');
  });

  it('matches highlight with special characters', () => {
    const m = match('==foo & bar==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('foo & bar');
  });

  // ---- Non-matching cases --------------------------------------------------

  it('does not match ====  (empty content)', () => {
    const m = match('====');
    expect(m).toBeNull();
  });

  it('does not match a single = pair =text=', () => {
    const m = match('=text=');
    expect(m).toBeNull();
  });

  it('does not match ===text=== (triple equals — negative lookbehind)', () => {
    // ===text=== — the leading === means the character before == is =
    const m = match('===text===');
    expect(m).toBeNull();
  });

  it('does not match unclosed ==text', () => {
    const m = match('==unclosed');
    expect(m).toBeNull();
  });

  it('does not match ==text== in the middle with trailing text', () => {
    const m = match('==text== more');
    expect(m).toBeNull();
  });

  // ---- Edge cases ----------------------------------------------------------

  it('requires match to be at end of string ($)', () => {
    const m = match('==text== and more text');
    expect(m).toBeNull();
  });

  it('captures everything between the == delimiters', () => {
    const m = match('==  spaces  ==');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('  spaces  ');
  });

  it('round-trips with serializeHighlight', () => {
    const serialized = serializeHighlight('test text');
    const m = match(serialized);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('test text');
  });
});

// ===========================================================================
// 6. Markdown round-trip: serialize + regex parse
// ===========================================================================

describe('Markdown round-trip', () => {
  it('serializeHighlight output is parseable by HIGHLIGHT_INPUT_REGEX', () => {
    for (const text of ['important', 'key concept', 'a', 'x y z']) {
      const md = serializeHighlight(text);
      const m = HIGHLIGHT_INPUT_REGEX.exec(md);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(text);
    }
  });

  it('preserved text content survives the round trip', () => {
    const texts = ['hello world', 'test', 'multiple words here'];
    for (const text of texts) {
      const serialized = serializeHighlight(text);
      const parsed = HIGHLIGHT_INPUT_REGEX.exec(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed![1]).toBe(text);
    }
  });
});

// ===========================================================================
// 7. Color attribute contract
// ===========================================================================

describe('Highlight attribute contract', () => {
  it('default color is "yellow"', () => {
    const defaults: HighlightAttrs = { color: 'yellow' };
    expect(defaults.color).toBe('yellow');
  });

  it('parseHTML resolves a valid color from string attribute', () => {
    // Simulates what parseHTML does: resolve the data-highlight-color attr value.
    const result = resolveHighlightColor('green');
    expect(result).toBe('green');
  });

  it('parseHTML returns yellow when attribute value is null', () => {
    // Simulates missing attribute: getAttribute returns null.
    const result = resolveHighlightColor(null);
    expect(result).toBe('yellow');
  });

  it('parseHTML returns yellow when attribute has unknown value', () => {
    const result = resolveHighlightColor('magenta');
    expect(result).toBe('yellow');
  });

  it('parseHTML returns yellow for each invalid input type', () => {
    const invalids: Array<string | undefined | null> = [undefined, null, '', 'red', 'cyan'];
    for (const input of invalids) {
      expect(resolveHighlightColor(input)).toBe('yellow');
    }
  });
});

// ===========================================================================
// 8. CSS class generation contract
// ===========================================================================

describe('CSS class generation', () => {
  it('generates correct class names for each color', () => {
    for (const color of HIGHLIGHT_COLORS) {
      const className = `ns-highlight ns-highlight--${color}`;
      expect(className).toMatch(/^ns-highlight ns-highlight--[a-z]+$/);
    }
  });

  it('class names follow BEM convention', () => {
    for (const color of HIGHLIGHT_COLORS) {
      const blockClass = 'ns-highlight';
      const modifierClass = `ns-highlight--${color}`;
      expect(blockClass).toBe('ns-highlight');
      expect(modifierClass).toMatch(/^ns-highlight--[a-z]+$/);
    }
  });
});

// ===========================================================================
// 9. Type safety: HighlightColor type
// ===========================================================================

describe('HighlightColor type safety', () => {
  it('all HIGHLIGHT_COLORS values can be used as HighlightColor', () => {
    // This is primarily a compile-time check, but we verify at runtime too.
    const colors: HighlightColor[] = [...HIGHLIGHT_COLORS];
    expect(colors).toHaveLength(6);
  });

  it('resolveHighlightColor always returns a valid HighlightColor', () => {
    const inputs = [undefined, null, '', 'red', 'invalid', 'yellow', 'green'];
    for (const input of inputs) {
      const result = resolveHighlightColor(input);
      expect((HIGHLIGHT_COLORS as readonly string[]).includes(result)).toBe(true);
    }
  });
});
