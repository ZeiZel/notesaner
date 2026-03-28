'use client';

/**
 * ListView.tsx — Compact list view for database rows.
 *
 * Each row shows the title and one or two summary properties inline,
 * making it a good choice for long lists where a full table is too wide.
 * Supports grouping, search, and add-row.
 */

import type {
  DatabaseRow,
  DatabaseSchemaDefinition,
  ViewDefinition,
  CellValue,
  GroupByDefinition,
} from './database-schema';
import { CellRenderer } from './CellRenderer';
import { applyViewToRows, groupRows } from './database-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ListViewProps {
  schema: DatabaseSchemaDefinition;
  view: ViewDefinition;
  rows: DatabaseRow[];
  searchQuery: string;
  selectedRowIds: Set<string>;
  editingCell: { rowId: string; columnId: string } | null;

  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onRowSelect: (rowId: string, multi: boolean) => void;
  onAddRow: () => void;
}

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

interface ListItemProps {
  row: DatabaseRow;
  schema: DatabaseSchemaDefinition;
  summaryColumnIds: string[];
  isSelected: boolean;
  editingCell: { rowId: string; columnId: string } | null;
  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onRowSelect: (multi: boolean) => void;
}

function ListItem({
  row,
  schema,
  summaryColumnIds,
  isSelected,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onRowSelect,
}: ListItemProps) {
  const summaryColumns = summaryColumnIds
    .map((id) => schema.columns.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 4);

  return (
    <div
      className={[
        'group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50',
        isSelected ? 'bg-primary/5' : '',
      ].join(' ')}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onRowSelect(e.shiftKey)}
        className="h-3.5 w-3.5 shrink-0 rounded border-border opacity-0 group-hover:opacity-100 data-[selected=true]:opacity-100"
        data-selected={isSelected}
        aria-label={`Select "${row.title}"`}
      />

      {/* Document icon */}
      <svg
        className="h-4 w-4 shrink-0 text-muted-foreground/60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>

      {/* Title */}
      <button
        type="button"
        onClick={() => onRowClick(row.id)}
        className="flex-1 truncate text-left text-sm font-medium text-foreground hover:underline"
        title={row.title}
      >
        {row.title || <span className="text-muted-foreground/50">Untitled</span>}
      </button>

      {/* Summary properties */}
      <div className="flex shrink-0 items-center gap-3">
        {summaryColumns.map((col) => (
          <div key={col.id} className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{col.name}:</span>
            <CellRenderer
              column={col}
              value={row.values[col.id]}
              isEditing={editingCell?.rowId === row.id && editingCell?.columnId === col.id}
              onStartEdit={() => onCellEditStart(row.id, col.id)}
              onCommit={(v) => onCellCommit(row.id, col.id, v)}
              onCancel={onCellEditCancel}
              className="min-h-0 min-w-[60px] px-0 text-[11px]"
            />
          </div>
        ))}
      </div>

      {/* Open button */}
      <button
        type="button"
        onClick={() => onRowClick(row.id)}
        className="ml-1 shrink-0 opacity-0 group-hover:opacity-100 hover:text-primary"
        title="Open note"
        aria-label="Open note"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListView
// ---------------------------------------------------------------------------

export function ListView({
  schema,
  view,
  rows,
  searchQuery,
  selectedRowIds,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onRowSelect,
  onAddRow,
}: ListViewProps) {
  // Show up to 3 summary columns (non-hidden, non-formula)
  const summaryColumnIds = schema.columns
    .filter((c) => !c.hidden && c.type !== 'formula')
    .slice(0, 3)
    .map((c) => c.id);

  const processedRows = applyViewToRows(rows, schema, view, searchQuery);
  const groupByDef: GroupByDefinition = view.groupBy ?? null;
  const grouped = groupRows(processedRows, schema, groupByDef);
  const isGrouped = grouped.size > 1 || (grouped.size === 1 && !grouped.has('All'));

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex-1 px-2 py-2">
        {[...grouped.entries()].map(([groupLabel, groupRows]) => (
          <div key={groupLabel} className="mb-4">
            {/* Group header */}
            {isGrouped && (
              <div className="mb-1 flex items-center gap-2 px-3 py-1">
                <svg
                  className="h-3.5 w-3.5 text-muted-foreground/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="text-xs font-semibold text-foreground">{groupLabel}</span>
                <span className="text-xs text-muted-foreground">({groupRows.length})</span>
              </div>
            )}

            {/* Rows */}
            {groupRows.map((row) => (
              <ListItem
                key={row.id}
                row={row}
                schema={schema}
                summaryColumnIds={summaryColumnIds}
                isSelected={selectedRowIds.has(row.id)}
                editingCell={editingCell}
                onRowClick={onRowClick}
                onCellCommit={onCellCommit}
                onCellEditStart={onCellEditStart}
                onCellEditCancel={onCellEditCancel}
                onRowSelect={(multi) => onRowSelect(row.id, multi)}
              />
            ))}
          </div>
        ))}

        {processedRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <p>No rows match the current filters</p>
          </div>
        )}
      </div>

      {/* Add row */}
      <div className="border-t border-border px-4 py-2">
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add note
        </button>
      </div>
    </div>
  );
}
