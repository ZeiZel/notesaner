'use client';

/**
 * SidebarContainer — sidebar shell that hosts draggable/sortable panels.
 *
 * Wraps a set of panels (identified by IDs) in a @dnd-kit SortableContext,
 * allowing reordering within the sidebar and cross-sidebar moves via the
 * shared DndContext in WorkspaceShell.
 *
 * Features:
 *   - Vertical sortable list of accordion panels
 *   - Drop zone indicator when dragging over the sidebar
 *   - Empty state when all panels have been dragged away
 *   - Resize handle on the inner edge
 *   - Close button in the header
 *
 * The SidebarContainer does NOT own the DndContext -- that lives in
 * WorkspaceShell so it can coordinate cross-sidebar drags.
 */

import { type ReactNode, useCallback, useRef } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/shared/lib/utils';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { DraggablePanel } from './DraggablePanel';
import type { SidebarSide } from '../model/PanelRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarContainerProps {
  /** Which sidebar this is. */
  side: SidebarSide;
  /** Ordered array of panel IDs to render. */
  panelIds: string[];
  /** Width in pixels. */
  width: number;
  /** Whether to render as a fixed overlay (tablet mode). */
  overlay?: boolean;
  /** Called when the close button is clicked. */
  onClose: () => void;
  /** Called when the resize handle is dragged. */
  onResize: (newWidth: number) => void;
  /** Map of panel ID to React content. */
  panelContent: Record<string, ReactNode>;
  /** Whether a drag operation is currently in progress. */
  isDraggingActive?: boolean;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptySidebarState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8">
      <svg
        viewBox="0 0 16 16"
        className="h-6 w-6 text-sidebar-muted/40"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
        <path d="M9.5 1.5v2.75c0 .138.112.25.25.25h2.75L9.5 1.5z" />
      </svg>
      <p className="text-center text-xs text-sidebar-muted">Drag panels here</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

function ResizeHandle({
  side,
  onResize,
}: {
  side: SidebarSide;
  onResize: (newWidth: number) => void;
}) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      // Read the current width from the sidebar store
      const store = useSidebarStore.getState();
      startWidth.current = side === 'left' ? store.leftSidebarWidth : store.rightSidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = moveEvent.clientX - startX.current;
        const newWidth = side === 'left' ? startWidth.current + delta : startWidth.current - delta;
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [side, onResize],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-primary/30',
        side === 'left' ? 'right-0' : 'left-0',
      )}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} sidebar`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SidebarContainer({
  side,
  panelIds,
  width,
  overlay = false,
  onClose,
  onResize,
  panelContent,
  isDraggingActive = false,
}: SidebarContainerProps) {
  // Register this sidebar as a droppable area for cross-sidebar drops
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `sidebar-${side}`,
    data: {
      type: 'sidebar',
      side,
    },
  });

  const sidebarLabel = side === 'left' ? 'Left sidebar' : 'Right sidebar';
  const borderSide = side === 'left' ? 'border-r' : 'border-l';
  const positionClass = side === 'left' ? 'left-0' : 'right-0';

  return (
    <aside
      aria-label={sidebarLabel}
      data-state="open"
      data-side={side}
      style={overlay ? { width: `${width}px` } : { width: `${width}px`, minWidth: `${width}px` }}
      className={cn(
        'relative flex flex-col bg-sidebar-background overflow-hidden',
        borderSide,
        'border-sidebar-border',
        overlay
          ? `fixed ${positionClass} top-0 bottom-0 z-50 shadow-floating`
          : 'transition-[width,min-width] duration-slow',
      )}
    >
      {/* Resize handle */}
      <ResizeHandle side={side} onResize={onResize} />

      {/* Sidebar header */}
      <div className="flex h-9 items-center justify-between border-b border-sidebar-border px-2">
        <span className="text-xs font-medium text-sidebar-muted select-none">
          {side === 'left' ? 'Explorer' : 'Inspector'}
        </span>
        <button
          onClick={onClose}
          aria-label={`Close ${side} sidebar`}
          className="flex h-6 w-6 items-center justify-center rounded text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* Droppable panel area */}
      <div
        ref={setDroppableRef}
        className={cn(
          'flex-1 space-y-1 overflow-y-auto p-1.5 transition-colors',
          isDraggingActive && isOver && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
          isDraggingActive && !isOver && 'bg-transparent',
        )}
      >
        {panelIds.length === 0 ? (
          <EmptySidebarState />
        ) : (
          <SortableContext items={panelIds} strategy={verticalListSortingStrategy}>
            {panelIds.map((id) => (
              <DraggablePanel key={id} panelId={id}>
                {panelContent[id] ?? (
                  <div className="flex items-center justify-center py-4">
                    <p className="text-xs text-sidebar-muted">Panel content not available</p>
                  </div>
                )}
              </DraggablePanel>
            ))}
          </SortableContext>
        )}

        {/* Drop zone indicator when dragging but list is empty or at bottom */}
        {isDraggingActive && panelIds.length === 0 && isOver && (
          <div className="rounded-md border-2 border-dashed border-primary/30 p-4 text-center">
            <p className="text-xs text-primary/60">Drop panel here</p>
          </div>
        )}
      </div>
    </aside>
  );
}
