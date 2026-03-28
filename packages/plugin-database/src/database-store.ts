/**
 * database-store.ts — Zustand store for database view state.
 *
 * Manages:
 * - Active view selection
 * - Sort, filter, group-by state per view
 * - Row selection for bulk operations
 * - Pending cell edits (optimistic)
 * - Column resize state
 * - Loading / error state
 *
 * This store is intentionally UI-only. Persistence is handled by the
 * plugin's notes API (frontmatter) and the parent app's API layer.
 */

import { create } from 'zustand';
import type {
  DatabaseSchemaDefinition,
  DatabaseRow,
  ViewDefinition,
  SortDefinition,
  FilterDefinition,
  GroupByDefinition,
  ColumnDefinition,
  CellValue,
} from './database-schema';
import { addColumn, removeColumn, updateColumn, getActiveView } from './database-schema';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface DatabaseState {
  // ---- Data ----------------------------------------------------------------
  schema: DatabaseSchemaDefinition | null;
  rows: DatabaseRow[];
  isLoading: boolean;
  error: string | null;

  // ---- View selection ------------------------------------------------------
  activeViewId: string | null;

  // ---- Pending edits -------------------------------------------------------
  /** Map of rowId -> columnId -> pending value (optimistic before server ack) */
  pendingEdits: Record<string, Record<string, CellValue>>;

  // ---- Row selection -------------------------------------------------------
  selectedRowIds: Set<string>;

  // ---- Column resize -------------------------------------------------------
  /** Map of columnId -> width in pixels (overrides schema.columns[].width) */
  columnWidthOverrides: Record<string, number>;

  // ---- Editing state -------------------------------------------------------
  editingCell: { rowId: string; columnId: string } | null;

  // ---- Search (row title filter) -------------------------------------------
  searchQuery: string;
}

// ---------------------------------------------------------------------------
// Action signatures
// ---------------------------------------------------------------------------

export interface DatabaseActions {
  // ---- Lifecycle -----------------------------------------------------------
  initialize(schema: DatabaseSchemaDefinition, rows: DatabaseRow[]): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
  reset(): void;

  // ---- View ----------------------------------------------------------------
  setActiveView(viewId: string): void;
  addView(view: ViewDefinition): void;
  updateView(viewId: string, updates: Partial<ViewDefinition>): void;
  removeView(viewId: string): void;

  // ---- Sort / filter / group-by -------------------------------------------
  setSorts(viewId: string, sorts: SortDefinition[]): void;
  addSort(viewId: string, sort: SortDefinition): void;
  removeSort(viewId: string, columnId: string): void;

  setFilters(viewId: string, filters: FilterDefinition[]): void;
  addFilter(viewId: string, filter: FilterDefinition): void;
  removeFilter(viewId: string, filterId: string): void;
  updateFilter(viewId: string, filterId: string, updates: Partial<FilterDefinition>): void;

  setGroupBy(viewId: string, groupBy: GroupByDefinition): void;

  // ---- Column management ---------------------------------------------------
  addColumn(column: ColumnDefinition): void;
  removeColumn(columnId: string): void;
  updateColumn(columnId: string, updates: Partial<ColumnDefinition>): void;
  resizeColumn(columnId: string, width: number): void;

  // ---- Row management ------------------------------------------------------
  setRows(rows: DatabaseRow[]): void;
  addRow(row: DatabaseRow): void;
  updateRowValues(rowId: string, values: Partial<DatabaseRow['values']>): void;
  removeRow(rowId: string): void;

  // ---- Cell editing --------------------------------------------------------
  startEdit(rowId: string, columnId: string): void;
  commitEdit(rowId: string, columnId: string, value: CellValue): void;
  cancelEdit(): void;

  // ---- Row selection -------------------------------------------------------
  selectRow(rowId: string): void;
  deselectRow(rowId: string): void;
  toggleRowSelection(rowId: string): void;
  selectAllRows(): void;
  clearSelection(): void;

