/**
 * database-schema.ts — Column type definitions and schema management.
 *
 * A DatabaseSchema describes the shape of a database: which columns it has,
 * their types, and any per-type options (e.g. select options, formula expression).
 *
 * Schema instances are serialised to/from note frontmatter under the key
 * `database_schema` so the MD file remains the source of truth.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Column type enum
// ---------------------------------------------------------------------------

export const COLUMN_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'relation',
  'formula',
  'checkbox',
  'url',
  'email',
  'file',
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

// ---------------------------------------------------------------------------
// Select / multi-select option
// ---------------------------------------------------------------------------

export const selectOptionSchema = z.object({
  /** Stable slug — never changes even if the label is renamed */
  id: z.string().min(1),
  /** Human-readable label */
  label: z.string().min(1),
  /** Tailwind background colour token or hex string */
  color: z.string().optional(),
});

export type SelectOption = z.infer<typeof selectOptionSchema>;

// ---------------------------------------------------------------------------
// Per-type column options
// ---------------------------------------------------------------------------

export const textColumnOptionsSchema = z.object({}).optional();

export const numberColumnOptionsSchema = z
  .object({
    format: z.enum(['integer', 'decimal', 'percent', 'currency']).optional(),
    /** ISO 4217 code, e.g. "USD" */
    currencyCode: z.string().length(3).optional(),
    decimalPlaces: z.number().int().min(0).max(10).optional(),
  })
  .optional();

export const dateColumnOptionsSchema = z
  .object({
    includeTime: z.boolean().optional(),
    /** Unicode date-time format pattern, e.g. "yyyy-MM-dd" */
    format: z.string().optional(),
  })
  .optional();

export const selectColumnOptionsSchema = z
  .object({
    options: z.array(selectOptionSchema),
  })
  .optional();

export const multiSelectColumnOptionsSchema = z
  .object({
    options: z.array(selectOptionSchema),
  })
  .optional();

export const relationColumnOptionsSchema = z
  .object({
    /** Target database note ID */
    targetDatabaseId: z.string().optional(),
    /** Whether the relation is bidirectional */
    bidirectional: z.boolean().optional(),
    /** Property name on the target side when bidirectional */
    reversePropertyName: z.string().optional(),
  })
  .optional();

export const formulaColumnOptionsSchema = z
  .object({
    /** Raw formula expression string, e.g. "price * quantity" */
    expression: z.string(),
  })
  .optional();

export const checkboxColumnOptionsSchema = z.object({}).optional();

export const urlColumnOptionsSchema = z.object({}).optional();
export const emailColumnOptionsSchema = z.object({}).optional();

