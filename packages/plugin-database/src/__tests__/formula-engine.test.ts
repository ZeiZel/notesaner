/**
 * Tests for formula-engine.ts
 *
 * Covers:
 * - Arithmetic operations (+, -, *, /, %, **)
 * - Comparison operators (==, !=, <, >, <=, >=)
 * - Logical operators (&&, ||, !)
 * - Unary minus
 * - String functions (concat, length, upper, lower, trim, contains, etc.)
 * - Math functions (round, floor, ceil, abs, sqrt, min, max, sum, average)
 * - Date functions (now, today, dateformat, datediff)
 * - Boolean functions (not, and, or, empty)
 * - Type conversion (tonumber, tostring, toboolean)
 * - prop() function and bare identifier resolution
 * - if() conditional
 * - Error handling for invalid expressions and unknown functions
 * - validateFormula
 */

import { describe, it, expect } from 'vitest';
import { evaluateFormula, validateFormula } from '../formula-engine';
import type { FormulaContext } from '../formula-engine';
import type { ColumnDefinition, DatabaseRow } from '../database-schema';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeContext(values: Record<string, unknown> = {}): FormulaContext {
  const columns: ColumnDefinition[] = Object.keys(values).map((name) => ({
    id: `col_${name.toLowerCase()}`,
    name,
    type: 'text' as const,
  }));

  const row: DatabaseRow = {
    id: 'row_1',
    title: 'Test',
    path: '/vault/test.md',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    values: Object.fromEntries(
      Object.entries(values).map(([name, val]) => [
        `col_${name.toLowerCase()}`,
        val as import('../database-schema').CellValue,
      ]),
    ),
  };

  return { columns, row };
}

function eval_(expr: string, ctx: FormulaContext = makeContext()) {
  const result = evaluateFormula(expr, ctx);
  if (!result.ok) throw new Error(`Formula error: ${result.error.message}`);
  return result.value;
}

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

describe('Literals', () => {
  it('evaluates number literal', () => expect(eval_('42')).toBe(42));
  it('evaluates negative number literal via unary minus', () => expect(eval_('-3.14')).toBe(-3.14));
  it('evaluates string literal with double quotes', () => expect(eval_('"hello"')).toBe('hello'));
  it('evaluates string literal with single quotes', () => expect(eval_("'world'")).toBe('world'));
  it('evaluates boolean true', () => expect(eval_('true')).toBe(true));
  it('evaluates boolean false', () => expect(eval_('false')).toBe(false));
  it('evaluates null', () => expect(eval_('null')).toBe(null));
});

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

