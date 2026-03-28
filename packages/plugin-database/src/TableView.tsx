'use client';

/**
 * TableView.tsx — Spreadsheet-like table with resizable columns.
 *
 * Features:
 * - Sticky header row with column names
 * - Resizable columns (drag the column divider)
 * - Inline cell editing via CellRenderer
 * - Row selection via checkbox in first column
 * - "Add row" button at the bottom
 * - Keyboard navigation: Tab/Shift+Tab moves between cells, Enter starts edit
 * - Column header click to add/toggle sort
 * - Groups rows when groupBy is active
 */

import { useRef, useCallback, useState } from 'react';
import type {
  DatabaseRow,
  ColumnDefinition,
  ViewDefinition,
  DatabaseSchemaDefinition,
  CellValue,
  GroupByDefinition,
} from './database-schema';
import { CellRenderer } from './CellRenderer';
import { applyViewToRows, groupRows } from './database-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TableViewProps {
  schema: DatabaseSchemaDefinition;
  view: ViewDefinition;
  rows: DatabaseRow[];
  searchQuery: string;
  selectedRowIds: Set<string>;
  editingCell: { rowId: string; columnId: string } | null;
  columnWidthOverrides: Record<string, number>;

  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onRowSelect: (rowId: string, multi: boolean) => void;
  onSelectAll: () => void;
  onColumnResize: (columnId: string, width: number) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onSortColumn: (columnId: string) => void;
}

// ---------------------------------------------------------------------------
// Column width helpers
// ---------------------------------------------------------------------------

const DEFAULT_TITLE_WIDTH = 240;
const DEFAULT_COLUMN_WIDTH = 160;
const MIN_COLUMN_WIDTH = 60;

function getColumnWidth(col: ColumnDefinition, overrides: Record<string, number>): number {
  return overrides[col.id] ?? col.width ?? DEFAULT_COLUMN_WIDTH;
}

// ---------------------------------------------------------------------------
// Resizable column header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  column: ColumnDefinition;
  width: number;
  isSorted: boolean;
  sortDirection: 'asc' | 'desc' | null;
  onSort: () => void;
  onResize: (width: number) => void;
}

