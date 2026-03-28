/**
 * GridPane.tsx
 *
 * Individual pane within the CSS Grid layout system.
 *
 * Design notes:
 *   - Panes do NOT have their own tab bars (tabs are global, separate task).
 *   - Each pane tracks a focusedNoteId in the grid layout store.
 *   - Focus is indicated by a subtle border highlight (ring).
 *   - Click-to-focus: clicking anywhere in the pane focuses it in the store.
 *   - No useEffect — focus is managed via event handlers and store state.
 *   - Integrates with PanelControls for maximize/minimize/restore.
 */

'use client';

import { useCallback, type ReactNode } from 'react';
import { useGridLayoutStore, type GridPaneConfig } from './grid-layout-store';
import { usePanelControlsStore, type PanelState } from './panel-controls-store';
import { PanelControls } from './components/PanelControls';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Height of the minimized pane header strip in pixels. */
const MINIMIZED_HEIGHT = 32;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GridPaneProps {
  /** The pane configuration from the grid layout store */
  pane: GridPaneConfig;
  /** Content to render inside the pane */
  children?: ReactNode;
}

export function GridPane({ pane, children }: GridPaneProps) {
  const focusedPaneId = useGridLayoutStore((s) => s.focusedPaneId);
  const focusPane = useGridLayoutStore((s) => s.focusPane);
  const isFocused = focusedPaneId === pane.id;

  const panelState = usePanelControlsStore(
    (s) => (s.panelStates[pane.id] ?? 'normal') as PanelState,
  );
  const isPaneVisible = usePanelControlsStore((s) => s.isPaneVisible);

  const visible = isPaneVisible(pane.id);
  const isMaximized = panelState === 'maximized';
  const isMinimized = panelState === 'minimized';

  const handleClick = useCallback(() => {
    focusPane(pane.id);
  }, [pane.id, focusPane]);

  const handleFocus = useCallback(() => {
    focusPane(pane.id);
  }, [pane.id, focusPane]);

  // When another pane is maximized, hide this pane
  if (!visible) {
    return null;
  }

  // Build grid placement style. When maximized, span the full grid.
  const gridStyle: React.CSSProperties = isMaximized
    ? {
        gridColumn: '1 / -1',
        gridRow: '1 / -1',
        zIndex: 20,
      }
    : {
        gridColumn: `${pane.colStart} / ${pane.colEnd}`,
        gridRow: `${pane.rowStart} / ${pane.rowEnd}`,
      };

  // Minimized panes get a fixed small height
  if (isMinimized) {
    gridStyle.maxHeight = `${MINIMIZED_HEIGHT}px`;
    gridStyle.minHeight = `${MINIMIZED_HEIGHT}px`;
    gridStyle.overflow = 'hidden';
  }

  return (
    <div
      data-pane-id={pane.id}
      data-focused={isFocused || undefined}
      data-panel-state={panelState}
      role="region"
      aria-label={`Pane ${pane.id}`}
      tabIndex={0}
      onClick={handleClick}
      onFocus={handleFocus}
      style={gridStyle}
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-sm bg-background transition-all duration-200',
        // Focus indication: subtle ring highlight
        isFocused ? 'ring-1 ring-primary/50 shadow-sm' : 'ring-0 hover:ring-1 hover:ring-border/40',
        // Maximized: full size, elevated
        isMaximized && 'shadow-lg ring-2 ring-primary/30',
        // Minimized: collapsed to strip height
        isMinimized ? 'min-h-0' : 'min-h-0',
      )}
    >
      {/* Panel header strip with controls */}
      <div
        className={cn(
          'flex h-8 shrink-0 items-center justify-between px-2',
          'border-b border-border/30',
          isMinimized && 'cursor-pointer hover:bg-accent/50',
        )}
      >
        <span className="truncate text-xs font-medium text-muted-foreground select-none">
          {pane.id}
        </span>
        <PanelControls paneId={pane.id} />
      </div>

      {/* Pane content — hidden when minimized */}
      {!isMinimized && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {children ?? (
            <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
              Empty pane
            </div>
          )}
        </div>
      )}
    </div>
  );
}
