'use client';

/**
 * DraggablePanel — accordion-style panel wrapper with drag-and-drop support.
 *
 * Each panel has:
 *   - A drag handle in the header (grab to reorder / move across sidebars)
 *   - An icon + title
 *   - A collapse/expand chevron toggle
 *   - Optional action buttons
 *   - Collapsible body area
 *
 * Uses @dnd-kit/sortable for reordering within a sidebar and cross-sidebar
 * moves. The panel adapts to the `collapsed` state from the sidebar store.
 *
 * Background uses bg-background to match the main workspace area.
 */

import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '@/shared/lib/utils';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { getPanelDefinition } from '../model/PanelRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraggablePanelProps {
  /** Panel type ID from the PanelRegistry. */
  panelId: string;
  /** Content to render inside the panel body. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// PanelIcon — renders the SVG icon from the panel definition
// ---------------------------------------------------------------------------

function PanelIcon({ iconPath }: { iconPath: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={iconPath} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DragHandle — the grip indicator on the left side of the header
// ---------------------------------------------------------------------------

function DragHandle({
  listeners,
  attributes,
}: {
  listeners: DraggableSyntheticListeners;
  attributes: React.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className="flex h-5 w-4 cursor-grab items-center justify-center rounded text-foreground-muted/50 hover:text-foreground-muted active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        {/* 6-dot grip icon */}
        <circle cx="5" cy="3" r="1.2" />
        <circle cx="11" cy="3" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="13" r="1.2" />
        <circle cx="11" cy="13" r="1.2" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CollapseChevron — expand/collapse toggle
// ---------------------------------------------------------------------------

function CollapseChevron({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-background-hover hover:text-foreground"
    >
      <svg
        viewBox="0 0 16 16"
        className={cn(
          'h-3 w-3 shrink-0 transition-transform duration-fast',
          collapsed ? 'rotate-0' : 'rotate-90',
        )}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DraggablePanel({ panelId, children }: DraggablePanelProps) {
  const definition = getPanelDefinition(panelId);
  const collapsed = useSidebarStore((s) => s.collapsedPanels[panelId] ?? false);
  const toggleCollapse = useSidebarStore((s) => s.togglePanelCollapse);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, over } =
    useSortable({
      id: panelId,
      data: {
        type: 'panel',
        panelId,
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!definition) {
    return null;
  }

  const isOverTarget = over?.id === panelId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border border-border bg-background transition-shadow',
        isDragging && 'z-50 opacity-50 shadow-floating',
        isOverTarget && !isDragging && 'ring-1 ring-primary/40',
      )}
      data-panel-id={panelId}
    >
      {/* Panel header */}
      <div
        className={cn('flex h-8 items-center gap-1 px-1.5', !collapsed && 'border-b border-border')}
      >
        {/* Drag handle */}
        <DragHandle listeners={listeners} attributes={attributes} />

        {/* Icon */}
        <PanelIcon iconPath={definition.iconPath} />

        {/* Title */}
        <span className="flex-1 truncate text-xs font-medium text-foreground select-none">
          {definition.title}
        </span>

        {/* Optional header action buttons */}
        {definition.headerActions?.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
            className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-background-hover hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
              <path d={action.iconPath} />
            </svg>
          </button>
        ))}

        {/* Collapse toggle */}
        <CollapseChevron collapsed={collapsed} onClick={() => toggleCollapse(panelId)} />
      </div>

      {/* Panel body (collapsible) */}
      {!collapsed && (
        <div className="overflow-y-auto p-2" style={{ maxHeight: '50vh' }}>
          {children}
        </div>
      )}
    </div>
  );
}
