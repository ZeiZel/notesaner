'use client';

/**
 * FilterBar.tsx — Filter, sort, and group-by controls for a database view.
 *
 * Renders:
 * - "Filter" button → opens an inline panel to add/edit/remove filter rules
 * - "Sort" button → opens an inline panel to add/edit/remove sort rules
 * - "Group by" button → opens a column picker to choose the group dimension
 * - Active filter count badge
 * - Search input (row title search)
 *
 * All state changes are lifted out via callbacks; this component is purely
 * presentational with no internal async operations.
 */

import { useState } from 'react';
import type {
  ColumnDefinition,
  SortDefinition,
  FilterDefinition,
  GroupByDefinition,
  FilterOperator,
} from './database-schema';
import { FILTER_OPERATORS } from './database-schema';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  columns: ColumnDefinition[];
  sorts: SortDefinition[];
  filters: FilterDefinition[];
  groupBy: GroupByDefinition;
  searchQuery: string;

  onSortsChange: (sorts: SortDefinition[]) => void;
  onFiltersChange: (filters: FilterDefinition[]) => void;
  onGroupByChange: (groupBy: GroupByDefinition) => void;
  onSearchChange: (q: string) => void;

  onCsvExport: () => void;
  onCsvImport: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text: [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
  ],
  number: [
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'is_empty',
    'is_not_empty',
  ],
  date: ['before', 'after', 'on', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  checkbox: ['is_checked', 'is_unchecked'],
  url: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  email: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  relation: ['is_empty', 'is_not_empty'],
  formula: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'],
  file: ['is_empty', 'is_not_empty'],
};

function getOperatorsForColumn(column: ColumnDefinition | undefined): FilterOperator[] {
  return column ? (OPERATORS_BY_TYPE[column.type] ?? FILTER_OPERATORS.slice()) : [];
}

function operatorLabel(op: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: 'is',
    not_equals: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    starts_with: 'starts with',
    ends_with: 'ends with',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    greater_than: 'is greater than',
    less_than: 'is less than',
    greater_than_or_equal: 'is at least',
    less_than_or_equal: 'is at most',
    is_checked: 'is checked',
    is_unchecked: 'is unchecked',
    before: 'is before',
    after: 'is after',
    on: 'is on',
  };
  return labels[op] ?? op;
}