describe('Arithmetic', () => {
  it('adds two numbers', () => expect(eval_('1 + 2')).toBe(3));
  it('subtracts numbers', () => expect(eval_('10 - 3')).toBe(7));
  it('multiplies numbers', () => expect(eval_('4 * 5')).toBe(20));
  it('divides numbers', () => expect(eval_('9 / 3')).toBe(3));
  it('returns null on division by zero', () => expect(eval_('5 / 0')).toBeNull());
  it('computes modulo', () => expect(eval_('10 % 3')).toBe(1));
  it('computes power', () => expect(eval_('2 ** 8')).toBe(256));
  it('respects operator precedence', () => expect(eval_('2 + 3 * 4')).toBe(14));
  it('respects parentheses', () => expect(eval_('(2 + 3) * 4')).toBe(20));
  it('concatenates strings with +', () =>
    expect(eval_('"hello" + " " + "world"')).toBe('hello world'));
  it('concatenates mixed types with +', () => expect(eval_('"count: " + 42')).toBe('count: 42'));
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

describe('Comparison', () => {
  it('equals', () => expect(eval_('5 == 5')).toBe(true));
  it('not equals', () => expect(eval_('5 != 6')).toBe(true));
  it('less than', () => expect(eval_('3 < 5')).toBe(true));
  it('greater than', () => expect(eval_('5 > 3')).toBe(true));
  it('less than or equal', () => expect(eval_('3 <= 3')).toBe(true));
  it('greater than or equal', () => expect(eval_('4 >= 4')).toBe(true));
  it('returns false for failed comparison', () => expect(eval_('5 == 6')).toBe(false));
  it('compares null == null', () => expect(eval_('null == null')).toBe(true));
});

// ---------------------------------------------------------------------------
// Logical
// ---------------------------------------------------------------------------

describe('Logical', () => {
  it('AND true && true', () => expect(eval_('true && true')).toBe(true));
  it('AND true && false', () => expect(eval_('true && false')).toBe(false));
  it('OR false || true', () => expect(eval_('false || true')).toBe(true));
  it('NOT true', () => expect(eval_('!true')).toBe(false));
  it('NOT false', () => expect(eval_('!false')).toBe(true));
  it('chains logical operators', () => expect(eval_('true && true || false')).toBe(true));
});

// ---------------------------------------------------------------------------
// if()
// ---------------------------------------------------------------------------

describe('if()', () => {
  it('returns then-branch when condition is true', () => {
    expect(eval_('if(true, "yes", "no")')).toBe('yes');
  });
  it('returns else-branch when condition is false', () => {
    expect(eval_('if(false, "yes", "no")')).toBe('no');
  });
  it('returns null when condition is false and no else', () => {
    expect(eval_('if(false, "yes")')).toBeNull();
  });
  it('evaluates complex condition', () => {
    expect(eval_('if(2 > 1, "big", "small")')).toBe('big');
  });
});

// ---------------------------------------------------------------------------
// String functions
// ---------------------------------------------------------------------------

describe('String functions', () => {
  it('concat() joins strings', () => expect(eval_('concat("a", "b", "c")')).toBe('abc'));
  it('length() counts characters', () => expect(eval_('length("hello")')).toBe(5));
  it('upper() uppercases', () => expect(eval_('upper("hello")')).toBe('HELLO'));
  it('lower() lowercases', () => expect(eval_('lower("WORLD")')).toBe('world'));
  it('trim() strips whitespace', () => expect(eval_('trim("  hi  ")')).toBe('hi'));
  it('contains() returns true when substring found', () =>
    expect(eval_('contains("hello world", "world")')).toBe(true));
  it('contains() returns false when not found', () =>
    expect(eval_('contains("hello", "xyz")')).toBe(false));
  it('startswith() works', () => expect(eval_('startswith("hello", "he")')).toBe(true));
  it('endswith() works', () => expect(eval_('endswith("hello", "lo")')).toBe(true));
  it('slice() extracts substring', () => expect(eval_('slice("hello", 1, 3)')).toBe('el'));
  it('replace() replaces occurrences', () => expect(eval_('replace("aaa", "a", "b")')).toBe('bbb'));
});

// ---------------------------------------------------------------------------
// Math functions
// ---------------------------------------------------------------------------

describe('Math functions', () => {
  it('round() rounds to nearest integer', () => expect(eval_('round(3.7)')).toBe(4));
  it('round() rounds to decimal places', () => expect(eval_('round(3.14159, 2)')).toBe(3.14));
  it('floor() rounds down', () => expect(eval_('floor(3.9)')).toBe(3));
  it('ceil() rounds up', () => expect(eval_('ceil(3.1)')).toBe(4));
  it('abs() returns absolute value', () => expect(eval_('abs(-5)')).toBe(5));
  it('sqrt() computes square root', () => expect(eval_('sqrt(16)')).toBe(4));
  it('min() returns smallest value', () => expect(eval_('min(3, 1, 2)')).toBe(1));
  it('max() returns largest value', () => expect(eval_('max(3, 1, 2)')).toBe(3));
  it('sum() adds all arguments', () => expect(eval_('sum(1, 2, 3, 4)')).toBe(10));
  it('average() computes mean', () => expect(eval_('average(2, 4, 6)')).toBe(4));
  it('mod() computes remainder', () => expect(eval_('mod(10, 3)')).toBe(1));
  it('pow() computes power', () => expect(eval_('pow(2, 10)')).toBe(1024));
});

// ---------------------------------------------------------------------------
// Boolean utility functions
// ---------------------------------------------------------------------------

describe('Boolean functions', () => {
  it('not() negates', () => expect(eval_('not(true)')).toBe(false));
  it('and() all true', () => expect(eval_('and(true, true, true)')).toBe(true));
  it('and() with false', () => expect(eval_('and(true, false)')).toBe(false));
  it('or() with one true', () => expect(eval_('or(false, true, false)')).toBe(true));
  it('empty() with null', () => expect(eval_('empty(null)')).toBe(true));
  it('empty() with empty string', () => expect(eval_('empty("")')).toBe(true));
  it('empty() with value', () => expect(eval_('empty("hello")')).toBe(false));
});

// ---------------------------------------------------------------------------
// Type conversion
// ---------------------------------------------------------------------------

describe('Type conversion', () => {
  it('tonumber() converts string to number', () => expect(eval_('tonumber("42")')).toBe(42));
  it('tostring() converts number to string', () => expect(eval_('tostring(3.14)')).toBe('3.14'));
  it('toboolean() converts truthy to true', () => expect(eval_('toboolean(1)')).toBe(true));
  it('toboolean() converts 0 to false', () => expect(eval_('toboolean(0)')).toBe(false));
});

// ---------------------------------------------------------------------------
// prop() and identifier resolution
// ---------------------------------------------------------------------------

describe('prop() and identifiers', () => {
  it('prop() looks up a column by name', () => {
    const ctx = makeContext({ Price: 100 });
    expect(eval_('prop("Price")', ctx)).toBe(100);
  });

  it('prop() is case-insensitive on column name', () => {
    const ctx = makeContext({ Price: 99 });
    expect(eval_('prop("price")', ctx)).toBe(99);
  });

  it('prop() returns null for missing column', () => {
    expect(eval_('prop("nonexistent")')).toBeNull();
  });

  it('bare identifier resolves to column value', () => {
    const ctx = makeContext({ Qty: 5 });
    expect(eval_('Qty', ctx)).toBe(5);
  });

  it('formula using two props', () => {
    const ctx = makeContext({ Price: 10, Qty: 3 });
    expect(eval_('prop("Price") * prop("Qty")', ctx)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Date functions (basic smoke tests — exact dates not asserted)
// ---------------------------------------------------------------------------

describe('Date functions', () => {
  it('now() returns an ISO string', () => {
    const result = eval_('now()');
    expect(typeof result).toBe('string');
    expect(new Date(result as string).getTime()).not.toBeNaN();
  });

  it('today() returns a date string without time', () => {
    const result = eval_('today()');
    expect(typeof result).toBe('string');
    expect(result as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('dateformat() formats a date string', () => {
    const result = eval_('dateformat("2026-03-15", "yyyy-MM-dd")');
    expect(result).toBe('2026-03-15');
  });

  it('datediff() computes day difference', () => {
    const result = eval_('datediff("2026-01-01", "2026-01-11", "days")');
    expect(result).toBe(10);
  });

  it('datediff() returns null for invalid date', () => {
    const result = eval_('datediff("not-a-date", "2026-01-01")');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('returns error for unknown function', () => {
    const result = evaluateFormula('foobar()', makeContext());
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain('foobar');
  });

  it('returns error for syntax error', () => {
    const result = evaluateFormula('2 +', makeContext());
    expect(result.ok).toBe(false);
  });

  it('returns error for unclosed parenthesis', () => {
    const result = evaluateFormula('(2 + 3', makeContext());
    expect(result.ok).toBe(false);
  });

  it('returns error for unexpected character', () => {
    const result = evaluateFormula('2 $ 3', makeContext());
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateFormula
// ---------------------------------------------------------------------------

describe('validateFormula', () => {
  it('returns true for valid expressions', () => {
    expect(validateFormula('1 + 2')).toBe(true);
    expect(validateFormula('if(true, "a", "b")')).toBe(true);
    expect(validateFormula('concat("a", prop("Name"))')).toBe(true);
  });

  it('returns an error string for invalid syntax', () => {
    const result = validateFormula('2 +');
    expect(typeof result).toBe('string');
    expect(result).not.toBe(true);
  });

  it('returns error string for unclosed string literal', () => {
    const result = validateFormula('"unterminated');
    expect(result).not.toBe(true);
  });
});
