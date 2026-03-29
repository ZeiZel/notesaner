'use client';

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { cn } from '@/shared/lib/utils';
import { useRibbonStore, getVisibleActions, type RibbonAction } from '@/shared/stores/ribbon-store';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { ThemeToggle as ThemeToggleCycler } from '@/shared/lib/theme';
import { RibbonIcon } from './RibbonIcon';

// ---------------------------------------------------------------------------
// Action handlers — maps ribbon action IDs to callbacks
// ---------------------------------------------------------------------------

/**
 * Hook that builds the click handler map for built-in ribbon actions.
 * Each handler dispatches to the appropriate store action or navigation.
 */
function useRibbonHandlers(): Record<string, () => void> {
  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);

  return useMemo(
    () => ({
      'file-explorer': toggleLeftSidebar,
      search: () => {
        // Open the left sidebar with the search panel focused.
        // For now, toggle left sidebar as the search panel lives there.
        // A more granular approach (focusing the search panel) can be added later.
        toggleLeftSidebar();
      },
      'graph-view': () => {
        // Placeholder: navigate to graph view or open graph panel.
        // This will be wired to the graph feature when available.
        // TODO: wire to feature handler
        void '[Ribbon] Graph view action triggered';
      },
      'daily-note': () => {
        // Placeholder: create or navigate to today's daily note.
        // TODO: wire to feature handler
        void '[Ribbon] Daily note action triggered';
      },
      'new-note': () => {
        // Placeholder: create a new note.
        // Will be wired to the note creation feature.
        // TODO: wire to feature handler
        void '[Ribbon] New note action triggered';
      },
    }),
    [toggleLeftSidebar],
  );
}

// ---------------------------------------------------------------------------
// Active state derivation for toggle actions
// ---------------------------------------------------------------------------

function useToggleStates(): Record<string, boolean> {
  const leftSidebarOpen = useSidebarStore((s) => s.leftSidebarOpen);
  const pluginToggles = useRibbonStore((s) => s.pluginToggles);

  return useMemo(
    () => ({
      'file-explorer': leftSidebarOpen,
      ...pluginToggles,
    }),
    [leftSidebarOpen, pluginToggles],
  );
}

// ---------------------------------------------------------------------------
// Ribbon component
// ---------------------------------------------------------------------------

export function Ribbon() {
  const order = useRibbonStore((s) => s.order);
  const hiddenIds = useRibbonStore((s) => s.hiddenIds);
  const pluginActions = useRibbonStore((s) => s.pluginActions);
  const reorder = useRibbonStore((s) => s.reorder);

  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';

  const handlers = useRibbonHandlers();
  const toggleStates = useToggleStates();

  // Compute visible actions (derived during render -- no useEffect)
  const visibleActions = getVisibleActions(order, hiddenIds, pluginActions);

  // DnD sensors with activation constraint to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const overId = String(over.id);
      const overIndex = visibleActions.findIndex((a) => a.id === overId);
      if (overIndex >= 0) {
        reorder(String(active.id), overIndex);
      }
    },
    [visibleActions, reorder],
  );

  const handleActionClick = useCallback(
    (action: RibbonAction) => {
      const handler = handlers[action.id];
      if (handler) {
        handler();
      }
    },
    [handlers],
  );

  // Mobile: ribbon is hidden (bottom nav takes over)
  if (isMobile) return null;

  // No visible actions: don't render the ribbon at all
  if (visibleActions.length === 0) return null;

  const sortableIds = visibleActions.map((a) => a.id);

  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        'flex w-[44px] shrink-0 flex-col items-center',
        'border-r border-border bg-background-surface',
        'py-2',
      )}
    >
      {/* Top: sortable action icons */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        /* Drag constrained to vertical via verticalListSortingStrategy */
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col items-center gap-1">
            {visibleActions.map((action) => (
              <RibbonIcon
                key={action.id}
                action={action}
                isActive={toggleStates[action.id] ?? false}
                onClick={() => handleActionClick(action)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Bottom: compact cycling theme toggle pinned to ribbon footer */}
      <div className="mt-auto pt-2">
        <ThemeToggleCycler />
      </div>
    </nav>
  );
}