  // ---- Search --------------------------------------------------------------
  setSearchQuery(query: string): void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: DatabaseState = {
  schema: null,
  rows: [],
  isLoading: false,
  error: null,
  activeViewId: null,
  pendingEdits: {},
  selectedRowIds: new Set(),
  columnWidthOverrides: {},
  editingCell: null,
  searchQuery: '',
};

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

/**
 * Create an isolated database store instance.
 * Each database view should create its own store instance so they don't
 * interfere when multiple databases are open simultaneously.
 */
export function createDatabaseStore() {
  return create<DatabaseState & DatabaseActions>()((set, get) => ({
    ...initialState,

    // ---- Lifecycle ---------------------------------------------------------

    initialize(schema, rows) {
      set({
        schema,
        rows,
        activeViewId: schema.activeViewId ?? schema.views[0]?.id ?? null,
        isLoading: false,
        error: null,
        pendingEdits: {},
        selectedRowIds: new Set(),
        columnWidthOverrides: {},
        editingCell: null,
        searchQuery: '',
      });
    },

    setLoading(loading) {
      set({ isLoading: loading });
    },

    setError(error) {
      set({ error });
    },

    reset() {
      set(initialState);
    },

    // ---- View --------------------------------------------------------------

    setActiveView(viewId) {
      const { schema } = get();
      if (!schema) return;
      if (!schema.views.find((v) => v.id === viewId)) return;
      set({
        activeViewId: viewId,
        schema: { ...schema, activeViewId: viewId },
      });
    },

    addView(view) {
      const { schema } = get();
      if (!schema) return;
      set({ schema: { ...schema, views: [...schema.views, view] } });
    },

    updateView(viewId, updates) {
      const { schema } = get();
      if (!schema) return;
      set({
        schema: {
          ...schema,
          views: schema.views.map((v) => (v.id === viewId ? { ...v, ...updates } : v)),
        },
      });
    },

    removeView(viewId) {
      const { schema, activeViewId } = get();
      if (!schema) return;
      const remaining = schema.views.filter((v) => v.id !== viewId);
      const newActiveId = activeViewId === viewId ? (remaining[0]?.id ?? null) : activeViewId;
      set({
        schema: { ...schema, views: remaining, activeViewId: newActiveId ?? undefined },
        activeViewId: newActiveId,
      });
    },

    // ---- Sort / filter / group-by ------------------------------------------

    setSorts(viewId, sorts) {
      get().updateView(viewId, { sorts });
    },

    addSort(viewId, sort) {
      const { schema } = get();
      if (!schema) return;
      const view = schema.views.find((v) => v.id === viewId);
      if (!view) return;
      const existing = view.sorts ?? [];
      // Replace if column already has a sort, otherwise append
      const updated = existing.find((s) => s.columnId === sort.columnId)
        ? existing.map((s) => (s.columnId === sort.columnId ? sort : s))
        : [...existing, sort];
      get().updateView(viewId, { sorts: updated });
    },

    removeSort(viewId, columnId) {
      const { schema } = get();
      if (!schema) return;
      const view = schema.views.find((v) => v.id === viewId);
      if (!view) return;
      get().updateView(viewId, {
        sorts: (view.sorts ?? []).filter((s) => s.columnId !== columnId),
      });
    },

    setFilters(viewId, filters) {
      get().updateView(viewId, { filters });
    },

    addFilter(viewId, filter) {
      const { schema } = get();
      if (!schema) return;
      const view = schema.views.find((v) => v.id === viewId);
      if (!view) return;
      get().updateView(viewId, { filters: [...(view.filters ?? []), filter] });
    },

    removeFilter(viewId, filterId) {
      const { schema } = get();
      if (!schema) return;
      const view = schema.views.find((v) => v.id === viewId);
      if (!view) return;
      get().updateView(viewId, {
        filters: (view.filters ?? []).filter((f) => f.id !== filterId),
      });
    },

    updateFilter(viewId, filterId, updates) {
      const { schema } = get();
      if (!schema) return;
      const view = schema.views.find((v) => v.id === viewId);
      if (!view) return;
      get().updateView(viewId, {
        filters: (view.filters ?? []).map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
      });
    },

    setGroupBy(viewId, groupBy) {
      get().updateView(viewId, { groupBy });
    },

    // ---- Column management -------------------------------------------------

    addColumn(column) {
      const { schema } = get();
      if (!schema) return;
      set({ schema: addColumn(schema, column) });
    },

    removeColumn(columnId) {
      const { schema } = get();
      if (!schema) return;
      set({ schema: removeColumn(schema, columnId) });
    },

    updateColumn(columnId, updates) {
      const { schema } = get();
      if (!schema) return;
      set({ schema: updateColumn(schema, columnId, updates) });
    },

    resizeColumn(columnId, width) {
      set((state) => ({
        columnWidthOverrides: { ...state.columnWidthOverrides, [columnId]: width },
      }));
    },

    // ---- Row management ----------------------------------------------------

    setRows(rows) {
      set({ rows });
    },

    addRow(row) {
      set((state) => ({ rows: [...state.rows, row] }));
    },

    updateRowValues(rowId, values) {
      set((state) => ({
        rows: state.rows.map((r) =>
          r.id === rowId ? { ...r, values: { ...r.values, ...values } } : r,
        ),
      }));
    },

    removeRow(rowId) {
      set((state) => ({
        rows: state.rows.filter((r) => r.id !== rowId),
        selectedRowIds: new Set([...state.selectedRowIds].filter((id) => id !== rowId)),
      }));
    },

    // ---- Cell editing ------------------------------------------------------

    startEdit(rowId, columnId) {
      set({ editingCell: { rowId, columnId } });
    },

    commitEdit(rowId, columnId, value) {
      set((state) => ({
        editingCell: null,
        pendingEdits: {
          ...state.pendingEdits,
          [rowId]: { ...(state.pendingEdits[rowId] ?? {}), [columnId]: value },
        },
        rows: state.rows.map((r) =>
          r.id === rowId ? { ...r, values: { ...r.values, [columnId]: value } } : r,
        ),
      }));
    },

    cancelEdit() {
      set({ editingCell: null });
    },

    // ---- Row selection -----------------------------------------------------

    selectRow(rowId) {
      set((state) => ({
        selectedRowIds: new Set([...state.selectedRowIds, rowId]),
      }));
    },

    deselectRow(rowId) {
      set((state) => {
        const next = new Set(state.selectedRowIds);
        next.delete(rowId);
        return { selectedRowIds: next };
      });
    },

    toggleRowSelection(rowId) {
      const { selectedRowIds } = get();
      if (selectedRowIds.has(rowId)) {
        get().deselectRow(rowId);
      } else {
        get().selectRow(rowId);
      }
    },

    selectAllRows() {
      set((state) => ({
        selectedRowIds: new Set(state.rows.map((r) => r.id)),
      }));
    },

    clearSelection() {
      set({ selectedRowIds: new Set() });
    },

    // ---- Search ------------------------------------------------------------

    setSearchQuery(query) {
      set({ searchQuery: query });
    },
  }));
}

// ---------------------------------------------------------------------------
// Selector helpers (pure functions — no store coupling)
// ---------------------------------------------------------------------------

/**
 * Apply sorts, filters, group-by, and search to an array of rows.
 * Returns a new sorted/filtered array (does not mutate input).
 */
export function applyViewToRows(
  rows: DatabaseRow[],
  schema: DatabaseSchemaDefinition,
  view: ViewDefinition,
  searchQuery = '',
): DatabaseRow[] {
  let result = [...rows];

  // Search filter (always applied to title)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((r) => r.title.toLowerCase().includes(q));
  }

