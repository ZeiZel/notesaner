/**
 * Tests for csv-utils.ts
 *
 * Covers:
 * - escapeCsvCell handles quotes, commas, newlines
 * - parseCsvLine handles RFC 4180 quoted fields and escaped double-quotes
 * - splitCsvRows handles multi-line quoted fields
 * - exportToCsv produces correct CSV output
 * - importFromCsv parses CSV and maps to column types
 * - generateCsvFilename produces clean filenames
 */

import { describe, it, expect } from 'vitest';
import {
  escapeCsvCell,
  parseCsvLine,
  splitCsvRows,
  exportToCsv,
  importFromCsv,
  generateCsvFilename,
} from '../csv-utils';
import type { DatabaseRow, ColumnDefinition } from '../database-schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEXT_COL: ColumnDefinition = { id: 'col_text', name: 'Notes', type: 'text', width: 200 };
const NUMBER_COL: ColumnDefinition = { id: 'col_num', name: 'Count', type: 'number', width: 100 };
const CHECKBOX_COL: ColumnDefinition = {
  id: 'col_check',
  name: 'Done',
  type: 'checkbox',
  width: 80,
};
const DATE_COL: ColumnDefinition = { id: 'col_date', name: 'Due Date', type: 'date', width: 120 };
const MULTI_COL: ColumnDefinition = {
  id: 'col_multi',
  name: 'Tags',
  type: 'multi_select',
  width: 180,
  options: {
    options: [
      { id: 'opt_a', label: 'alpha' },
      { id: 'opt_b', label: 'beta' },
    ],
  },
};
const FORMULA_COL: ColumnDefinition = {
  id: 'col_formula',
  name: 'Total',
  type: 'formula',
  options: { expression: 'price * qty' },
};

const COLUMNS = [TEXT_COL, NUMBER_COL, CHECKBOX_COL, DATE_COL, MULTI_COL];

