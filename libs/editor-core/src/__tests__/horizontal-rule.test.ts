/**
 * Unit tests for the HorizontalRule TipTap extension.
 *
 * Tests exercise pure logic without a DOM or full editor instance:
 * - HR_STYLES: completeness and no duplicates
 * - resolveHrStyle: normalisation and fallback behaviour
 * - HR_INPUT_REGEX: Markdown shortcut matching
 * - serializeHorizontalRule: plain-text output
 * - renderHTML attribute helpers: data-hr-style round-trip
 */

import { describe, it, expect } from 'vitest';
import {
  HR_STYLES,
  HR_INPUT_REGEX,
  resolveHrStyle,
  serializeHorizontalRule,
} from '../extensions/horizontal-rule';
import type { HrStyle } from '../extensions/horizontal-rule';

// ---------------------------------------------------------------------------
// HR_STYLES
// ---------------------------------------------------------------------------

describe('HR_STYLES', () => {
  it('contains exactly 3 styles', () => {
    expect(HR_STYLES).toHaveLength(3);
  });

  it('includes all expected variants', () => {
    expect(HR_STYLES).toContain('thin');
    expect(HR_STYLES).toContain('thick');
    expect(HR_STYLES).toContain('dashed');
  });

  it('has no duplicates', () => {
    const unique = new Set(HR_STYLES);
    expect(unique.size).toBe(HR_STYLES.length);
  });
});

// ---------------------------------------------------------------------------
// resolveHrStyle
// ---------------------------------------------------------------------------

describe('resolveHrStyle', () => {
  it('resolves all canonical styles as-is', () => {
    expect(resolveHrStyle('thin')).toBe('thin');
    expect(resolveHrStyle('thick')).toBe('thick');
    expect(resolveHrStyle('dashed')).toBe('dashed');
  });

  it('returns "thin" for unknown string values', () => {
    expect(resolveHrStyle('medium')).toBe('thin');
    expect(resolveHrStyle('solid')).toBe('thin');
    expect(resolveHrStyle('foobar')).toBe('thin');
    expect(resolveHrStyle('')).toBe('thin');
  });

  it('returns "thin" for null and undefined', () => {
    expect(resolveHrStyle(null)).toBe('thin');
    expect(resolveHrStyle(undefined)).toBe('thin');
  });

  it('returns "thin" for non-string primitives', () => {
    expect(resolveHrStyle(42)).toBe('thin');
    expect(resolveHrStyle(true)).toBe('thin');
    expect(resolveHrStyle({})).toBe('thin');
  });

  it('all HR_STYLES values are recognised by resolveHrStyle', () => {
    for (const style of HR_STYLES) {
      expect(resolveHrStyle(style)).toBe(style);
    }
  });
});