function ColumnHeader({
  column,
  width,
  isSorted,
  sortDirection,
  onSort,
  onResize,
}: ColumnHeaderProps) {
  const dragStartX = useRef<number | null>(null);
  const dragStartWidth = useRef<number>(width);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;

      const onMove = (evt: MouseEvent) => {
        if (dragStartX.current === null) return;
        const delta = evt.clientX - dragStartX.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, dragStartWidth.current + delta);
        onResize(newWidth);
      };
      const onUp = () => {
        dragStartX.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, onResize],
  );

  const typeIcons: Record<string, string> = {
    text: 'T',
    number: '#',
    date: '📅',
    select: '◉',
    multi_select: '◈',
    checkbox: '☑',
    url: '🔗',
    email: '@',
    file: '📎',
    relation: '↗',
    formula: 'ƒ',
  };

  return (
    <th
      className="group relative h-8 border-r border-b border-border bg-muted/30 px-0 text-left text-xs font-medium text-muted-foreground"
      style={{ width, minWidth: MIN_COLUMN_WIDTH }}
    >
      <div className="flex h-full items-center gap-1.5 px-2 select-none">
        <span className="shrink-0 opacity-50 text-[10px]">{typeIcons[column.type]}</span>
        <button
          type="button"
          onClick={onSort}
          className="flex-1 truncate text-left text-xs hover:text-foreground"
          title={column.name}
        >
          {column.name}
        </button>
        {isSorted && (
          <span className="shrink-0 text-[10px] text-primary">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40"
        onMouseDown={onMouseDown}
      />
    </th>
  );
}

// ---------------------------------------------------------------------------
// TableView
// ---------------------------------------------------------------------------

export function TableView({
  schema,
  view,
  rows,
  searchQuery,
  selectedRowIds,
  editingCell,
  columnWidthOverrides,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onRowSelect,
  onSelectAll,
  onColumnResize,
  onAddRow,
  onAddColumn,
  onSortColumn,
}: TableViewProps) {
  const visibleColumns = schema.columns.filter(
    (c) => !c.hidden && (view.columnOrder ? view.columnOrder.includes(c.id) : true),
  );

  // Sort columns by view.columnOrder if defined
  const orderedColumns = view.columnOrder
    ? [...visibleColumns].sort(
        (a, b) => (view.columnOrder?.indexOf(a.id) ?? 0) - (view.columnOrder?.indexOf(b.id) ?? 0),
      )
    : visibleColumns;

  // Apply sorts/filters/search
  const processedRows = applyViewToRows(rows, schema, view, searchQuery);

  // Grouping
  const groupByDef: GroupByDefinition = view.groupBy ?? null;
  const grouped = groupRows(processedRows, schema, groupByDef);
  const isGrouped = grouped.size > 1 || (grouped.size === 1 && !grouped.has('All'));

  const allSelected =
    processedRows.length > 0 && processedRows.every((r) => selectedRowIds.has(r.id));

  const getSortState = (colId: string): { isSorted: boolean; direction: 'asc' | 'desc' | null } => {
    const sort = (view.sorts ?? []).find((s) => s.columnId === colId);
    return sort
      ? { isSorted: true, direction: sort.direction }
      : { isSorted: false, direction: null };
  };

  const titleWidth = columnWidthOverrides['__title__'] ?? DEFAULT_TITLE_WIDTH;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Checkbox column */}
              <th className="h-8 w-8 border-b border-r border-border bg-muted/30 px-0">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="h-3.5 w-3.5 rounded border-border"
                    aria-label="Select all rows"
                  />
                </div>
              </th>

              {/* Title column */}
              <th
                className="group relative h-8 border-b border-r border-border bg-muted/30 px-2 text-left text-xs font-semibold text-foreground"
                style={{ width: titleWidth, minWidth: MIN_COLUMN_WIDTH }}
              >
                <div className="flex items-center gap-1.5 truncate select-none">
                  <span className="shrink-0 opacity-50">📝</span>
                  <span>Title</span>
                </div>
                <div
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startW = titleWidth;
                    const onMove = (evt: MouseEvent) => {
                      onColumnResize(
                        '__title__',
                        Math.max(MIN_COLUMN_WIDTH, startW + evt.clientX - startX),
                      );
                    };
                    const onUp = () => {
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                />
              </th>

              {/* Data columns */}
              {orderedColumns.map((col) => {
                const { isSorted, direction } = getSortState(col.id);
                return (
                  <ColumnHeader
                    key={col.id}
                    column={col}
                    width={getColumnWidth(col, columnWidthOverrides)}
                    isSorted={isSorted}
                    sortDirection={direction}
                    onSort={() => onSortColumn(col.id)}
                    onResize={(w) => onColumnResize(col.id, w)}
                  />
                );
              })}

              {/* Add column */}
              <th className="h-8 border-b border-border bg-muted/30 px-2">
                <button
                  type="button"
                  onClick={onAddColumn}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Add column"
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
                </button>
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {[...grouped.entries()].map(([groupLabel, groupRows]) => (
              <>
                {/* Group header row */}
                {isGrouped && (
                  <tr key={`group_${groupLabel}`}>
                    <td
                      colSpan={orderedColumns.length + 3}
                      className="border-b border-border bg-muted/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      {groupLabel}
                      <span className="ml-2 text-muted-foreground/60">({groupRows.length})</span>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {groupRows.map((row) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    columns={orderedColumns}
                    titleWidth={titleWidth}
                    columnWidthOverrides={columnWidthOverrides}
                    isSelected={selectedRowIds.has(row.id)}
                    editingCell={editingCell}
                    onRowClick={onRowClick}
                    onCellCommit={onCellCommit}
                    onCellEditStart={onCellEditStart}
                    onCellEditCancel={onCellEditCancel}
                    onRowSelect={onRowSelect}
                  />
                ))}
              </>
            ))}
          </tbody>
        </table>

        {/* No rows */}
        {processedRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <p>No rows match the current filters</p>
          </div>
        )}
      </div>

      {/* Add row button */}
      <div className="border-t border-border bg-background px-2 py-1.5">
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
          Add row
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableRow sub-component
// ---------------------------------------------------------------------------

interface TableRowProps {
  row: DatabaseRow;
  columns: ColumnDefinition[];
  titleWidth: number;
  columnWidthOverrides: Record<string, number>;
  isSelected: boolean;
  editingCell: { rowId: string; columnId: string } | null;
  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onRowSelect: (rowId: string, multi: boolean) => void;
}

function TableRow({
  row,
  columns,
  titleWidth,
  columnWidthOverrides,
  isSelected,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onRowSelect,
}: TableRowProps) {
  const [titleEditing, setTitleEditing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <tr
      className={[
        'group border-b border-border hover:bg-accent/40',
        isSelected ? 'bg-primary/5' : '',
      ].join(' ')}
    >
      {/* Checkbox */}
      <td className="w-8 border-r border-border px-0">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(row.id, e.shiftKey)}
            className="h-3.5 w-3.5 rounded border-border"
            aria-label={`Select row "${row.title}"`}
          />
        </div>
      </td>

      {/* Title cell */}
      <td className="border-r border-border px-0" style={{ width: titleWidth }}>
        <div className="flex h-8 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => onRowClick(row.id)}
            className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 hover:text-primary"
            title="Open note"
            aria-label="Open note"
          >
            <svg
              className="h-3 w-3"
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

          {titleEditing ? (
            <input
              ref={titleRef}
              defaultValue={row.title}
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none ring-1 ring-primary/50"
              onBlur={(e) => {
                onCellCommit(row.id, '__title__', e.target.value);
                setTitleEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onCellCommit(row.id, '__title__', (e.target as HTMLInputElement).value);
                  setTitleEditing(false);
                }
                if (e.key === 'Escape') setTitleEditing(false);
              }}
            />
          ) : (
            <span
              className="flex-1 truncate text-sm font-medium text-foreground cursor-pointer hover:underline"
              onDoubleClick={() => setTitleEditing(true)}
              onClick={() => onRowClick(row.id)}
              title={row.title}
            >
              {row.title || <span className="text-muted-foreground/50">Untitled</span>}
            </span>
          )}
        </div>
      </td>

      {/* Data cells */}
      {columns.map((col) => {
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;
        const width = columnWidthOverrides[col.id] ?? col.width ?? DEFAULT_COLUMN_WIDTH;

        return (
          <td key={col.id} className="border-r border-border px-0" style={{ width }}>
            <CellRenderer
              column={col}
              value={row.values[col.id]}
              isEditing={isEditing}
              onStartEdit={() => onCellEditStart(row.id, col.id)}
              onCommit={(v) => onCellCommit(row.id, col.id, v)}
              onCancel={onCellEditCancel}
              className="h-8"
            />
          </td>
        );
      })}

      {/* Spacer for add-column button */}
      <td />
    </tr>
  );
}
