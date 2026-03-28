/**
 * Ribbon.tsx
 *
 * Vertical ribbon/sidebar with quick-action icons, inspired by Obsidian's
 * left ribbon strip.
 *
 * Features:
 *   - New note, search, file explorer toggle, graph view, settings, help
 *   - Tooltip on hover (via title attribute for simplicity)
 *   - Active state highlighting for the current view
 *   - Collapsible/expandable via a toggle at the bottom
 *   - Keyboard accessible
 *
 * Design notes:
 *   - Uses lucide-react for all icons.
 *   - Active view is derived from sidebar store state (no useEffect).
 *   - Ribbon width is fixed at 40px when expanded, collapses to 0.
 *   - State (expanded/collapsed) is stored in the ribbon itself via zustand persist.
 */

'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  FilePlus2,
  Search,
  FolderOpen,
  GitFork,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useSidebarStore } from '@/shared/stores/sidebar-store';

// ---------------------------------------------------------------------------
// Ribbon Store (local to this feature)
// ---------------------------------------------------------------------------

interface RibbonState {
  /** Whether the ribbon strip is expanded (visible). */
  isExpanded: boolean;
  /** Currently active ribbon action (for highlighting). */
  activeAction: string | null;
  /** Toggle ribbon visibility. */
  toggleExpanded: () => void;
  /** Set the active action. */
  setActiveAction: (action: string | null) => void;
}

export const useRibbonStore = create<RibbonState>()(
  devtools(
    persist(
      (set) => ({
        isExpanded: true,
        activeAction: null,
        toggleExpanded: () =>
          set((state) => ({ isExpanded: !state.isExpanded }), false, 'ribbon/toggleExpanded'),
        setActiveAction: (action) => set({ activeAction: action }, false, 'ribbon/setActiveAction'),
      }),
      {
        name: 'notesaner-ribbon',
        partialize: (state) => ({ isExpanded: state.isExpanded }),
      },
    ),
    { name: 'RibbonStore' },
  ),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RibbonAction {
  /** Unique identifier for the action. */
  id: string;
  /** Accessible label / tooltip text. */
  label: string;
  /** Lucide icon component. */
  icon: React.ComponentType<{ className?: string }>;
  /** Click handler. */
  onClick: () => void;
  /** Whether this action represents a toggle (shows pressed state). */
  isToggle?: boolean;
  /** Whether this toggle is currently active. */
  isActive?: boolean;
  /** Visual separator above this item. */
  separatorBefore?: boolean;
}

// ---------------------------------------------------------------------------
// Ribbon Button
// ---------------------------------------------------------------------------

function RibbonButton({ action }: { action: RibbonAction }) {
  const Icon = action.icon;

  return (
    <>
      {action.separatorBefore && (
        <div className="mx-auto my-1 h-px w-5 bg-border" aria-hidden="true" />
      )}
      <button
        onClick={action.onClick}
        title={action.label}
        aria-label={action.label}
        aria-pressed={action.isToggle ? action.isActive : undefined}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors',
          'hover:bg-secondary hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          action.isActive && 'bg-secondary text-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Ribbon Component
// ---------------------------------------------------------------------------

export function Ribbon() {
  const isExpanded = useRibbonStore((s) => s.isExpanded);
  const toggleExpanded = useRibbonStore((s) => s.toggleExpanded);
  const activeAction = useRibbonStore((s) => s.activeAction);
  const setActiveAction = useRibbonStore((s) => s.setActiveAction);

  const leftSidebarOpen = useSidebarStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);

  // Action handlers
  const handleNewNote = useCallback(() => {
    setActiveAction('new-note');
    // TODO: Integrate with note creation flow when available
  }, [setActiveAction]);

  const handleSearch = useCallback(() => {
    setActiveAction('search');
    // TODO: Open command palette or search panel
  }, [setActiveAction]);

  const handleToggleExplorer = useCallback(() => {
    toggleLeftSidebar();
  }, [toggleLeftSidebar]);

  const handleGraphView = useCallback(() => {
    setActiveAction('graph');
    // TODO: Navigate to graph view when available
  }, [setActiveAction]);

  const handleSettings = useCallback(() => {
    setActiveAction('settings');
    // TODO: Navigate to settings when available
  }, [setActiveAction]);

  const handleHelp = useCallback(() => {
    setActiveAction('help');
    // TODO: Open help panel/modal when available
  }, [setActiveAction]);

  // Build action list -- derived at render time, no state sync needed
  const topActions: RibbonAction[] = [
    {
      id: 'new-note',
      label: 'New note',
      icon: FilePlus2,
      onClick: handleNewNote,
      isActive: activeAction === 'new-note',
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      onClick: handleSearch,
      isActive: activeAction === 'search',
    },
    {
      id: 'explorer',
      label: leftSidebarOpen ? 'Hide file explorer' : 'Show file explorer',
      icon: FolderOpen,
      onClick: handleToggleExplorer,
      isToggle: true,
      isActive: leftSidebarOpen,
    },
    {
      id: 'graph',
      label: 'Graph view',
      icon: GitFork,
      onClick: handleGraphView,
      isActive: activeAction === 'graph',
    },
  ];

  const bottomActions: RibbonAction[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: handleSettings,
      isActive: activeAction === 'settings',
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      onClick: handleHelp,
      isActive: activeAction === 'help',
    },
  ];

  if (!isExpanded) {
    // Collapsed state: just show a small expand button
    return (
      <div className="flex h-full w-0 flex-col items-center overflow-hidden">
        {/* The toggle button is rendered outside/overlapping by the parent shell */}
      </div>
    );
  }

  return (
    <nav
      aria-label="Quick actions ribbon"
      className="flex h-full w-10 shrink-0 flex-col items-center border-r border-border bg-background-surface py-2"
    >
      {/* Top section: primary actions */}
      <div className="flex flex-col items-center gap-1">
        {topActions.map((action) => (
          <RibbonButton key={action.id} action={action} />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section: utility actions */}
      <div className="flex flex-col items-center gap-1">
        {bottomActions.map((action) => (
          <RibbonButton key={action.id} action={action} />
        ))}

        {/* Separator before collapse toggle */}
        <div className="mx-auto my-1 h-px w-5 bg-border" aria-hidden="true" />

        {/* Collapse/expand toggle */}
        <button
          onClick={toggleExpanded}
          title={isExpanded ? 'Collapse ribbon' : 'Expand ribbon'}
          aria-label={isExpanded ? 'Collapse ribbon' : 'Expand ribbon'}
          aria-expanded={isExpanded}
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {isExpanded ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
      </div>
    </nav>
  );
}

/**
 * Small floating button to expand the ribbon when it's collapsed.
 * Rendered by the parent layout.
 */
export function RibbonExpandButton() {
  const isExpanded = useRibbonStore((s) => s.isExpanded);
  const toggleExpanded = useRibbonStore((s) => s.toggleExpanded);

  if (isExpanded) return null;

  return (
    <button
      onClick={toggleExpanded}
      title="Expand ribbon"
      aria-label="Expand ribbon"
      className="fixed left-0 top-1/2 z-30 -translate-y-1/2 rounded-r-md border border-l-0 border-border bg-background-surface p-1 text-foreground-muted shadow-sm transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <PanelLeftOpen className="h-4 w-4" />
    </button>
  );
}
