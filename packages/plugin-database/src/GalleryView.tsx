'use client';

/**
 * GalleryView.tsx — Card grid view for database rows.
 *
 * Each row is rendered as a card showing the title, optional cover image,
 * and a configurable set of preview properties.
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

export interface GalleryViewProps {
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
  onRowSelect: (rowId: string) => void;
  onAddRow: () => void;
}

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

interface GalleryCardProps {
  row: DatabaseRow;
  schema: DatabaseSchemaDefinition;
  previewColumnIds: string[];
  isSelected: boolean;
  editingCell: { rowId: string; columnId: string } | null;
  onRowClick: (rowId: string) => void;
  onCellCommit: (rowId: string, columnId: string, value: CellValue) => void;
  onCellEditStart: (rowId: string, columnId: string) => void;
  onCellEditCancel: () => void;
  onSelect: () => void;
}

function GalleryCard({
  row,
  schema,
  previewColumnIds,
  isSelected,
  editingCell,
  onRowClick,
  onCellCommit,
  onCellEditStart,
  onCellEditCancel,
  onSelect,
}: GalleryCardProps) {
  const previewColumns = previewColumnIds
    .map((id) => schema.columns.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 4); // Show at most 4 preview properties

  return (
    <div
      className={[
        'group relative flex flex-col rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md',
        isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border',
      ].join(' ')}
    >
      {/* Selection checkbox */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-border"
          aria-label={`Select "${row.title}"`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Cover / placeholder */}
      <div className="flex h-28 items-center justify-center rounded-t-lg bg-muted/20">
        <svg
          className="h-10 w-10 text-muted-foreground/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-3">
        {/* Title */}
        <button
          type="button"
          className="text-left text-sm font-semibold text-foreground hover:underline line-clamp-2"
          onClick={() => onRowClick(row.id)}
          title={row.title}
        >
          {row.title || <span className="text-muted-foreground/50">Untitled</span>}
        </button>

        {/* Preview properties */}
        {previewColumns.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {previewColumns.map((col) => (
              <div key={col.id} className="flex items-start gap-2">
                <span
                  className="w-20 shrink-0 truncate text-[11px] text-muted-foreground"
                  title={col.name}
                >
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// GalleryView
// ---------------------------------------------------------------------------

export function GalleryView({
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
}: GalleryViewProps) {
  const previewColumnIds =
    view.galleryPreviewColumns ??
    schema.columns
      .filter((c) => !c.hidden && c.type !== 'formula')
      .slice(0, 3)
      .map((c) => c.id);

  const processedRows = applyViewToRows(rows, schema, view, searchQuery);
  const groupByDef: GroupByDefinition = view.groupBy ?? null;
  const grouped = groupRows(processedRows, schema, groupByDef);
  const isGrouped = grouped.size > 1 || (grouped.size === 1 && !grouped.has('All'));

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      {[...grouped.entries()].map(([groupLabel, groupRows]) => (
        <div key={groupLabel} className="mb-6">
          {/* Group header */}
          {isGrouped && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold">{groupLabel}</span>
              <span className="text-xs text-muted-foreground">({groupRows.length})</span>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {groupRows.map((row) => (
              <GalleryCard
                key={row.id}
                row={row}
                schema={schema}
                previewColumnIds={previewColumnIds}
                isSelected={selectedRowIds.has(row.id)}
                editingCell={editingCell}
                onRowClick={onRowClick}
                onCellCommit={onCellCommit}
                onCellEditStart={onCellEditStart}
                onCellEditCancel={onCellEditCancel}
                onSelect={() => onRowSelect(row.id)}
              />
            ))}

            {/* Add card */}
            <button
              type="button"
              onClick={onAddRow}
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-6 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <svg
                className="mb-2 h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-xs">New note</span>
            </button>
          </div>
        </div>
      ))}

      {processedRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
          <p>No rows match the current filters</p>
          <button
            type="button"
            onClick={onAddRow}
            className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          >
            Add first note
          </button>
        </div>
      )}
    </div>
  );
}