  // Column filters
  const filters = view.filters ?? [];
  for (const filter of filters) {
    result = result.filter((row) => matchesFilter(row, filter));
  }

  // Sort
  const sorts = view.sorts ?? [];
  if (sorts.length > 0) {
    result.sort((a, b) => compareRows(a, b, sorts, schema));
  }

  return result;
}

/** Returns true when a row matches a single filter. */
function matchesFilter(row: DatabaseRow, filter: FilterDefinition): boolean {
  const rawValue: CellValue = row.values[filter.columnId];

  switch (filter.operator) {
    case 'is_empty':
      return rawValue === null || rawValue === undefined || rawValue === '';
    case 'is_not_empty':
      return rawValue !== null && rawValue !== undefined && rawValue !== '';
    case 'is_checked':
      return rawValue === true;
    case 'is_unchecked':
      return rawValue !== true;
    case 'equals':
      return String(rawValue ?? '') === String(filter.value ?? '');
    case 'not_equals':
      return String(rawValue ?? '') !== String(filter.value ?? '');
    case 'contains':
      return String(rawValue ?? '')
        .toLowerCase()
        .includes(String(filter.value ?? '').toLowerCase());
    case 'not_contains':
      return !String(rawValue ?? '')
        .toLowerCase()
        .includes(String(filter.value ?? '').toLowerCase());
    case 'starts_with':
      return String(rawValue ?? '')
        .toLowerCase()
        .startsWith(String(filter.value ?? '').toLowerCase());
    case 'ends_with':
      return String(rawValue ?? '')
        .toLowerCase()
        .endsWith(String(filter.value ?? '').toLowerCase());
    case 'greater_than':
      return Number(rawValue) > Number(filter.value);
    case 'less_than':
      return Number(rawValue) < Number(filter.value);
    case 'greater_than_or_equal':
      return Number(rawValue) >= Number(filter.value);
    case 'less_than_or_equal':
      return Number(rawValue) <= Number(filter.value);
    case 'before':
      return new Date(String(rawValue)) < new Date(String(filter.value));
    case 'after':
      return new Date(String(rawValue)) > new Date(String(filter.value));
    case 'on':
      return (
        new Date(String(rawValue)).toDateString() === new Date(String(filter.value)).toDateString()
      );
    default:
      return true;
  }
}

