'use client';

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { useLayoutStore, type PanelConfig } from '@/shared/stores/layout-store';
import { SNAP_TEMPLATES } from '../model/snap-layout-types';
import { SnapLayoutPicker } from './SnapLayoutPicker';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

// ---------------------------------------------------------------------------
// Edge detection thresholds for snap-on-drag
// ---------------------------------------------------------------------------

/** Pixel distance from the content area edge that activates a snap zone */
const SNAP_EDGE_THRESHOLD = 80;

/** Minimum drag distance before snap detection starts (avoids accidental triggers) */
const MIN_DRAG_DISTANCE = 20;

// ---------------------------------------------------------------------------
// DropZoneOverlay — visual indicator for a target drop zone
// ---------------------------------------------------------------------------

interface DropZoneOverlayProps {
  panelCount: number;
}

function DropZoneOverlay({ panelCount }: DropZoneOverlayProps) {
  if (panelCount < 2) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-primary bg-primary/5 transition-opacity"
    />
  );
}

// ---------------------------------------------------------------------------
// ResizeDivider — draggable divider between two panels
// ---------------------------------------------------------------------------

interface ResizeDividerProps {
  direction: 'horizontal' | 'vertical';
  index: number;
  onResizeStart: (index: number) => void;
}

function ResizeDivider({ direction, index, onResizeStart }: ResizeDividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label="Resize panel divider"
      onPointerDown={(e: ReactPointerEvent) => {
        e.preventDefault();
        onResizeStart(index);
      }}
      className={[
        'group relative shrink-0 transition-colors',
        direction === 'horizontal'
          ? 'w-1 cursor-col-resize hover:bg-primary/40'
          : 'h-1 cursor-row-resize hover:bg-primary/40',
        'bg-border hover:bg-primary/40',
      ].join(' ')}
    >
      {/* Visual handle hint */}
      <div
        className={[
          'absolute inset-y-0 my-auto flex items-center justify-center',
          direction === 'horizontal'
            ? 'left-1/2 h-8 w-3 -translate-x-1/2'
            : 'top-1/2 h-3 w-8 -translate-y-1/2',
        ].join(' ')}
      >
        <div
          className={[
            'rounded-full bg-border/60 opacity-0 transition-opacity group-hover:opacity-100',
            direction === 'horizontal' ? 'h-6 w-0.5' : 'h-0.5 w-6',
          ].join(' ')}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelSlot — a single panel area
// ---------------------------------------------------------------------------

interface PanelSlotProps {
  panelId: string;
  isDropTarget: boolean;
  children?: ReactNode;
}

function PanelSlot({ panelId, isDropTarget, children }: PanelSlotProps) {
  return (
    <div
      data-panel-id={panelId}
      className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-sm bg-background"
    >
      {isDropTarget && <DropZoneOverlay panelCount={2} />}
      {children ?? (
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          Empty panel
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnapEdgeIndicator — shown when dragging near a window edge
// ---------------------------------------------------------------------------

interface SnapEdgeIndicatorProps {
  side: 'left' | 'right' | 'top' | 'bottom' | null;
}

function SnapEdgeIndicator({ side }: SnapEdgeIndicatorProps) {
  if (!side) return null;

  const sideClasses: Record<NonNullable<typeof side>, string> = {
    left: 'left-0 top-0 h-full w-1/2',
    right: 'right-0 top-0 h-full w-1/2',
    top: 'top-0 left-0 w-full h-1/2',
    bottom: 'bottom-0 left-0 w-full h-1/2',
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed z-40 rounded-lg border-2 border-dashed border-primary bg-primary/10 transition-all ${sideClasses[side]}`}
    />
  );
}

// ---------------------------------------------------------------------------
// buildGridStyle — converts snap template + custom ratios to CSS Grid style
// ---------------------------------------------------------------------------

function buildGridStyle(
  templateId: string | undefined,
  customRatios: number[] | undefined,
): React.CSSProperties {
  const template = SNAP_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return { display: 'flex' };
  }

  const gridCols =
    customRatios && customRatios.length > 0
      ? customRatios.map((r) => `${r}fr`).join(' ')
      : template.gridCols;

  return {
    display: 'grid',
    gridTemplateColumns: gridCols,
    gridTemplateRows: template.gridRows,
    gap: '4px',
  };
}

// ---------------------------------------------------------------------------
// SplitPaneLayout (main export)
// ---------------------------------------------------------------------------

export interface SplitPaneLayoutProps {
  /** Slot render function — called with each panel's config */
  renderPanel?: (panel: PanelConfig) => ReactNode;
}

export function SplitPaneLayout({ renderPanel }: SplitPaneLayoutProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  const panels = useLayoutStore((s) => s.currentLayout.panels);
  const splitDirection = useLayoutStore((s) => s.currentLayout.splitDirection);
  const snapTemplateId = useLayoutStore((s) => s.currentLayout.snapTemplateId ?? 'single');
  const customRatios = useLayoutStore((s) => s.currentLayout.customRatios);
  const setCustomRatios = useLayoutStore((s) => s.setCustomRatios);
  const setDraggedPanel = useLayoutStore((s) => s.setDraggedPanel);
  const applyTemplate = useLayoutStore((s) => s.applySnapTemplate);
  const moveTab = useLayoutStore((s) => s.moveTab);

  // Local state for resize interaction
  const resizingIndex = useRef<number | null>(null);
  const resizeStartRatios = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for drag-to-snap edge detection
  const [snapEdge, setSnapEdge] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Drop target panel id for visual feedback
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // dnd-kit sensors -- include TouchSensor for tablet drag support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: MIN_DRAG_DISTANCE,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
  );

  // On mobile, render only the first panel in full-screen mode.
  // On tablet, force single-panel (no split) to maximize content area.
  if (isMobile || isTablet) {
    const firstPanel = panels[0];
    if (!firstPanel) return null;

    return (
      <div ref={containerRef} className="relative h-full w-full">
        <PanelSlot panelId={firstPanel.id} isDropTarget={false}>
          {renderPanel?.(firstPanel)}
        </PanelSlot>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Resize divider logic (pure pointer events — no dnd-kit)
  // -------------------------------------------------------------------------

  const handleResizeStart = useCallback(
    (index: number) => {
      resizingIndex.current = index;

      // Capture initial ratios from current panels or equal distribution
      const initialRatios = customRatios ?? panels.map(() => 1);
      resizeStartRatios.current = [...initialRatios];

      function onPointerMove(e: PointerEvent) {
        if (resizingIndex.current === null || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const i = resizingIndex.current;

        const totalRatio = resizeStartRatios.current.reduce((a, b) => a + b, 0);

        if (splitDirection === 'horizontal' || !splitDirection) {
          const totalWidth = rect.width;
          const relativeX = e.clientX - rect.left;
          const frac = relativeX / totalWidth;

          // Redistribute: left panel gets `frac` of total, right panel gets rest
          if (i === 0 && resizeStartRatios.current.length >= 2) {
            const leftFr = Math.max(0.5, frac * totalRatio);
            const rightFr = Math.max(0.5, totalRatio - leftFr);
            const updated = [...resizeStartRatios.current];
            updated[0] = leftFr;
            updated[1] = rightFr;
            setCustomRatios(updated);
          }
        } else {
          const totalHeight = rect.height;
          const relativeY = e.clientY - rect.top;
          const frac = relativeY / totalHeight;

          if (i === 0 && resizeStartRatios.current.length >= 2) {
            const topFr = Math.max(0.5, frac * totalRatio);
            const bottomFr = Math.max(0.5, totalRatio - topFr);
            const updated = [...resizeStartRatios.current];
            updated[0] = topFr;
            updated[1] = bottomFr;
            setCustomRatios(updated);
          }
        }
      }

      function onPointerUp() {
        resizingIndex.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [customRatios, panels, splitDirection, setCustomRatios],
  );

  // -------------------------------------------------------------------------
  // dnd-kit drag handlers for panel/tab rearrangement + snap-on-drag
  // -------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveDragId(id);
    setDraggedPanel(id);
    dragStartPos.current = null;
  }

  function handleDragMove(event: DragMoveEvent) {
    if (!containerRef.current) return;

    const { activatorEvent } = event;
    if (!(activatorEvent instanceof PointerEvent)) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = activatorEvent.clientX + (event.delta?.x ?? 0);
    const clientY = activatorEvent.clientY + (event.delta?.y ?? 0);

    if (!dragStartPos.current) {
      dragStartPos.current = { x: clientX, y: clientY };
      return;
    }

    const distFromStart = Math.hypot(
      clientX - dragStartPos.current.x,
      clientY - dragStartPos.current.y,
    );
    if (distFromStart < MIN_DRAG_DISTANCE) return;

    // Detect snap zone from position relative to container
    const fromLeft = clientX - rect.left;
    const fromRight = rect.right - clientX;
    const fromTop = clientY - rect.top;
    const fromBottom = rect.bottom - clientY;

    const min = Math.min(fromLeft, fromRight, fromTop, fromBottom);

    if (min > SNAP_EDGE_THRESHOLD) {
      setSnapEdge(null);
      return;
    }

    if (min === fromLeft) setSnapEdge('left');
    else if (min === fromRight) setSnapEdge('right');
    else if (min === fromTop) setSnapEdge('top');
    else setSnapEdge('bottom');

    // Highlight the target panel under the pointer
    const el = document.elementFromPoint(clientX, clientY);
    const panelEl = el?.closest('[data-panel-id]');
    if (panelEl) {
      setDropTargetPanelId(panelEl.getAttribute('data-panel-id'));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    // If dropped near an edge, apply a snap layout
    if (snapEdge) {
      const templateMap: Record<NonNullable<typeof snapEdge>, 'split-50-50' | 'split-50-50'> = {
        left: 'split-50-50',
        right: 'split-50-50',
        top: 'split-50-50',
        bottom: 'split-50-50',
      };
      applyTemplate(templateMap[snapEdge]);
      setSnapEdge(null);
    }

    // If dropped onto another panel, move the tab there
    if (overId && overId !== activeId) {
      moveTab(activeId, overId);
    }

    setActiveDragId(null);
    setDraggedPanel(null);
    setDropTargetPanelId(null);
    dragStartPos.current = null;
  }

  function handleDragCancel() {
    setActiveDragId(null);
    setDraggedPanel(null);
    setSnapEdge(null);
    setDropTargetPanelId(null);
    dragStartPos.current = null;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const template = SNAP_TEMPLATES.find((t) => t.id === snapTemplateId);
  const gridStyle = buildGridStyle(snapTemplateId, customRatios);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Snap edge visual feedback */}
      <SnapEdgeIndicator side={snapEdge} />

      {/* Snap picker — floating, receives no anchor position in this context */}
      <SnapLayoutPicker />

      <div ref={containerRef} className="relative h-full w-full" style={gridStyle}>
        {panels.map((panel, index) => {
          // Get CSS grid placement from template panel definitions
          const templatePanel = template?.panels[index];

          const cellStyle: React.CSSProperties = templatePanel
            ? {
                gridColumn: `${templatePanel.colStart} / ${templatePanel.colEnd}`,
                gridRow: `${templatePanel.rowStart} / ${templatePanel.rowEnd}`,
              }
            : {};

          return (
            <div
              key={panel.id}
              style={cellStyle}
              className="relative flex min-h-0 min-w-0 overflow-hidden"
            >
              <PanelSlot panelId={panel.id} isDropTarget={dropTargetPanelId === panel.id}>
                {renderPanel?.(panel)}
              </PanelSlot>

              {/* Resize divider — only between panels in a simple split layout */}
              {index < panels.length - 1 && template?.panels.length === 2 && (
                <ResizeDivider
                  direction={splitDirection ?? 'horizontal'}
                  index={index}
                  onResizeStart={handleResizeStart}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* DragOverlay — ghost panel while dragging */}
      <DragOverlay>
        {activeDragId && (
          <div className="h-32 w-48 rounded-lg border border-primary bg-primary/10 shadow-xl" />
        )}
      </DragOverlay>
    </DndContext>
  );
}