const NO_VALUE_OPERATORS: FilterOperator[] = [
  'is_empty',
  'is_not_empty',
  'is_checked',
  'is_unchecked',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortPanel({
  columns,
  sorts,
  onSortsChange,
}: {
  columns: ColumnDefinition[];
  sorts: SortDefinition[];
  onSortsChange: (s: SortDefinition[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {sorts.map((sort, i) => {
        return (
          <div key={sort.columnId} className="flex items-center gap-2">
            <select
              value={sort.columnId}
              onChange={(e) => {
                const next = [...sorts];
                next[i] = { ...sort, columnId: e.target.value };
                onSortsChange(next);
              }}
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={sort.direction}
              onChange={(e) => {
                const next = [...sorts];
                next[i] = { ...sort, direction: e.target.value as 'asc' | 'desc' };
                onSortsChange(next);
              }}
              className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>
            <button
              type="button"
              onClick={() => onSortsChange(sorts.filter((_, j) => j !== i))}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove sort"
            >
              ×
            </button>
          </div>
        );
      })}
      {columns.length > 0 && (
        <button
          type="button"
          onClick={() => onSortsChange([...sorts, { columnId: columns[0].id, direction: 'asc' }])}
          className="mt-1 text-left text-xs text-primary hover:underline"
        >
          + Add sort
        </button>
      )}
      {sorts.length === 0 && <p className="text-xs text-muted-foreground">No sorts applied</p>}
    </div>
  );
}

function FilterPanel({
  columns,
  filters,
  onFiltersChange,
}: {
  columns: ColumnDefinition[];
  filters: FilterDefinition[];
  onFiltersChange: (f: FilterDefinition[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {filters.map((filter, i) => {
        const col = columns.find((c) => c.id === filter.columnId);
        const operators = getOperatorsForColumn(col);
        const noValue = NO_VALUE_OPERATORS.includes(filter.operator);

        return (
          <div key={filter.id} className="flex items-start gap-2">
            {/* Column picker */}
            <select
              value={filter.columnId}
              onChange={(e) => {
                const next = [...filters];
                const newCol = columns.find((c) => c.id === e.target.value);
                const ops = getOperatorsForColumn(newCol);
                next[i] = {
                  ...filter,
                  columnId: e.target.value,
                  operator: ops[0] ?? 'contains',
                  value: undefined,
                };
                onFiltersChange(next);
              }}
              className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Operator picker */}
            <select
              value={filter.operator}
              onChange={(e) => {
                const next = [...filters];
                next[i] = { ...filter, operator: e.target.value as FilterOperator };
                onFiltersChange(next);
              }}
              className="w-32 rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {operatorLabel(op)}
                </option>
              ))}
            </select>

            {/* Value input */}
            {!noValue && (
              <input
                type={col?.type === 'number' ? 'number' : col?.type === 'date' ? 'date' : 'text'}
                value={
                  filter.value === null || filter.value === undefined ? '' : String(filter.value)
                }
                onChange={(e) => {
                  const next = [...filters];
                  const raw = e.target.value;
                  next[i] = {
                    ...filter,
                    value: raw === '' ? null : col?.type === 'number' ? parseFloat(raw) : raw,
                  };
                  onFiltersChange(next);
                }}
                placeholder="Value"
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              />
            )}

            <button
              type="button"
              onClick={() => onFiltersChange(filters.filter((_, j) => j !== i))}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove filter"
            >
              ×
            </button>
          </div>
        );
      })}

      {columns.length > 0 && (
        <button
          type="button"
          onClick={() =>
            onFiltersChange([
              ...filters,
              {
                id: generateId(),
                columnId: columns[0].id,
                operator: getOperatorsForColumn(columns[0])[0] ?? 'contains',
                value: null,
              },
            ])
          }
          className="mt-1 text-left text-xs text-primary hover:underline"
        >
          + Add filter
        </button>
      )}

      {filters.length === 0 && <p className="text-xs text-muted-foreground">No filters applied</p>}
    </div>
  );
}

function GroupByPanel({
  columns,
  groupBy,
  onGroupByChange,
}: {
  columns: ColumnDefinition[];
  groupBy: GroupByDefinition;
  onGroupByChange: (g: GroupByDefinition) => void;
}) {
  const groupableColumns = columns.filter((c) =>
    ['select', 'multi_select', 'checkbox', 'date'].includes(c.type),
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <select
          value={groupBy?.columnId ?? ''}
          onChange={(e) => {
            if (!e.target.value) {
              onGroupByChange(null);
            } else {
              onGroupByChange({
                columnId: e.target.value,
                hideEmptyGroups: false,
              });
            }
          }}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">No grouping</option>
          {groupableColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {groupBy && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={groupBy.hideEmptyGroups ?? false}
            onChange={(e) => onGroupByChange({ ...groupBy, hideEmptyGroups: e.target.checked })}
            className="rounded"
          />
          Hide empty groups
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FilterBar
// ---------------------------------------------------------------------------

export function FilterBar({
  columns,
  sorts,
  filters,
  groupBy,
  searchQuery,
  onSortsChange,
  onFiltersChange,
  onGroupByChange,
  onSearchChange,
  onCsvExport,
  onCsvImport,
}: FilterBarProps) {
  const [openPanel, setOpenPanel] = useState<'sort' | 'filter' | 'groupby' | null>(null);

  const togglePanel = (panel: typeof openPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const activeFilters = filters.length;
  const activeSorts = sorts.length;
  const hasGroupBy = Boolean(groupBy);

  return (
    <div className="relative flex flex-col">
      {/* Toolbar row */}
      <div className="flex items-center gap-2 border-b border-border bg-background/80 px-3 py-1.5 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search rows..."
            className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Filter button */}
        <button
          type="button"
          onClick={() => togglePanel('filter')}
          className={[
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
            openPanel === 'filter' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          ].join(' ')}
          aria-expanded={openPanel === 'filter'}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 6h18M7 12h10M10 18h4" />
          </svg>
          Filter
          {activeFilters > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary">
              {activeFilters}
            </span>
          )}
        </button>

        {/* Sort button */}
        <button
          type="button"
          onClick={() => togglePanel('sort')}
          className={[
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
            openPanel === 'sort' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          ].join(' ')}
          aria-expanded={openPanel === 'sort'}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 6l6-4 6 4M9 6v12M15 22l6-4-6-4M21 18V6" />
          </svg>
          Sort
          {activeSorts > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary">
              {activeSorts}
            </span>
          )}
        </button>

        {/* Group by button */}
        <button
          type="button"
          onClick={() => togglePanel('groupby')}
          className={[
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
            openPanel === 'groupby' || hasGroupBy
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent',
          ].join(' ')}
          aria-expanded={openPanel === 'groupby'}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="2" y="3" width="6" height="18" rx="1" />
            <rect x="10" y="3" width="6" height="11" rx="1" />
            <rect x="18" y="3" width="4" height="7" rx="1" />
          </svg>
          Group
          {hasGroupBy && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary">
              1
            </span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* CSV import */}
          <button
            type="button"
            onClick={onCsvImport}
            title="Import CSV"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </button>

          {/* CSV export */}
          <button
            type="button"
            onClick={onCsvExport}
            title="Export CSV"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Dropdown panels */}
      {openPanel === 'filter' && (
        <div className="absolute top-full z-20 mt-1 min-w-96 rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">Filters</span>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
          <FilterPanel columns={columns} filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      )}

      {openPanel === 'sort' && (
        <div className="absolute top-full z-20 mt-1 min-w-72 rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">Sort</span>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
          <SortPanel columns={columns} sorts={sorts} onSortsChange={onSortsChange} />
        </div>
      )}

      {openPanel === 'groupby' && (
        <div className="absolute top-full z-20 mt-1 min-w-56 rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">Group by</span>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
          <GroupByPanel columns={columns} groupBy={groupBy} onGroupByChange={onGroupByChange} />
        </div>
      )}
    </div>
  );
}
