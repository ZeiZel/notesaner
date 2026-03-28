'use client';

/**
 * DatabaseView.tsx — Main view switcher and orchestrator for the database plugin.
 *
 * Responsibilities:
 * - Initialises the Zustand store from props
 * - Renders the view type tabs (table / board / gallery / list)
 * - Renders the FilterBar above the active view
 * - Delegates to TableView / BoardView / GalleryView / ListView
 * - Handles CSV export/import and passes the download trigger
 * - Re-evaluates formula cells on each render
 *
 * All data mutation callbacks are provided by the parent (e.g. the plugin host
 * or an inline embed); DatabaseView itself is stateless w.r.t. persistence.
 */

import { useEffect, useMemo, useRef } from 'react';
import type {
  DatabaseSchemaDefinition,
  DatabaseRow,
  ViewDefinition,
  ViewType,
  CellValue,
  SortDefinition,
  FilterDefinition,
  GroupByDefinition,
} from './database-schema';
import { VIEW_TYPES } from './database-schema';
import { createDatabaseStore, selectActiveView } from './database-store';
import { TableView } from './TableView';
import { BoardView } from './BoardView';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';
import { FilterBar } from './FilterBar';
import { exportToCsv, importFromCsv, downloadCsv, generateCsvFilename } from './csv-utils';
import { evaluateFormula } from './formula-engine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DatabaseViewCallbacks {
  /** Called when the user requests a new row to be created */
  onCreateRow: (initialValues?: Partial<DatabaseRow['values']>) => void;
  /** Called when a cell value changes */
  onUpdateRow: (rowId: string, values: Partial<DatabaseRow['values']>) => void;
  /** Called when the user clicks the row title (open note) */
  onOpenNote: (rowId: string) => void;
  /** Called when schema changes (add/remove/rename column, add/remove view) */
  onSchemaChange: (schema: DatabaseSchemaDefinition) => void;
  /** Called when CSV rows are imported */
  onImportRows: (rows: Array<{ title: string; values: Record<string, CellValue> }>) => void;
}

