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
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { useRibbonStore, getVisibleActions, type RibbonAction } from '@/shared/stores/ribbon-store';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useTabStore } from '@/shared/stores/tab-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { ThemeToggle as ThemeToggleCycler } from '@/shared/lib/theme';
import { notesApi } from '@/shared/api/notes';
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
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const openTab = useTabStore((s) => s.openTab);
  const router = useRouter();

  return useMemo(
    () => ({
      'file-explorer': toggleLeftSidebar,
      search: () => {
        // Open the left sidebar with the search panel focused.
        toggleLeftSidebar();
      },
      'graph-view': () => {
        if (activeWorkspaceId) {
          router.push(`/workspaces/${activeWorkspaceId}/graph`);
        }
      },
      'daily-note': () => {
        // Create or navigate to today's daily note
        if (!activeWorkspaceId || !accessToken) return;

        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const title = `Daily Note ${dateStr}`;
        const path = `Daily Notes/${dateStr}.md`;

        // Open a tab for the daily note, then create it via API
        const noteId = `daily-${dateStr}`;
        openTab({ noteId, title, path });

        // Attempt to create the note on the server (ignore if already exists)
        void notesApi
          .create(accessToken, activeWorkspaceId, {
            path,
            title,
            content: `# ${title}\n\n`,
          })
          .catch(() => {
            // Note may already exist -- that's fine
          });

        router.push(`/workspaces/${activeWorkspaceId}/notes/${noteId}`);
      },
      'new-note': () => {
        if (!activeWorkspaceId || !accessToken) return;

        const timestamp = Date.now();
        const title = 'Untitled';
        const path = `Untitled-${timestamp}.md`;

        // Create the note via API and open it
        void notesApi
          .create(accessToken, activeWorkspaceId, {
            path,
            title,
            content: '',
          })
          .then((note) => {
            openTab({ noteId: note.id, title: note.title, path: note.path });
            router.push(`/workspaces/${activeWorkspaceId}/notes/${note.id}`);
          })
          .catch(() => {
            // Fallback: open a local untitled tab
            const fallbackId = `untitled-${timestamp}`;
            openTab({ noteId: fallbackId, title, path });
          });
      },
    }),
    [toggleLeftSidebar, activeWorkspaceId, accessToken, openTab, router],
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
