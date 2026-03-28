'use client';

/**
 * BoardView.tsx — Kanban board view for database rows.
 *
 * Each column corresponds to a select option value.
 * Cards can be dragged between columns (HTML5 Drag and Drop API).
 * Supports search (hides non-matching cards) and add-row per column.
 *
 * The groupBy column defaults to the first "select" column in the schema.
 * If no select column exists, an empty board is shown with a hint.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  DatabaseRow,
  DatabaseSchemaDefinition,
  ViewDefinition,
  CellValue,
  SelectOption,
} from './database-schema';
import { CellRenderer } from './CellRenderer';
import { applyViewToRows } from './database-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BoardViewProps {
  schema: DatabaseSchemaDefinition;
  view: ViewDefinition;
  rows: DatabaseRow[];
  searchQuery: string;
  editingCell: { rowId: string; columnId: string } | null;

  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onAddRow: (columnValue?: string) => void;
  /** Called when a card is dragged to a new column */
  onMoveRow: (rowId: string, newGroupValue: string) => void;
}

// ---------------------------------------------------------------------------
// Board card
// ---------------------------------------------------------------------------

interface BoardCardProps {
  row: DatabaseRow;
  schema: DatabaseSchemaDefinition;
  previewColumnIds: string[];
  editingCell: { rowId: string; columnId: string } | null;
  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function BoardCard({
  row,
  schema,
  previewColumnIds,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onDragStart,
}: BoardCardProps) {
  const previewColumns = previewColumnIds
    .map((id) => schema.columns.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 3);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab rounded-md border border-border bg-card p-3 shadow-sm hover:shadow active:cursor-grabbing active:opacity-70"
    >
      {/* Title */}
      <button
        type="button"
        onClick={() => onRowClick(row.id)}
        className="text-left text-sm font-medium text-foreground hover:underline line-clamp-2"
        title={row.title}
      >
        {row.title || <span className="text-muted-foreground/50">Untitled</span>}
      </button>

      {/* Preview properties */}
      {previewColumns.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {previewColumns.map((col) => (
            <div key={col.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate text-[10px] text-muted-foreground">
                {col.name}
              </span>
              <div className="min-w-0 flex-1">
                <CellRenderer
                  column={col}
                  value={row.values[col.id]}
                  isEditing={editingCell?.rowId === row.id && editingCell?.columnId === col.id}
                  onStartEdit={() => onCellEditStart(row.id, col.id)}
                  onCommit={(v) => onCellCommit(row.id, col.id, v)}
                  onCancel={onCellEditCancel}
                  className="min-h-0 px-0 text-[11px]"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board column
// ---------------------------------------------------------------------------

interface BoardColumnProps {
  option: SelectOption | { id: string; label: string; color?: string };
  cards: DatabaseRow[];
  schema: DatabaseSchemaDefinition;
  previewColumnIds: string[];
  editingCell: { rowId: string; columnId: string } | null;
  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onAddRow: () => void;
  onCardDragStart: (rowId: string) => void;
  onDrop: (optionId: string) => void;
}

function BoardColumn({
  option,
  cards,
  schema,
  previewColumnIds,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onAddRow,
  onCardDragStart,
  onDrop,
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={[
        'flex h-full w-64 shrink-0 flex-col rounded-lg border bg-muted/20',
        isDragOver ? 'border-primary/50 bg-primary/5' : 'border-border',
      ].join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(option.id);
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {option.color && (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
        )}
        <span className="flex-1 text-xs font-semibold text-foreground">{option.label}</span>
        <span className="text-xs text-muted-foreground">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {cards.map((row) => (
          <BoardCard
            key={row.id}
            row={row}
            schema={schema}
            previewColumnIds={previewColumnIds}
            editingCell={editingCell}
            onRowClick={onRowClick}
            onCellCommit={onCellCommit}
            onCellEditStart={onCellEditStart}
            onCellEditCancel={onCellEditCancel}
            onDragStart={(e) => {
              e.dataTransfer.setData('rowId', row.id);
              onCardDragStart(row.id);
            }}
          />
        ))}

        {/* Drop zone hint when dragging over an empty column */}
        {isDragOver && cards.length === 0 && (
          <div className="flex items-center justify-center rounded-md border-2 border-dashed border-primary/30 py-6 text-xs text-muted-foreground">
            Drop here
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="border-t border-border px-2 py-2">
        <button
          type="button"
          onClick={onAddRow}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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

// ---------------------------------------------------------------------------
// BoardView
// ---------------------------------------------------------------------------

export function BoardView({
  schema,
  view,
  rows,
  searchQuery,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onAddRow,
  onMoveRow,
}: BoardViewProps) {
  const draggingRowId = useRef<string | null>(null);

  // Determine the group column (board group column, first select column, or nothing)
  const groupColumnId =
    view.boardGroupColumnId ?? schema.columns.find((c) => c.type === 'select')?.id;

  const groupColumn = groupColumnId ? schema.columns.find((c) => c.id === groupColumnId) : null;

  if (!groupColumn || groupColumn.type !== 'select') {
    return (
      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
        <p className="mb-2">Board view requires a "Select" column to group by.</p>
        <p className="text-xs">Add a select column to your database to use this view.</p>
      </div>
    );
  }

  const selectOptions = (groupColumn.options as { options?: SelectOption[] })?.options ?? [];

  // Apply sorts/filters/search but NOT group-by (we handle grouping ourselves)
  const processedRows = applyViewToRows(rows, schema, { ...view, groupBy: null }, searchQuery);

  // Group rows by select option value
  const noGroupOption: SelectOption = { id: '_ungrouped', label: 'No status', color: '#94a3b8' };
  const allOptions: SelectOption[] = [...selectOptions, noGroupOption];

  const grouped = new Map<string, DatabaseRow[]>(allOptions.map((o) => [o.id, []]));

  for (const row of processedRows) {
    const val = row.values[groupColumn.id];
    const optId = typeof val === 'string' ? val : null;
    const target = optId && grouped.has(optId) ? optId : '_ungrouped';
    grouped.get(target)?.push(row);
  }

  // Preview columns: first 2 non-hidden, non-select, non-formula columns
  const previewColumnIds = schema.columns
    .filter((c) => !c.hidden && c.type !== 'formula' && c.id !== groupColumnId)
    .slice(0, 2)
    .map((c) => c.id);

  const handleDrop = useCallback(
    (newOptionId: string) => {
      if (!draggingRowId.current) return;
      const targetValue = newOptionId === '_ungrouped' ? null : newOptionId;
      onMoveRow(draggingRowId.current, targetValue ?? '');
      draggingRowId.current = null;
    },
    [onMoveRow],
  );

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {allOptions.map((option) => {
        const cards = grouped.get(option.id) ?? [];
        // Hide empty "No status" column if all rows have a status
        if (option.id === '_ungrouped' && cards.length === 0) return null;

        return (
          <BoardColumn
            key={option.id}
            option={option}
            cards={cards}
            schema={schema}
            previewColumnIds={previewColumnIds}
            editingCell={editingCell}
            onRowClick={onRowClick}
            onCellCommit={onCellCommit}
            onCellEditStart={onCellEditStart}
            onCellEditCancel={onCellEditCancel}
            onAddRow={() => onAddRow(option.id === '_ungrouped' ? undefined : option.id)}
            onCardDragStart={(rowId) => {
              draggingRowId.current = rowId;
            }}
            onDrop={handleDrop}
          />
        );
      })}
    </div>
  );
}