export interface DatabaseViewProps extends DatabaseViewCallbacks {
  /** The validated schema from the note frontmatter */
  schema: DatabaseSchemaDefinition;
  /** Current rows loaded from the workspace */
  rows: DatabaseRow[];
  /** Whether data is being loaded */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Optional className for the root container */
  className?: string;
  /** If true, renders in compact mode (for inline embeds) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// View type tab icons
// ---------------------------------------------------------------------------

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  table: (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  board: (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="11" rx="1" />
      <rect x="17" y="3" width="4" height="7" rx="1" />
    </svg>
  ),
  gallery: (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  list: (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Formula evaluation helper
// ---------------------------------------------------------------------------

function evaluateFormulaColumns(
  rows: DatabaseRow[],
  schema: DatabaseSchemaDefinition,
): DatabaseRow[] {
  const formulaColumns = schema.columns.filter((c) => c.type === 'formula');
  if (formulaColumns.length === 0) return rows;

  return rows.map((row) => {
    const updatedValues = { ...row.values };
    for (const col of formulaColumns) {
      const expr = (col.options as { expression?: string } | undefined)?.expression ?? '';
      if (!expr) continue;
      const result = evaluateFormula(expr, { columns: schema.columns, row });
      updatedValues[col.id] = result.ok ? result.value : '#ERROR';
    }
    return { ...row, values: updatedValues };
  });
}

// ---------------------------------------------------------------------------
// DatabaseView
// ---------------------------------------------------------------------------

export function DatabaseView({
  schema,
  rows,
  isLoading = false,
  error = null,
  className,
  compact = false,
  onCreateRow,
  onUpdateRow,
  onOpenNote,
  onSchemaChange,
  onImportRows,
}: DatabaseViewProps) {
  // Each DatabaseView instance gets its own isolated store
  const storeRef = useRef(createDatabaseStore());
  const useStore = storeRef.current;

  // Sync external schema/rows into the store
  useEffect(() => {
    useStore.getState().initialize(schema, rows);
  }, [schema, rows]);

  const state = useStore((s) => s);
  const activeView = selectActiveView(state);

  // Derive formula-computed rows (pure computation, no state)
  const computedRows = useMemo(
    () => evaluateFormulaColumns(state.rows, schema),
    [state.rows, schema],
  );

  if (isLoading) {
    return (
      <div className={['flex h-full items-center justify-center', className ?? ''].join(' ')}>
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading database...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={['flex h-full items-center justify-center', className ?? ''].join(' ')}>
        <div className="flex flex-col items-center gap-2 text-sm text-destructive">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!activeView) {
    return (
      <div className={['flex h-full items-center justify-center', className ?? ''].join(' ')}>
        <p className="text-sm text-muted-foreground">No views configured</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleCellCommit = (rowId: string, columnId: string, value: CellValue) => {
    state.commitEdit(rowId, columnId, value);
    if (columnId === '__title__') {
      // Title change is a special case — update the row title
      onUpdateRow(rowId, {});
    } else {
      onUpdateRow(rowId, { [columnId]: value });
    }
  };

  const handleAddRow = (initialGroupValue?: string) => {
    const groupColId =
      activeView.boardGroupColumnId ?? schema.columns.find((c) => c.type === 'select')?.id;
    const initial: Partial<DatabaseRow['values']> = {};
    if (groupColId && initialGroupValue !== undefined) {
      initial[groupColId] = initialGroupValue;
    }
    onCreateRow(initial);
  };

  const handleMoveRow = (rowId: string, newGroupValue: string) => {
    const groupColId =
      activeView.boardGroupColumnId ?? schema.columns.find((c) => c.type === 'select')?.id;
    if (!groupColId) return;
    state.updateRowValues(rowId, { [groupColId]: newGroupValue });
    onUpdateRow(rowId, { [groupColId]: newGroupValue });
  };

  const handleAddColumn = () => {
    const newCol = {
      id: `col_${Date.now()}`,
      name: 'New Column',
      type: 'text' as const,
      width: 160,
    };
    state.addColumn(newCol);
    onSchemaChange({ ...schema, columns: [...schema.columns, newCol] });
  };

  const handleSortColumn = (columnId: string) => {
    const existing = (activeView.sorts ?? []).find((s) => s.columnId === columnId);
    if (!existing) {
      state.addSort(activeView.id, { columnId, direction: 'asc' });
    } else if (existing.direction === 'asc') {
      state.addSort(activeView.id, { columnId, direction: 'desc' });
    } else {
      state.removeSort(activeView.id, columnId);
    }
    onSchemaChange(state.schema ?? schema);
  };

  const handleSortsChange = (sorts: SortDefinition[]) => {
    state.setSorts(activeView.id, sorts);
    onSchemaChange(state.schema ?? schema);
  };

  const handleFiltersChange = (filters: FilterDefinition[]) => {
    state.setFilters(activeView.id, filters);
    onSchemaChange(state.schema ?? schema);
  };

  const handleGroupByChange = (groupBy: GroupByDefinition) => {
    state.setGroupBy(activeView.id, groupBy);
    onSchemaChange(state.schema ?? schema);
  };

  const handleCsvExport = () => {
    const csv = exportToCsv(computedRows, schema.columns);
    downloadCsv(csv, generateCsvFilename(schema.id));
  };

  const handleCsvImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        const result = importFromCsv(content, schema.columns);
        onImportRows(result.rows);
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleViewTypeChange = (newType: ViewType) => {
    state.updateView(activeView.id, { type: newType });
    onSchemaChange(state.schema ?? schema);
  };

  const handleAddView = () => {
    const newView: ViewDefinition = {
      id: `view_${Date.now()}`,
      name: 'New View',
      type: 'table',
      sorts: [],
      filters: [],
      groupBy: null,
    };
    state.addView(newView);
    state.setActiveView(newView.id);
    onSchemaChange(state.schema ?? schema);
  };

  // ---------------------------------------------------------------------------
  // Shared view props
  // ---------------------------------------------------------------------------

  const sharedViewProps = {
    schema: state.schema ?? schema,
    view: activeView,
    rows: computedRows,
    searchQuery: state.searchQuery,
    selectedRowIds: state.selectedRowIds,
    editingCell: state.editingCell,
    onRowClick: onOpenNote,
    onCellCommit: handleCellCommit,
    onCellEditStart: state.startEdit,
    onCellEditCancel: state.cancelEdit,
    onAddRow: handleAddRow,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const containerClass = [
    'flex flex-col overflow-hidden bg-background',
    compact ? 'rounded-lg border border-border' : 'h-full',
    className ?? '',
  ].join(' ');

  return (
    <div className={containerClass}>
      {/* View tabs + add view */}
      <div className="flex items-center gap-0 border-b border-border bg-background px-3">
        {(state.schema ?? schema).views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => state.setActiveView(v.id)}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors',
              state.activeViewId === v.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {VIEW_ICONS[v.type]}
            {v.name}
          </button>
        ))}

        {/* Add view */}
        <button
          type="button"
          onClick={handleAddView}
          className="ml-1 flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
          title="Add view"
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

        {/* View type switcher (icons only) */}
        <div className="ml-auto flex items-center gap-0.5 py-1">
          {VIEW_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleViewTypeChange(type)}
              title={type.charAt(0).toUpperCase() + type.slice(1)}
              className={[
                'flex h-7 w-7 items-center justify-center rounded text-xs transition-colors',
                activeView.type === type
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')}
            >
              {VIEW_ICONS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        columns={(state.schema ?? schema).columns}
        sorts={activeView.sorts ?? []}
        filters={activeView.filters ?? []}
        groupBy={activeView.groupBy ?? null}
        searchQuery={state.searchQuery}
        onSortsChange={handleSortsChange}
        onFiltersChange={handleFiltersChange}
        onGroupByChange={handleGroupByChange}
        onSearchChange={state.setSearchQuery}
        onCsvExport={handleCsvExport}
        onCsvImport={handleCsvImport}
      />

      {/* Active view */}
      <div className="flex-1 overflow-hidden">
        {activeView.type === 'table' && (
          <TableView
            {...sharedViewProps}
            columnWidthOverrides={state.columnWidthOverrides}
            onRowSelect={(id, multi) =>
              multi ? state.toggleRowSelection(id) : state.selectRow(id)
            }
            onSelectAll={() =>
              state.selectedRowIds.size === computedRows.length
                ? state.clearSelection()
                : state.selectAllRows()
            }
            onColumnResize={state.resizeColumn}
            onAddColumn={handleAddColumn}
            onSortColumn={handleSortColumn}
          />
        )}

        {activeView.type === 'board' && (
          <BoardView {...sharedViewProps} onMoveRow={handleMoveRow} />
        )}

        {activeView.type === 'gallery' && (
          <GalleryView {...sharedViewProps} onRowSelect={state.toggleRowSelection} />
        )}

        {activeView.type === 'list' && (
          <ListView
            {...sharedViewProps}
            onRowSelect={(id, multi) =>
              multi ? state.toggleRowSelection(id) : state.selectRow(id)
            }
          />
        )}
      </div>
    </div>
  );
}
