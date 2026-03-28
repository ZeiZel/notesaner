/**
 * Tests for database-schema.ts
 *
 * Covers:
 * - parseDatabaseSchema validates correct and invalid schemas
 * - createDefaultSchema produces a valid schema
 * - addColumn / removeColumn / updateColumn (immutability)
 * - getColumn / getActiveView
 * - validateCellValue per type
 */

import { describe, it, expect } from 'vitest';
import {
  parseDatabaseSchema,
  createDefaultSchema,
  addColumn,
  removeColumn,
  updateColumn,
  getColumn,
  getActiveView,
  validateCellValue,
  type DatabaseSchemaDefinition,
  type ColumnDefinition,
} from '../database-schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSchema(): DatabaseSchemaDefinition {
  return createDefaultSchema('db_test_001');
}

function makeColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: 'col_new',
    name: 'New Column',
    type: 'text',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseDatabaseSchema
// ---------------------------------------------------------------------------

describe('parseDatabaseSchema', () => {
  it('accepts a valid schema', () => {
    const raw = makeSchema();
    const parsed = parseDatabaseSchema(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.id).toBe('db_test_001');
    expect(parsed.columns.length).toBeGreaterThan(0);
  });

  it('throws on missing required fields', () => {
    expect(() => parseDatabaseSchema({})).toThrow();
  });

  it('throws on wrong version', () => {
    const raw = { ...makeSchema(), version: 2 };
    expect(() => parseDatabaseSchema(raw)).toThrow();
  });

  it('throws on empty columns array with wrong type', () => {
    const raw = { ...makeSchema(), columns: 'not-an-array' };
    expect(() => parseDatabaseSchema(raw)).toThrow();
  });

  it('throws on unknown column type', () => {
    const raw = makeSchema();
    raw.columns[0] = { ...raw.columns[0], type: 'unknown_type' as never };
    expect(() => parseDatabaseSchema(raw)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createDefaultSchema
// ---------------------------------------------------------------------------

describe('createDefaultSchema', () => {
  it('creates a schema with version 1', () => {
    const schema = createDefaultSchema('my_db');
    expect(schema.version).toBe(1);
  });

  it('uses the provided ID', () => {
    const schema = createDefaultSchema('my_db');
    expect(schema.id).toBe('my_db');
  });

  it('has at least one view', () => {
    const schema = createDefaultSchema('my_db');
    expect(schema.views.length).toBeGreaterThan(0);
  });

  it('has an activeViewId pointing to an existing view', () => {
    const schema = createDefaultSchema('my_db');
    const view = schema.views.find((v) => v.id === schema.activeViewId);
    expect(view).toBeDefined();
  });

  it('has default columns including Status', () => {
    const schema = createDefaultSchema('my_db');
    const statusCol = schema.columns.find((c) => c.name === 'Status');
    expect(statusCol).toBeDefined();
    expect(statusCol?.type).toBe('select');
  });
});

// ---------------------------------------------------------------------------
// addColumn / removeColumn / updateColumn
// ---------------------------------------------------------------------------

describe('addColumn', () => {
  it('appends a column to the schema', () => {
    const schema = makeSchema();
    const col = makeColumn({ id: 'col_x', name: 'Extra' });
    const updated = addColumn(schema, col);
    expect(updated.columns).toHaveLength(schema.columns.length + 1);
    expect(updated.columns[updated.columns.length - 1].id).toBe('col_x');
  });

  it('does not mutate the original schema', () => {
    const schema = makeSchema();
    const original = schema.columns.length;
    addColumn(schema, makeColumn());
    expect(schema.columns.length).toBe(original);
  });
});

describe('removeColumn', () => {
  it('removes the column with the given ID', () => {
    const schema = makeSchema();
    const idToRemove = schema.columns[0].id;
    const updated = removeColumn(schema, idToRemove);
    expect(updated.columns.find((c) => c.id === idToRemove)).toBeUndefined();
  });

  it('does not mutate the original schema', () => {
    const schema = makeSchema();
    const original = schema.columns.length;
    removeColumn(schema, schema.columns[0].id);
    expect(schema.columns.length).toBe(original);
  });

  it('is a no-op when column ID does not exist', () => {
    const schema = makeSchema();
    const updated = removeColumn(schema, 'nonexistent');
    expect(updated.columns.length).toBe(schema.columns.length);
  });
});

describe('updateColumn', () => {
  it('updates only the targeted column', () => {
    const schema = makeSchema();
    const col = schema.columns[0];
    const updated = updateColumn(schema, col.id, { name: 'Renamed' });
    expect(updated.columns[0].name).toBe('Renamed');
    // Other columns unchanged
    expect(updated.columns.slice(1)).toEqual(schema.columns.slice(1));
  });

  it('does not mutate the original schema', () => {
    const schema = makeSchema();
    const originalName = schema.columns[0].name;
    updateColumn(schema, schema.columns[0].id, { name: 'Changed' });
    expect(schema.columns[0].name).toBe(originalName);
  });
});

// ---------------------------------------------------------------------------
// getColumn
// ---------------------------------------------------------------------------

describe('getColumn', () => {
  it('returns the column when found', () => {
    const schema = makeSchema();
    const col = schema.columns[0];
    expect(getColumn(schema, col.id)).toEqual(col);
  });

  it('returns undefined when not found', () => {
    const schema = makeSchema();
    expect(getColumn(schema, 'no-such-col')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getActiveView
// ---------------------------------------------------------------------------

describe('getActiveView', () => {
  it('returns the view pointed to by activeViewId', () => {
    const schema = makeSchema();
    const view = getActiveView(schema);
    expect(view?.id).toBe(schema.activeViewId);
  });

  it('falls back to the first view when activeViewId is missing', () => {
    const schema = { ...makeSchema(), activeViewId: undefined };
    const view = getActiveView(schema);
    expect(view?.id).toBe(schema.views[0].id);
  });

  it('falls back to the first view when activeViewId points to a non-existent view', () => {
    const schema = { ...makeSchema(), activeViewId: 'ghost_view' };
    const view = getActiveView(schema);
    expect(view?.id).toBe(schema.views[0].id);
  });

  it('returns undefined when there are no views', () => {
    const schema = { ...makeSchema(), views: [], activeViewId: undefined };
    expect(getActiveView(schema)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateCellValue
// ---------------------------------------------------------------------------

describe('validateCellValue', () => {
  const textCol = makeColumn({ type: 'text' });
  const numberCol = makeColumn({ type: 'number' });
  const checkboxCol = makeColumn({ type: 'checkbox' });
  const urlCol = makeColumn({ type: 'url' });
  const emailCol = makeColumn({ type: 'email' });
  const multiCol = makeColumn({ type: 'multi_select' });

  it('passes null values for any column type', () => {
    expect(validateCellValue(textCol, null)).toBe(true);
    expect(validateCellValue(numberCol, null)).toBe(true);
    expect(validateCellValue(checkboxCol, null)).toBe(true);
  });

  describe('number column', () => {
    it('accepts numeric values', () => {
      expect(validateCellValue(numberCol, 42)).toBe(true);
      expect(validateCellValue(numberCol, 3.14)).toBe(true);
    });
    it('accepts numeric strings', () => {
      expect(validateCellValue(numberCol, '100')).toBe(true);
    });
    it('rejects non-numeric strings', () => {
      const result = validateCellValue(numberCol, 'hello');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });
  });

  describe('checkbox column', () => {
    it('accepts boolean values', () => {
      expect(validateCellValue(checkboxCol, true)).toBe(true);
      expect(validateCellValue(checkboxCol, false)).toBe(true);
    });
    it('rejects non-boolean values', () => {
      expect(validateCellValue(checkboxCol, 'yes')).not.toBe(true);
      expect(validateCellValue(checkboxCol, 1)).not.toBe(true);
    });
  });

  describe('url column', () => {
    it('accepts valid URLs', () => {
      expect(validateCellValue(urlCol, 'https://example.com')).toBe(true);
      expect(validateCellValue(urlCol, 'http://localhost:3000/path')).toBe(true);
    });
    it('rejects invalid URLs', () => {
      expect(validateCellValue(urlCol, 'not-a-url')).not.toBe(true);
      expect(validateCellValue(urlCol, 'ftp')).not.toBe(true);
    });
  });

  describe('email column', () => {
    it('accepts valid emails', () => {
      expect(validateCellValue(emailCol, 'user@example.com')).toBe(true);
    });
    it('rejects invalid emails', () => {
      expect(validateCellValue(emailCol, 'not-an-email')).not.toBe(true);
      expect(validateCellValue(emailCol, '@no-user.com')).not.toBe(true);
    });
  });

  describe('multi_select column', () => {
    it('accepts arrays', () => {
      expect(validateCellValue(multiCol, ['a', 'b'])).toBe(true);
      expect(validateCellValue(multiCol, [])).toBe(true);
    });
    it('rejects non-arrays', () => {
      expect(validateCellValue(multiCol, 'single')).not.toBe(true);
    });
  });
});