/** Compare two rows for sorting by a list of sort definitions. */
function compareRows(
  a: DatabaseRow,
  b: DatabaseRow,
  sorts: SortDefinition[],
  schema: DatabaseSchemaDefinition,
): number {
  for (const sort of sorts) {
    const colDef = schema.columns.find((c) => c.id === sort.columnId);
    const aVal = a.values[sort.columnId];
    const bVal = b.values[sort.columnId];

    let cmp = 0;
    if (aVal === null || aVal === undefined) {
      cmp = bVal === null || bVal === undefined ? 0 : 1;
    } else if (bVal === null || bVal === undefined) {
      cmp = -1;
    } else if (colDef?.type === 'number') {
      cmp = Number(aVal) - Number(bVal);
    } else if (colDef?.type === 'date') {
      cmp = new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime();
    } else if (colDef?.type === 'checkbox') {
      cmp = (aVal ? 1 : 0) - (bVal ? 1 : 0);
    } else {
      cmp = String(aVal).localeCompare(String(bVal));
    }

    if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
  }
  return 0;
}

/**
 * Group rows by a GroupByDefinition.
 * Returns an ordered Map of group label -> rows.
 */
export function groupRows(
  rows: DatabaseRow[],
  schema: DatabaseSchemaDefinition,
  groupBy: GroupByDefinition,
): Map<string, DatabaseRow[]> {
  if (!groupBy) return new Map([['All', rows]]);

  const col = schema.columns.find((c) => c.id === groupBy.columnId);
  const groups = new Map<string, DatabaseRow[]>();

  for (const row of rows) {
    const rawValue: CellValue = row.values[groupBy.columnId];

    const keys = getGroupKeys(rawValue, col);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(row);
    }
  }

  // Apply manual order if defined
  if (groupBy.order && groupBy.order.length > 0) {
    const ordered = new Map<string, DatabaseRow[]>();
    for (const key of groupBy.order) {
      if (groups.has(key)) {
        const g = groups.get(key);
        if (g) ordered.set(key, g);
      }
    }
    // Append any groups not in the manual order
    for (const [key, group] of groups) {
      if (!ordered.has(key)) ordered.set(key, group);
    }
    // Remove empty groups if configured
    if (groupBy.hideEmptyGroups) {
      for (const [key, group] of ordered) {
        if (group.length === 0) ordered.delete(key);
      }
    }
    return ordered;
  }

  // Remove empty groups if configured
  if (groupBy.hideEmptyGroups) {
    for (const [key, group] of groups) {
      if (group.length === 0) groups.delete(key);
    }
  }

  return groups;
}

/** Extract group key(s) from a cell value. Multi-select has multiple keys. */
function getGroupKeys(value: CellValue, col: ColumnDefinition | undefined): string[] {
  if (value === null || value === undefined || value === '') return ['(Empty)'];
  if (Array.isArray(value)) return value.length > 0 ? value.map(String) : ['(Empty)'];
  if (typeof value === 'boolean') return [value ? 'Checked' : 'Unchecked'];
  if (col?.type === 'date') {
    // Group by date (strip time)
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? [String(value)] : [d.toISOString().split('T')[0]];
  }
  return [String(value)];
}

/**
 * Get the active view definition from the store state.
 * Returns null when schema is not initialised.
 */
export function selectActiveView(state: DatabaseState): ViewDefinition | null {
  if (!state.schema) return null;
  if (state.activeViewId) {
    const found = state.schema.views.find((v) => v.id === state.activeViewId);
    if (found) return found;
  }
  return getActiveView(state.schema) ?? null;
}