// ---------------------------------------------------------------------------
// HR_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('HR_INPUT_REGEX', () => {
  // Helper to check if the pattern matches the full string.
  function matches(input: string): boolean {
    return HR_INPUT_REGEX.test(input);
  }

  // --- Happy path: hyphens ---

  it('matches exactly "---"', () => {
    expect(matches('---')).toBe(true);
  });

  it('matches four hyphens "----"', () => {
    expect(matches('----')).toBe(true);
  });

  it('matches many hyphens "----------"', () => {
    expect(matches('----------')).toBe(true);
  });

  it('matches "---" with trailing spaces', () => {
    expect(matches('---   ')).toBe(true);
  });

  it('matches "---" with trailing tab', () => {
    expect(matches('---\t')).toBe(true);
  });

  // --- Happy path: underscores ---

  it('matches exactly "___"', () => {
    expect(matches('___')).toBe(true);
  });

  it('matches four underscores "____"', () => {
    expect(matches('____')).toBe(true);
  });

  it('matches "___" with trailing spaces', () => {
    expect(matches('___   ')).toBe(true);
  });

  // --- Happy path: asterisks ---

  it('matches exactly "***"', () => {
    expect(matches('***')).toBe(true);
  });

  it('matches four asterisks "****"', () => {
    expect(matches('****')).toBe(true);
  });

  it('matches "***" with trailing spaces', () => {
    expect(matches('***   ')).toBe(true);
  });

  // --- Non-matching cases ---

  it('does not match only two hyphens "--"', () => {
    expect(matches('--')).toBe(false);
  });

  it('does not match only two underscores "__"', () => {
    expect(matches('__')).toBe(false);
  });

  it('does not match only two asterisks "**"', () => {
    expect(matches('**')).toBe(false);
  });

  it('does not match "--- heading text"', () => {
    expect(matches('--- heading text')).toBe(false);
  });

  it('does not match "---text" (text after hyphens, no space)', () => {
    expect(matches('---text')).toBe(false);
  });

  it('does not match an empty string', () => {
    expect(matches('')).toBe(false);
  });

  it('does not match mixed characters "-_-"', () => {
    expect(matches('-_-')).toBe(false);
  });

  it('does not match "  ---" (leading spaces)', () => {
    // Leading spaces are not part of the match pattern (InputRule handles
    // this at the start-of-block level, so we test the raw pattern here)
    expect(matches('  ---')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serializeHorizontalRule
// ---------------------------------------------------------------------------

describe('serializeHorizontalRule', () => {
  it('returns "---\\n"', () => {
    expect(serializeHorizontalRule()).toBe('---\n');
  });

  it('is a string', () => {
    expect(typeof serializeHorizontalRule()).toBe('string');
  });

  it('is identical regardless of hr style (style is visual-only)', () => {
    // serializeHorizontalRule takes no arguments — Markdown has one hr syntax
    const styles: HrStyle[] = ['thin', 'thick', 'dashed'];
    const results = styles.map(() => serializeHorizontalRule());
    expect(new Set(results).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Attribute contract — renderHTML / parseHTML helpers
// ---------------------------------------------------------------------------

describe('HorizontalRule attribute contract', () => {
  /**
   * Mirror of the renderHTML attribute logic: attrs['style'] → data-hr-style.
   */
  function renderHrStyleAttr(attrs: Record<string, unknown>): Record<string, string> {
    return { 'data-hr-style': String(attrs['style'] ?? 'thin') };
  }

  /**
   * Mirror of the parseHTML attribute logic: element → style attr.
   */
  function parseHrStyleAttr(dataAttr: string | null): HrStyle {
    return resolveHrStyle(dataAttr);
  }

  it('renderHTML: thin style serialises to data-hr-style="thin"', () => {
    expect(renderHrStyleAttr({ style: 'thin' })).toEqual({ 'data-hr-style': 'thin' });
  });

  it('renderHTML: thick style serialises to data-hr-style="thick"', () => {
    expect(renderHrStyleAttr({ style: 'thick' })).toEqual({ 'data-hr-style': 'thick' });
  });

  it('renderHTML: dashed style serialises to data-hr-style="dashed"', () => {
    expect(renderHrStyleAttr({ style: 'dashed' })).toEqual({ 'data-hr-style': 'dashed' });
  });

  it('parseHTML: reads "thin" from data-hr-style attribute', () => {
    expect(parseHrStyleAttr('thin')).toBe('thin');
  });

  it('parseHTML: reads "thick" from data-hr-style attribute', () => {
    expect(parseHrStyleAttr('thick')).toBe('thick');
  });

  it('parseHTML: reads "dashed" from data-hr-style attribute', () => {
    expect(parseHrStyleAttr('dashed')).toBe('dashed');
  });

  it('parseHTML: falls back to "thin" for null attribute (plain <hr> with no data-hr-style)', () => {
    expect(parseHrStyleAttr(null)).toBe('thin');
  });

  it('parseHTML: falls back to "thin" for unknown attribute value', () => {
    expect(parseHrStyleAttr('medium')).toBe('thin');
  });

  it('round-trip: all styles survive renderHTML → parseHTML', () => {
    const styles: HrStyle[] = ['thin', 'thick', 'dashed'];
    for (const style of styles) {
      const rendered = renderHrStyleAttr({ style });
      const parsed = parseHrStyleAttr(rendered['data-hr-style'] ?? null);
      expect(parsed).toBe(style);
    }
  });
});

// ---------------------------------------------------------------------------
// CSS class helpers
// ---------------------------------------------------------------------------

describe('HorizontalRule CSS class contract', () => {
  /**
   * Mirror of the CSS class logic in renderHTML.
   */
  function getHrClass(style: HrStyle): string {
    return `ns-hr ns-hr--${style}`;
  }

  it('builds correct class for thin', () => {
    expect(getHrClass('thin')).toBe('ns-hr ns-hr--thin');
  });

  it('builds correct class for thick', () => {
    expect(getHrClass('thick')).toBe('ns-hr ns-hr--thick');
  });

  it('builds correct class for dashed', () => {
    expect(getHrClass('dashed')).toBe('ns-hr ns-hr--dashed');
  });

  it('all styles produce the ns-hr base class', () => {
    const styles: HrStyle[] = ['thin', 'thick', 'dashed'];
    for (const style of styles) {
      expect(getHrClass(style)).toMatch(/^ns-hr /);
    }
  });

  it('each style produces a unique modifier class', () => {
    const classes = (['thin', 'thick', 'dashed'] as HrStyle[]).map(getHrClass);
    const unique = new Set(classes);
    expect(unique.size).toBe(3);
  });
});