function makeRow(overrides: Partial<DatabaseRow> = {}): DatabaseRow {
  return {
    id: 'row_1',
    title: 'Test Row',
    path: '/vault/test-row.md',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    values: {
      col_text: 'Hello, World',
      col_num: 42,
      col_check: true,
      col_date: '2026-03-15',
      col_multi: ['alpha', 'beta'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// escapeCsvCell
// ---------------------------------------------------------------------------

describe('escapeCsvCell', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('42')).toBe('42');
  });

  it('wraps values containing commas in double-quotes', () => {
    expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"');
  });

  it('wraps values containing newlines', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('escapes double-quotes by doubling them', () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('handles both quotes and commas', () => {
    const result = escapeCsvCell('a, "b"');
    expect(result).toBe('"a, ""b"""');
  });

  it('returns empty string unchanged', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// parseCsvLine
// ---------------------------------------------------------------------------

describe('parseCsvLine', () => {
  it('parses a simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    expect(parseCsvLine('"hello","world"')).toEqual(['hello', 'world']);
  });

  it('handles quoted field with comma inside', () => {
    expect(parseCsvLine('"Hello, World",b')).toEqual(['Hello, World', 'b']);
  });

  it('handles escaped double-quotes inside quoted field', () => {
    expect(parseCsvLine('"say ""hi"""')).toEqual(['say "hi"']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles trailing comma', () => {
    const result = parseCsvLine('a,b,');
    expect(result).toEqual(['a', 'b', '']);
  });

  it('returns a single-element array for a line with no commas', () => {
    expect(parseCsvLine('single')).toEqual(['single']);
  });
});

// ---------------------------------------------------------------------------
// splitCsvRows
// ---------------------------------------------------------------------------

describe('splitCsvRows', () => {
  it('splits simple CSV by newlines', () => {
    const result = splitCsvRows('a,b\nc,d');
    expect(result).toEqual(['a,b', 'c,d']);
  });

  it('handles CRLF line endings', () => {
    const result = splitCsvRows('a,b\r\nc,d');
    expect(result).toEqual(['a,b', 'c,d']);
  });

  it('does not split newlines inside quoted fields', () => {
    const result = splitCsvRows('"line1\nline2",b\nc,d');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('"line1\nline2",b');
  });

  it('returns a single row for content without line breaks', () => {
    const result = splitCsvRows('a,b,c');
    expect(result).toEqual(['a,b,c']);
  });
});

// ---------------------------------------------------------------------------
// exportToCsv
// ---------------------------------------------------------------------------

describe('exportToCsv', () => {
  it('produces a header row with Title first', () => {
    const csv = exportToCsv([makeRow()], COLUMNS, { lineEnding: '\n' });
    const lines = csv.split('\n');
    expect(lines[0]).toMatch(/^Title/);
    expect(lines[0]).toContain('Notes');
    expect(lines[0]).toContain('Count');
  });

  it('includes all non-formula, non-hidden columns by default', () => {
    const csv = exportToCsv([makeRow()], [...COLUMNS, FORMULA_COL], { lineEnding: '\n' });
    const header = csv.split('\n')[0];
    expect(header).not.toContain('Total');
  });

  it('serialises multi-select as semicolon-delimited', () => {
    const csv = exportToCsv([makeRow()], COLUMNS, { lineEnding: '\n', multiSelectDelimiter: ';' });
    expect(csv).toContain('alpha;beta');
  });

  it('serialises booleans as true/false', () => {
    const csv = exportToCsv([makeRow()], COLUMNS, { lineEnding: '\n' });
    expect(csv).toContain('true');
  });

  it('serialises numeric values without quotes', () => {
    const csv = exportToCsv([makeRow()], COLUMNS, { lineEnding: '\n' });
    expect(csv).toContain(',42,');
  });

  it('handles null values as empty cells', () => {
    const row = makeRow({
      values: { col_text: null, col_num: null, col_check: null, col_date: null, col_multi: null },
    });
    const csv = exportToCsv([row], COLUMNS, { lineEnding: '\n' });
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain(',,');
  });

  it('respects columnIds option', () => {
    const csv = exportToCsv([makeRow()], COLUMNS, { columnIds: ['col_text'], lineEnding: '\n' });
    const header = csv.split('\n')[0];
    expect(header).toContain('Notes');
    expect(header).not.toContain('Count');
  });

  it('produces CRLF by default', () => {
    const csv = exportToCsv([makeRow()], COLUMNS);
    expect(csv).toContain('\r\n');
  });
});

// ---------------------------------------------------------------------------
// importFromCsv
// ---------------------------------------------------------------------------

describe('importFromCsv', () => {
  const csvContent = [
    'Title,Notes,Count,Done,Due Date,Tags',
    'Row One,"Hello, World",42,true,2026-03-15,alpha;beta',
    'Row Two,,7,false,2026-04-01,',
  ].join('\n');

  it('parses the correct number of rows', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rowCount).toBe(2);
    expect(result.rows).toHaveLength(2);
  });

  it('parses the title', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rows[0].title).toBe('Row One');
    expect(result.rows[1].title).toBe('Row Two');
  });

  it('coerces numbers correctly', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rows[0].values[NUMBER_COL.id]).toBe(42);
    expect(result.rows[1].values[NUMBER_COL.id]).toBe(7);
  });

  it('coerces booleans correctly', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rows[0].values[CHECKBOX_COL.id]).toBe(true);
    expect(result.rows[1].values[CHECKBOX_COL.id]).toBe(false);
  });

  it('parses multi-select as array', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rows[0].values[MULTI_COL.id]).toEqual(['alpha', 'beta']);
  });

  it('sets null for empty multi-select', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.rows[1].values[MULTI_COL.id]).toBeNull();
  });

  it('skips rows without titles', () => {
    const csv = 'Title,Notes\n,empty title\nValid Title,some text\n';
    const result = importFromCsv(csv, [TEXT_COL]);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].title).toBe('Valid Title');
  });

  it('returns non-fatal warnings for unknown columns', () => {
    const csv = 'Title,Notes,UnknownColumn\nRow,text,value\n';
    const result = importFromCsv(csv, [TEXT_COL]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('UnknownColumn');
  });

  it('skips duplicate header row', () => {
    const csv = 'Title,Notes\nTitle,Notes\nRow,value\n';
    const result = importFromCsv(csv, [TEXT_COL]);
    expect(result.rowCount).toBe(1);
  });

  it('returns headers (excluding Title)', () => {
    const result = importFromCsv(csvContent, COLUMNS);
    expect(result.headers).toContain('Notes');
    expect(result.headers).toContain('Count');
    expect(result.headers).not.toContain('Title');
  });
});

// ---------------------------------------------------------------------------
// generateCsvFilename
// ---------------------------------------------------------------------------

describe('generateCsvFilename', () => {
  it('ends with .csv', () => {
    expect(generateCsvFilename('My Database')).toMatch(/\.csv$/);
  });

  it('replaces spaces with hyphens and lowercases', () => {
    const name = generateCsvFilename('My Project Tasks');
    expect(name).toContain('my-project-tasks');
  });

  it('removes special characters', () => {
    const name = generateCsvFilename('Tasks & Notes!');
    expect(name).not.toMatch(/[&!]/);
  });

  it('handles empty input gracefully', () => {
    const name = generateCsvFilename('');
    expect(name).toMatch(/^database-/);
  });

  it('includes a date component', () => {
    const name = generateCsvFilename('test');
    // Date format: YYYY-MM-DD
    expect(name).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
