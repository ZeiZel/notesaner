/**
 * GridLayout.tsx
 *
 * CSS Grid-based window layout system replacing SplitPaneLayout.
 *
 * Features:
 *   - CSS Grid with grid-template-columns / grid-template-rows
 *   - Draggable dividers between grid tracks for resizing
 *   - Pane focus with visual indicator (ring highlight)
 *   - Keyboard navigation between panes (Ctrl+Arrow)
 *   - Drop zone indicators for pane drag-and-drop
 *   - Snap to grid positions with 20px threshold
 *   - Mobile/tablet: single pane full-screen
 *
 * Design notes:
 *   - No useEffect for layout calculations: grid sizing is pure CSS.
 *   - Keyboard events use a single handler registered via onKeyDown on
 *     the container, not a global listener in an effect.
 *   - The component bridges the old layout store (PanelConfig) with the
 *     new grid layout store for backward compatibility.
 */

'use client';

import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { useGridLayoutStore, type GridPaneConfig } from '../model/grid-layout-store';
import { useLayoutStore, type PanelConfig } from '@/shared/stores/layout-store';
import { usePanelControls, PanelControlsProvider } from '../model/PanelControlsContext';
import { usePanelControlShortcuts } from './PanelControls';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { GridPane } from './GridPane';
import { GridDivider } from './GridDivider';
import { SnapLayoutPicker } from './SnapLayoutPicker';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

// ---------------------------------------------------------------------------
// DropZoneOverlay
// ---------------------------------------------------------------------------

function DropZoneOverlay({
  colStart,
  colEnd,
  rowStart,
  rowEnd,
}: {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        gridColumn: `${colStart} / ${colEnd}`,
        gridRow: `${rowStart} / ${rowEnd}`,
      }}
      className="pointer-events-none z-30 rounded-lg border-2 border-dashed border-primary bg-primary/5 transition-opacity"
    />
  );
}

// ---------------------------------------------------------------------------
// GridLayout (main export)
// ---------------------------------------------------------------------------

export interface GridLayoutProps {
  /**
   * Render function called for each pane.
   * Receives both the grid pane config and the legacy PanelConfig for compatibility.
   */
  renderPane?: (pane: GridPaneConfig, legacyPanel?: PanelConfig) => ReactNode;
}

export function GridLayout(props: GridLayoutProps) {
  return (
    <PanelControlsProvider>
      <GridLayoutInner {...props} />
    </PanelControlsProvider>
  );
}

function GridLayoutInner({ renderPane }: GridLayoutProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  const gridConfig = useGridLayoutStore((s) => s.gridConfig);
  const focusedPaneId = useGridLayoutStore((s) => s.focusedPaneId);
  const moveFocus = useGridLayoutStore((s) => s.moveFocus);
  const dropZone = useGridLayoutStore((s) => s.dropZone);

  // Panel controls: maximize/minimize state
  const maximizedPaneId = usePanelControls((s) => s.maximizedPaneId);

  // Register keyboard shortcuts for panel maximize/minimize
  const panelShortcuts = usePanelControlShortcuts(focusedPaneId);
  useKeyboardShortcuts(panelShortcuts);

  // Legacy store bridge: read panels for backward compatibility
  const legacyPanels = useLayoutStore((s) => s.currentLayout.panels);

  const containerRef = useRef<HTMLDivElement>(null);

  // On mobile/tablet, render only the first pane full-screen
  if (isMobile || isTablet) {
    const firstPane = gridConfig.panes[0];
    if (!firstPane) return null;

    const legacyPanel = legacyPanels[0];

    return (
      <div className="relative h-full w-full">
        <GridPane pane={firstPane}>{renderPane?.(firstPane, legacyPanel)}</GridPane>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Keyboard navigation: Ctrl+Arrow moves focus between panes
  // -------------------------------------------------------------------------

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!e.ctrlKey) return;

    let direction: 'left' | 'right' | 'up' | 'down' | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        direction = 'left';
        break;
      case 'ArrowRight':
        direction = 'right';
        break;
      case 'ArrowUp':
        direction = 'up';
        break;
      case 'ArrowDown':
        direction = 'down';
        break;
      default:
        return;
    }

    if (direction) {
      e.preventDefault();
      e.stopPropagation();
      moveFocus(direction);

      // Move DOM focus to the newly focused pane
      requestAnimationFrame(() => {
        const state = useGridLayoutStore.getState();
        if (state.focusedPaneId && containerRef.current) {
          const paneEl = containerRef.current.querySelector(
            `[data-pane-id="${state.focusedPaneId}"]`,
          );
          if (paneEl instanceof HTMLElement) {
            paneEl.focus({ preventScroll: true });
          }
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // Build CSS Grid style from config
  // -------------------------------------------------------------------------

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridConfig.columns.join(' '),
    gridTemplateRows: gridConfig.rows.join(' '),
    gap: '4px',
    height: '100%',
    width: '100%',
  };

  // -------------------------------------------------------------------------
  // Compute which dividers to render
  // -------------------------------------------------------------------------

  const columnDividers: number[] = [];
  for (let i = 0; i < gridConfig.columns.length - 1; i++) {
    columnDividers.push(i);
  }

  const rowDividers: number[] = [];
  for (let i = 0; i < gridConfig.rows.length - 1; i++) {
    rowDividers.push(i);
  }

  return (
    <>
      {/* Snap layout picker (floating dialog) */}
      <SnapLayoutPicker />

      <div
        ref={containerRef}
        role="group"
        aria-label="Window grid layout"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={gridStyle}
        className="relative"
      >
        {/* Render panes */}
        {gridConfig.panes.map((pane, index) => {
          const legacyPanel = legacyPanels[index];

          return (
            <GridPane key={pane.id} pane={pane}>
              {renderPane?.(pane, legacyPanel)}
            </GridPane>
          );
        })}

        {/* Render column dividers (hidden when a pane is maximized) */}
        {!maximizedPaneId &&
          columnDividers.map((dividerIndex) => (
            <GridDivider
              key={`col-${dividerIndex}`}
              axis="column"
              index={dividerIndex}
              containerRef={containerRef}
            />
          ))}

        {/* Render row dividers (hidden when a pane is maximized) */}
        {!maximizedPaneId &&
          rowDividers.map((dividerIndex) => (
            <GridDivider
              key={`row-${dividerIndex}`}
              axis="row"
              index={dividerIndex}
              containerRef={containerRef}
            />
          ))}

        {/* Drop zone indicator */}
        {dropZone && (
          <DropZoneOverlay
            colStart={dropZone.colStart}
            colEnd={dropZone.colEnd}
            rowStart={dropZone.rowStart}
            rowEnd={dropZone.rowEnd}
          />
        )}
      </div>
    </>
  );
}