export const fileColumnOptionsSchema = z
  .object({
    /** Allow multiple attachments */
    multiple: z.boolean().optional(),
    /** Accepted MIME types, e.g. ["image/*", "application/pdf"] */
    accept: z.array(z.string()).optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export const columnDefinitionSchema = z.object({
  /** Stable column ID — never changes even if column is renamed */
  id: z.string().min(1),
  /** Human-readable column name */
  name: z.string().min(1),
  /** Data type of this column */
  type: z.enum(COLUMN_TYPES),
  /** Width in pixels for table/list view */
  width: z.number().int().min(40).max(1200).optional(),
  /** Whether the column is hidden in the current view */
  hidden: z.boolean().optional(),
  /** Optional description shown in column header tooltip */
  description: z.string().optional(),
  /** Per-type configuration */
  options: z
    .union([
      textColumnOptionsSchema,
      numberColumnOptionsSchema,
      dateColumnOptionsSchema,
      selectColumnOptionsSchema,
      multiSelectColumnOptionsSchema,
      relationColumnOptionsSchema,
      formulaColumnOptionsSchema,
      checkboxColumnOptionsSchema,
      urlColumnOptionsSchema,
      emailColumnOptionsSchema,
      fileColumnOptionsSchema,
    ])
    .optional(),
});

export type ColumnDefinition = z.infer<typeof columnDefinitionSchema>;

// ---------------------------------------------------------------------------
// Sort definition
// ---------------------------------------------------------------------------

export const sortDefinitionSchema = z.object({
  columnId: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

export type SortDefinition = z.infer<typeof sortDefinitionSchema>;

// ---------------------------------------------------------------------------
// Filter definition
// ---------------------------------------------------------------------------

export const FILTER_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'is_checked',
  'is_unchecked',
  'before',
  'after',
  'on',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const filterDefinitionSchema = z.object({
  id: z.string().min(1),
  columnId: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  /** Scalar or array value depending on operator */
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
});

export type FilterDefinition = z.infer<typeof filterDefinitionSchema>;

// ---------------------------------------------------------------------------
// Group-by definition
// ---------------------------------------------------------------------------

export const groupByDefinitionSchema = z
  .object({
    columnId: z.string().min(1),
    /** Whether groups with no rows are hidden */
    hideEmptyGroups: z.boolean().optional(),
    /** Manual order of group values */
    order: z.array(z.string()).optional(),
  })
  .nullable();

export type GroupByDefinition = z.infer<typeof groupByDefinitionSchema>;

// ---------------------------------------------------------------------------
// View type
// ---------------------------------------------------------------------------

export const VIEW_TYPES = ['table', 'board', 'gallery', 'list'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

// ---------------------------------------------------------------------------
// View definition (persisted per-view configuration)
// ---------------------------------------------------------------------------

export const viewDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(VIEW_TYPES),
  sorts: z.array(sortDefinitionSchema).optional(),
  filters: z.array(filterDefinitionSchema).optional(),
  groupBy: groupByDefinitionSchema.optional(),
  /** Column ID used for the board's card title (board view only) */
  boardGroupColumnId: z.string().optional(),
  /** Column IDs to show in gallery card preview (gallery view only) */
  galleryPreviewColumns: z.array(z.string()).optional(),
  /** Column ordering for this specific view */
  columnOrder: z.array(z.string()).optional(),
  /** Per-column width overrides for this view */
  columnWidths: z.record(z.string(), z.number()).optional(),
});

export type ViewDefinition = z.infer<typeof viewDefinitionSchema>;

// ---------------------------------------------------------------------------
// Database schema — top-level structure stored in frontmatter
// ---------------------------------------------------------------------------

export const databaseSchemaDefinitionSchema = z.object({
  version: z.literal(1),
  /** Stable database ID */
  id: z.string().min(1),
  /** Ordered list of column definitions */
  columns: z.array(columnDefinitionSchema),
  /** Named views */
  views: z.array(viewDefinitionSchema),
  /** ID of the active view */
  activeViewId: z.string().optional(),
});

export type DatabaseSchemaDefinition = z.infer<typeof databaseSchemaDefinitionSchema>;

// ---------------------------------------------------------------------------
// Row value — maps column IDs to raw cell values
// ---------------------------------------------------------------------------

export type CellValue = string | number | boolean | string[] | null | undefined;

export type RowValues = Record<string, CellValue>;

// ---------------------------------------------------------------------------
// Full database row (note row = one note in the workspace)
// ---------------------------------------------------------------------------

export interface DatabaseRow {
  /** Note ID */
  id: string;
  /** Note title — the primary "title" column */
  title: string;
  /** Column values keyed by column ID */
  values: RowValues;
  /** Note path on filesystem */
  path: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Schema management helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw (JSON-parsed) database schema from frontmatter.
 * Throws `ZodError` if invalid.
 */
export function parseDatabaseSchema(raw: unknown): DatabaseSchemaDefinition {
  return databaseSchemaDefinitionSchema.parse(raw);
}

/**
 * Create a fresh default schema with a single table view.
 */
export function createDefaultSchema(id: string): DatabaseSchemaDefinition {
  return {
    version: 1,
    id,
    columns: [
      {
        id: 'col_status',
        name: 'Status',
        type: 'select',
        width: 120,
        options: {
          options: [
            { id: 'opt_todo', label: 'To Do', color: '#94a3b8' },
            { id: 'opt_inprogress', label: 'In Progress', color: '#3b82f6' },
            { id: 'opt_done', label: 'Done', color: '#22c55e' },
          ],
        },
      },
      {
        id: 'col_priority',
        name: 'Priority',
        type: 'select',
        width: 100,
        options: {
          options: [
            { id: 'opt_low', label: 'Low', color: '#6b7280' },
            { id: 'opt_medium', label: 'Medium', color: '#f59e0b' },
            { id: 'opt_high', label: 'High', color: '#ef4444' },
          ],
        },
      },
      {
        id: 'col_due_date',
        name: 'Due Date',
        type: 'date',
        width: 130,
        options: { includeTime: false, format: 'yyyy-MM-dd' },
      },
      {
        id: 'col_tags',
        name: 'Tags',
        type: 'multi_select',
        width: 180,
        options: { options: [] },
      },
    ],
    views: [
      {
        id: 'view_default_table',
        name: 'Table',
        type: 'table',
        sorts: [],
        filters: [],
        groupBy: null,
      },
    ],
    activeViewId: 'view_default_table',
  };
}

/**
 * Add a new column to a schema, returning a new schema object (immutable).
 */
export function addColumn(
  schema: DatabaseSchemaDefinition,
  column: ColumnDefinition,
): DatabaseSchemaDefinition {
  return { ...schema, columns: [...schema.columns, column] };
}

/**
 * Remove a column from a schema by ID (immutable).
 */
export function removeColumn(
  schema: DatabaseSchemaDefinition,
  columnId: string,
): DatabaseSchemaDefinition {
  return {
    ...schema,
    columns: schema.columns.filter((c) => c.id !== columnId),
  };
}

/**
 * Update a column definition (immutable).
 */
export function updateColumn(
  schema: DatabaseSchemaDefinition,
  columnId: string,
  updates: Partial<ColumnDefinition>,
): DatabaseSchemaDefinition {
  return {
    ...schema,
    columns: schema.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
  };
}

/**
 * Returns the column definition for a given ID, or undefined.
 */
export function getColumn(
  schema: DatabaseSchemaDefinition,
  columnId: string,
): ColumnDefinition | undefined {
  return schema.columns.find((c) => c.id === columnId);
}

/**
 * Returns the active view definition, falling back to the first view.
 */
export function getActiveView(schema: DatabaseSchemaDefinition): ViewDefinition | undefined {
  if (schema.activeViewId) {
    const found = schema.views.find((v) => v.id === schema.activeViewId);
    if (found) return found;
  }
  return schema.views[0];
}

/**
 * Validate a cell value against a column's type constraints.
 * Returns `true` when valid, or an error message string when invalid.
 */
export function validateCellValue(column: ColumnDefinition, value: CellValue): true | string {
  if (value === null || value === undefined) return true;

  switch (column.type) {
    case 'number': {
      if (typeof value !== 'number' && typeof value !== 'string') {
        return `Column "${column.name}" expects a number`;
      }
      const n = Number(value);
      if (Number.isNaN(n)) return `Column "${column.name}" expects a number`;
      return true;
    }
    case 'checkbox': {
      if (typeof value !== 'boolean') {
        return `Column "${column.name}" expects a boolean`;
      }
      return true;
    }
    case 'url': {
      if (typeof value !== 'string') return `Column "${column.name}" expects a URL string`;
      try {
        new URL(value);
        return true;
      } catch {
        return `Column "${column.name}" contains an invalid URL`;
      }
    }
    case 'email': {
      if (typeof value !== 'string') return `Column "${column.name}" expects an email string`;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return `Column "${column.name}" contains an invalid email`;
      return true;
    }
    case 'multi_select': {
      if (!Array.isArray(value)) return `Column "${column.name}" expects an array`;
      return true;
    }
    default:
      return true;
  }
}
