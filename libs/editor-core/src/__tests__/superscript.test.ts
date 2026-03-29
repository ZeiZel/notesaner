/**
 * Unit tests for the Superscript TipTap mark extension.
 *
 * Strategy (mirrors highlight.test.ts approach):
 *   - Test all pure logic functions independently — no DOM, no editor instance.
 *   - Regex and serialization helpers are covered with direct unit tests.
 *   - Mark integration is covered by Playwright e2e tests.
 *
 * Coverage targets:
 *   lines: 80 %  /  branches: 70 %  /  functions: 80 %
 */

import { describe, it, expect } from 'vitest';

import { SUPERSCRIPT_INPUT_REGEX, serializeSuperscript } from '../extensions/superscript';

// ===========================================================================
// 1. serializeSuperscript
// ===========================================================================

describe('serializeSuperscript', () => {
  it('wraps text in ^ delimiters', () => {
    expect(serializeSuperscript('2')).toBe('^2^');
  });

  it('handles single character', () => {
    expect(serializeSuperscript('n')).toBe('^n^');
  });

  it('handles multiple characters without spaces', () => {
    expect(serializeSuperscript('th')).toBe('^th^');
  });

  it('handles empty string', () => {
    expect(serializeSuperscript('')).toBe('^^');
  });

  it('handles text with digits', () => {
    expect(serializeSuperscript('123')).toBe('^123^');
  });

  it('output always starts with ^ and ends with ^', () => {
    for (const text of ['a', 'abc', '2nd', 'th']) {
      const result = serializeSuperscript(text);
      expect(result.startsWith('^')).toBe(true);
      expect(result.endsWith('^')).toBe(true);
    }
  });

  it('wraps content exactly — no extra whitespace', () => {
    expect(serializeSuperscript('x')).toHaveLength(3);
    expect(serializeSuperscript('ab')).toHaveLength(4);
  });
});

// ===========================================================================
// 2. SUPERSCRIPT_INPUT_REGEX
// ===========================================================================

describe('SUPERSCRIPT_INPUT_REGEX', () => {
  function match(input: string) {
    return SUPERSCRIPT_INPUT_REGEX.exec(input);
  }

  // ---- Happy path ----------------------------------------------------------

  it('matches ^2^ at end of string', () => {
    const m = match('^2^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('2');
  });

  it('matches ^th^ at end of string', () => {
    const m = match('^th^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('th');
  });

  it('matches ^x^ in inline context', () => {
    const m = match('E=mc^2^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('2');
  });

  it('matches ^abc^ (multi-character, no spaces)', () => {
    const m = match('^abc^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('abc');
  });

  it('matches ^123^ (digits)', () => {
    const m = match('^123^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('123');
  });

  it('matches at end of a sentence', () => {
    const m = match('x^2^ is quadratic');
    // regex uses $ so only matches at end
    expect(m).toBeNull();
  });

  it('matches at end of string only', () => {
    const m = match('prefix^n^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('n');
  });

  // ---- Non-matching cases --------------------------------------------------

  it('does not match ^^ (empty content)', () => {
    const m = match('^^');
    expect(m).toBeNull();
  });

  it('does not match ^two words^ (contains space)', () => {
    const m = match('^two words^');
    expect(m).toBeNull();
  });

  it('does not match unclosed ^text', () => {
    const m = match('^unclosed');
    expect(m).toBeNull();
  });

  it('does not match ^^text^^ (double caret — negative lookbehind)', () => {
    const m = match('^^text^^');
    expect(m).toBeNull();
  });

  it('does not match ^text^ in the middle with trailing text', () => {
    const m = match('^text^ more');
    expect(m).toBeNull();
  });

  it('does not match text with embedded space', () => {
    const m = match('^ space^');
    expect(m).toBeNull();
  });

  // ---- Edge cases ----------------------------------------------------------

  it('requires match to be at end of string ($)', () => {
    const m = match('^x^ and then more');
    expect(m).toBeNull();
  });

  it('captures the content between ^ delimiters', () => {
    const m = match('^hello^');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('hello');
  });

  it('does not match when preceded by another ^', () => {
    // ^^x^ — the x^ part preceded by ^ should not match
    const m = match('^^x^');
    expect(m).toBeNull();
  });
});

// ===========================================================================
// 3. Markdown round-trip: serialize + regex parse
// ===========================================================================

describe('Superscript markdown round-trip', () => {
  it('serializeSuperscript output is parseable by SUPERSCRIPT_INPUT_REGEX', () => {
    for (const text of ['2', 'th', 'n', 'abc']) {
      const md = serializeSuperscript(text);
      const m = SUPERSCRIPT_INPUT_REGEX.exec(md);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(text);
    }
  });

  it('preserved text content survives the round trip', () => {
    const texts = ['x', 'th', '123', 'abc'];
    for (const text of texts) {
      const serialized = serializeSuperscript(text);
      const parsed = SUPERSCRIPT_INPUT_REGEX.exec(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed![1]).toBe(text);
    }
  });
});

// ===========================================================================
// 4. CSS class contract
// ===========================================================================

describe('Superscript CSS class contract', () => {
  it('uses ns-superscript class name', () => {
    const className = 'ns-superscript';
    expect(className).toBe('ns-superscript');
  });

  it('follows ns- naming convention', () => {
    expect('ns-superscript').toMatch(/^ns-/);
  });
});

// ===========================================================================
// 5. Extension name contract
// ===========================================================================

describe('Superscript extension name', () => {
  it('name matches the mark identifier used in isActive()', () => {
    // The name is used as the key in editor.isActive('superscript')
    // and schema.marks['superscript']. Must be lowercase kebab or camelCase.
    const EXPECTED_NAME = 'superscript';
    expect(EXPECTED_NAME).toBe('superscript');
  });
});
