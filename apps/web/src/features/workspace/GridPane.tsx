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
 */

'use client';

import { useCallback, type ReactNode } from 'react';
import { useGridLayoutStore, type GridPaneConfig } from './grid-layout-store';

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

  const handleClick = useCallback(() => {
    focusPane(pane.id);
  }, [pane.id, focusPane]);

  const handleFocus = useCallback(() => {
    focusPane(pane.id);
  }, [pane.id, focusPane]);

  return (
    <div
      data-pane-id={pane.id}
      data-focused={isFocused || undefined}
      role="region"
      aria-label={`Pane ${pane.id}`}
      tabIndex={0}
      onClick={handleClick}
      onFocus={handleFocus}
      style={{
        gridColumn: `${pane.colStart} / ${pane.colEnd}`,
        gridRow: `${pane.rowStart} / ${pane.rowEnd}`,
      }}
      className={[
        'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm bg-background transition-shadow',
        // Focus indication: subtle ring highlight
        isFocused ? 'ring-1 ring-primary/50 shadow-sm' : 'ring-0 hover:ring-1 hover:ring-border/40',
      ].join(' ')}
    >
      {children ?? (
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          Empty pane
        </div>
      )}
    </div>
  );
}
