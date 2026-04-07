'use client';

import { type ReactNode, useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { KeyboardShortcutsProvider } from '@/shared/lib/providers/KeyboardShortcutsProvider';
import { useLayoutStore } from '@/shared/stores/layout-store';
import { useSnapLayout } from '@/features/workspace/lib/useSnapLayout';
import { SnapLayoutPicker } from '@/features/workspace/ui/SnapLayoutPicker';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useSwipeGesture } from '@/shared/hooks/useSwipeGesture';
import { MobileBottomNav, type MobileNavTab } from '@/features/workspace/ui/MobileBottomNav';
import { NavigationButtons } from '@/features/workspace/ui/NavigationButtons';
import { StatusBar } from '@/features/workspace/ui/StatusBar';
import { LayoutPresetManager } from '@/features/workspace/ui/LayoutPresetManager';
import { useLayoutPersistence } from '@/features/workspace/lib/useLayoutPersistence';
import { SidebarContainer } from '@/features/workspace/ui/SidebarContainer';
import { getPanelDefinition } from '@/features/workspace/model/PanelRegistry';
import { preloadGraph, preloadSettings, preloadPluginBrowser } from '@/shared/lib/lazy-components';
import { announceToScreenReader } from '@/shared/lib/a11y';
import { OfflineFallback } from '@/shared/ui/OfflineFallback';
import { TabBar } from '@/widgets/tab-bar';
import { Ribbon } from '@/widgets/ribbon';
import { NotificationBell, useNotificationWebSocket } from '@/features/notifications';
import { FavoritesPanel, useFavoriteShortcut } from '@/features/favorites';
import { ThemeToggle } from '@/features/settings';

interface WorkspaceShellProps {
  children: ReactNode;
}

/**
 * WorkspaceShell -- the responsive application layout.
 *
 * Desktop (>1024px):
 *   +--------+--------------------+---------------------------+-----------------+
 *   | Ribbon | Left Sidebar       | Main Content Area         | Right Sidebar   |
 *   | 44px   | 260px (resizable)  | flex-1                    | 280px (resize)  |
 *   +--------+--------------------+---------------------------+-----------------+
 *
 * Both sidebars are ALWAYS visible on desktop. They start EMPTY and users
 * drag widget panels into them. The sidebars fill their full allocated
 * width and height.
 *
 * Tablet (640-1024px):
 *   Ribbon visible, sidebars open as overlays. Single content pane by default.
 *
 * Mobile (<640px):
 *   Ribbon hidden (replaced by bottom nav). Full-screen single pane.
 */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  // Register Cmd+Shift+L shortcut for snap layout picker
  useSnapLayout();

  // Register Cmd+Shift+B shortcut for toggling favorite
  useFavoriteShortcut();

  // Connect to the notification WebSocket for real-time push events
  useNotificationWebSocket();

  // Layout persistence: auto-save changes, restore on login
  useLayoutPersistence();

  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';

  const leftSidebarOpen = useSidebarStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useSidebarStore((s) => s.rightSidebarOpen);
  const leftSidebarWidth = useSidebarStore((s) => s.leftSidebarWidth);
  const rightSidebarWidth = useSidebarStore((s) => s.rightSidebarWidth);
  const leftPanels = useSidebarStore((s) => s.leftPanels);
  const rightPanels = useSidebarStore((s) => s.rightPanels);
  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useSidebarStore((s) => s.toggleRightSidebar);
  const setLeftSidebarOpen = useSidebarStore((s) => s.setLeftSidebarOpen);
  const setRightSidebarOpen = useSidebarStore((s) => s.setRightSidebarOpen);
  const setLeftSidebarWidth = useSidebarStore((s) => s.setLeftSidebarWidth);
  const setRightSidebarWidth = useSidebarStore((s) => s.setRightSidebarWidth);
  const movePanel = useSidebarStore((s) => s.movePanel);
  const reorderPanel = useSidebarStore((s) => s.reorderPanel);

  // Mobile bottom nav tab state
  const [mobileTab, setMobileTab] = useState<MobileNavTab>('editor');

  // DnD active state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // -- DnD sensors --
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // -- DnD handlers --
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Determine the sidebar of the active item
      const activeInLeft = leftPanels.includes(activeId);
      const activeSide = activeInLeft ? 'left' : 'right';

      // Determine the sidebar of the drop target
      let overSide: 'left' | 'right';
      if (overId === 'sidebar-left') {
        overSide = 'left';
      } else if (overId === 'sidebar-right') {
        overSide = 'right';
      } else {
        const overInLeft = leftPanels.includes(overId);
        overSide = overInLeft ? 'left' : 'right';
      }

      // If the active item is being dragged to a different sidebar, move it
      if (activeSide !== overSide) {
        const targetPanels = overSide === 'left' ? leftPanels : rightPanels;
        const overIndex = targetPanels.indexOf(overId);
        const insertIndex = overIndex >= 0 ? overIndex : targetPanels.length;
        movePanel(activeId, overSide, insertIndex);
      }
    },
    [leftPanels, rightPanels, movePanel],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId === overId) return;

      // Skip if over a sidebar droppable (already handled in dragOver)
      if (overId === 'sidebar-left' || overId === 'sidebar-right') return;

      // Both items are now in the same sidebar (dragOver moved cross-sidebar)
      const inLeft = leftPanels.includes(activeId);
      const panels = inLeft ? leftPanels : rightPanels;
      const overIndex = panels.indexOf(overId);

      if (overIndex >= 0) {
        reorderPanel(activeId, overIndex);
      }

      // Announce the drop to screen readers
      const definition = getPanelDefinition(activeId);
      if (definition) {
        const sideLabel = inLeft ? 'left' : 'right';
        announceToScreenReader(`${definition.title} panel moved to ${sideLabel} sidebar`);
      }
    },
    [leftPanels, rightPanels, reorderPanel],
  );

  // Swipe gesture handling for tablet/mobile sidebar toggle
  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      if (isMobile) return; // Mobile uses bottom nav, not swipe-to-sidebar

      if (direction === 'right' && !leftSidebarOpen) {
        setLeftSidebarOpen(true);
      } else if (direction === 'left' && leftSidebarOpen && isTablet) {
        setLeftSidebarOpen(false);
      } else if (direction === 'left' && !rightSidebarOpen) {
        setRightSidebarOpen(true);
      } else if (direction === 'right' && rightSidebarOpen && isTablet) {
        setRightSidebarOpen(false);
      }
    },
    [
      isMobile,
      isTablet,
      leftSidebarOpen,
      rightSidebarOpen,
      setLeftSidebarOpen,
      setRightSidebarOpen,
    ],
  );

  const swipeHandlers = useSwipeGesture({
    onSwipe: handleSwipe,
    directions: ['left', 'right'],
    threshold: 60,
  });

  // Handle mobile tab change -- maps bottom nav to sidebar/content panels
  const handleMobileTabChange = useCallback(
    (tab: MobileNavTab) => {
      setMobileTab(tab);
      // Close any open sidebars when switching mobile tabs
      if (leftSidebarOpen) setLeftSidebarOpen(false);
      if (rightSidebarOpen) setRightSidebarOpen(false);
      // Announce the tab change to screen readers
      const tabLabels: Record<MobileNavTab, string> = {
        files: 'Files panel',
        editor: 'Editor',
        search: 'Search panel',
        outline: 'Outline panel',
        more: 'More options',
      };
      announceToScreenReader(`Switched to ${tabLabels[tab]}`);
    },
    [leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen],
  );

  // -- Panel content map --
  const panelContent = useMemo<Record<string, ReactNode>>(
    () => ({
      files: <FileExplorerPlaceholder />,
      search: <SearchPanelPlaceholder />,
      bookmarks: <FavoritesPanel />,
      tags: <EmptyPanelState label="No tags yet" />,
      outline: <EmptyPanelState label="Open a note to see its outline" />,
      backlinks: <EmptyPanelState label="Open a note to see backlinks" />,
      properties: <EmptyPanelState label="Open a note to see properties" />,
      comments: <EmptyPanelState label="Open a note to see comments" />,
    }),
    [],
  );

  // -- Derived booleans for sidebar rendering --

  // On tablet, sidebars render as overlay panels (fixed position)
  const sidebarAsOverlay = isTablet;

  // On desktop: sidebars are ALWAYS visible at full width/height
  // On tablet: sidebars show/hide as overlays
  // On mobile: sidebars are not rendered (bottom nav replaces them)
  const showLeftSidebar = isDesktop || (isTablet && leftSidebarOpen);
  const showRightSidebar = isDesktop || (isTablet && rightSidebarOpen);
  const showBottomNav = isMobile;
  const showStatusBar = !isMobile;
  const showToolbar = !isMobile;

  // Active drag panel definition (for DragOverlay ghost)
  const activeDragDefinition = activeDragId ? getPanelDefinition(activeDragId) : null;

  return (
    <KeyboardShortcutsProvider>
      <OfflineFallback>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-dvh w-screen overflow-hidden bg-background" {...swipeHandlers}>
            {/* ---- Tablet sidebar overlay backdrop ---- */}
            {sidebarAsOverlay && (showLeftSidebar || showRightSidebar) && (
              <div
                className="sidebar-overlay"
                aria-hidden="true"
                onClick={() => {
                  if (leftSidebarOpen) setLeftSidebarOpen(false);
                  if (rightSidebarOpen) setRightSidebarOpen(false);
                }}
              />
            )}

            {/* ---- Ribbon (quick-action icon strip) ---- */}
            <Ribbon />

            {/* ---- Left Sidebar (always visible on desktop) ---- */}
            {showLeftSidebar && (
              <SidebarContainer
                side="left"
                panelIds={leftPanels}
                width={leftSidebarWidth}
                overlay={sidebarAsOverlay}
                onClose={toggleLeftSidebar}
                onResize={setLeftSidebarWidth}
                panelContent={panelContent}
                isDraggingActive={activeDragId !== null}
              />
            )}

            {/* ---- Main content area ---- */}
            <main
              id="main-content"
              tabIndex={-1}
              className={[
                'flex flex-1 flex-col overflow-hidden bg-background',
                isMobile ? 'pb-14' : '', // Leave room for bottom nav
              ].join(' ')}
            >
              {/* Global tab bar — desktop/tablet only */}
              {showToolbar && <TabBar />}

              {/* Desktop/Tablet Toolbar */}
              {showToolbar && (
                <header
                  role="banner"
                  className="flex h-9 items-center border-b border-border bg-background-surface px-2"
                >
                  {/* Navigation back/forward buttons */}
                  <NavigationButtons />

                  <span className="ml-1 text-xs text-foreground-muted">No file open</span>
                  <div className="ml-auto flex items-center gap-1">
                    {/* Notification bell */}
                    <NotificationBell />

                    {/* Theme toggle -- compact three-way segmented control */}
                    <ThemeToggle variant="compact" size="small" />

                    {/* Layout preset manager */}
                    {isDesktop && <LayoutPresetButton />}

                    {/* Snap layout picker toggle -- hidden on tablet (no split panes) */}
                    {isDesktop && <SnapLayoutButton />}
                  </div>

                  {/* Floating snap layout picker (keyboard-triggered, no anchor) */}
                  {isDesktop && <SnapLayoutPicker />}
                </header>
              )}

              {/* Mobile: show content based on active tab */}
              {isMobile ? (
                <div className="flex-1 overflow-auto">
                  {mobileTab === 'editor' && children}
                  {mobileTab === 'files' && (
                    <div className="p-3">
                      <FileExplorerPlaceholder />
                    </div>
                  )}
                  {mobileTab === 'search' && (
                    <div className="p-3">
                      <SearchPanelPlaceholder />
                    </div>
                  )}
                  {mobileTab === 'outline' && (
                    <div className="p-3">
                      <EmptyPanelState label="Open a note to see its outline" />
                    </div>
                  )}
                  {mobileTab === 'more' && (
                    <div className="space-y-2 p-3">
                      <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
                      <MobileMoreMenu />
                    </div>
                  )}
                </div>
              ) : (
                /* Desktop/Tablet: normal page content */
                <div className="flex-1 overflow-auto">{children}</div>
              )}

              {/* Status bar -- desktop/tablet only */}
              {showStatusBar && <StatusBar />}
            </main>

            {/* ---- Right Sidebar (always visible on desktop) ---- */}
            {showRightSidebar && (
              <SidebarContainer
                side="right"
                panelIds={rightPanels}
                width={rightSidebarWidth}
                overlay={sidebarAsOverlay}
                onClose={toggleRightSidebar}
                onResize={setRightSidebarWidth}
                panelContent={panelContent}
                isDraggingActive={activeDragId !== null}
              />
            )}

            {/* ---- Mobile Bottom Navigation ---- */}
            {showBottomNav && (
              <MobileBottomNav activeTab={mobileTab} onTabChange={handleMobileTabChange} />
            )}
          </div>

          {/* ---- Drag overlay (ghost following cursor) ---- */}
          <DragOverlay>
            {activeDragDefinition ? (
              <div className="w-48 rounded-md border border-primary/30 bg-background px-3 py-2 shadow-floating">
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d={activeDragDefinition.iconPath} />
                  </svg>
                  <span className="text-xs font-medium text-foreground">
                    {activeDragDefinition.title}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </OfflineFallback>
    </KeyboardShortcutsProvider>
  );
}

// --- Layout Preset toolbar button ---

function LayoutPresetButton() {
  const [isPresetOpen, setIsPresetOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsPresetOpen((prev) => !prev)}
        aria-label="Layout presets"
        aria-pressed={isPresetOpen}
        title="Layout presets"
        className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M11.5 1h-7A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0011.5 1zM5 2h6v3H5V2zm6 12H5V9h6v5z" />
        </svg>
      </button>
      <LayoutPresetManager isOpen={isPresetOpen} onClose={() => setIsPresetOpen(false)} />
    </div>
  );
}

// --- Snap layout toolbar button ---

function SnapLayoutButton() {
  const isOpen = useLayoutStore((s) => s.isSnapPickerOpen);
  const setOpen = useLayoutStore((s) => s.setSnapPickerOpen);
  const currentTemplateId = useLayoutStore((s) => s.currentLayout.snapTemplateId ?? 'single');

  return (
    <button
      onClick={() => setOpen(!isOpen)}
      aria-label="Snap layout picker"
      aria-pressed={isOpen}
      title="Snap layout picker (Cmd+Shift+L)"
      className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
    >
      {/* Icon: grid squares layout icon -- matches current template */}
      {currentTemplateId === 'split-50-50' ||
      currentTemplateId === 'split-70-30' ||
      currentTemplateId === 'split-30-70' ||
      currentTemplateId === 'main-sidebar-right' ||
      currentTemplateId === 'main-sidebar-left' ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M2 2h5v12H2V2zm7 0h5v12H9V2z" />
        </svg>
      ) : currentTemplateId === 'three-columns' ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M1 2h4v12H1V2zm5 0h4v12H6V2zm5 0h4v12h-4V2z" />
        </svg>
      ) : currentTemplateId === 'two-x-two' ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
        </svg>
      ) : currentTemplateId === 'main-plus-two' ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M2 2h7v12H2V2zm9 0h3v5h-3V2zm0 7h3v5h-3V9z" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M2 2h12v12H2V2z" />
        </svg>
      )}
    </button>
  );
}

// --- Mobile "More" menu placeholder ---

function MobileMoreMenu() {
  const items = [
    { label: 'Bookmarks', desc: 'View saved notes', preload: undefined },
    { label: 'Tags', desc: 'Browse by tag', preload: undefined },
    { label: 'Graph view', desc: 'Visualize connections', preload: preloadGraph },
    { label: 'Settings', desc: 'App preferences', preload: preloadSettings },
    { label: 'Plugins', desc: 'Browse and manage plugins', preload: preloadPluginBrowser },
  ] as const;

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.label}
          className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-secondary touch-target"
          {...(item.preload ?? {})}
        >
          <div>
            <div className="text-sm font-medium text-foreground">{item.label}</div>
            <div className="text-xs text-foreground-muted">{item.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// --- Placeholder sub-components ---

function FileExplorerPlaceholder() {
  return (
    <div className="space-y-0.5">
      {/* Workspace header */}
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        <span>My Workspace</span>
      </div>

      {/* Stub folders */}
      {['Getting Started', 'Projects', 'Daily Notes', 'Archive'].map((folder) => (
        <button
          key={folder}
          className="flex w-full items-center gap-1.5 rounded-sm px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-hover sm:py-1"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
          </svg>
          {folder}
        </button>
      ))}

      {/* New note button */}
      <div className="pt-2">
        <button className="flex w-full items-center gap-1.5 rounded-sm px-2 py-2 text-left text-xs text-foreground-muted transition-colors hover:bg-background-hover hover:text-foreground sm:py-1">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          New note
        </button>
      </div>
    </div>
  );
}

function SearchPanelPlaceholder() {
  return (
    <div className="space-y-2" role="search" aria-label="Search notes">
      <label htmlFor="search-panel-placeholder" className="sr-only">
        Search notes
      </label>
      <input
        id="search-panel-placeholder"
        type="search"
        placeholder="Search notes..."
        aria-label="Search notes"
        className="w-full rounded-sm border border-border bg-background-input px-3 py-2.5 text-base text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:px-2 sm:py-1.5 sm:text-sm"
      />
      <p className="px-2 text-xs text-foreground-muted">Type to search across all notes.</p>
    </div>
  );
}

function EmptyPanelState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center py-8">
      <p className="text-xs text-foreground-muted">{label}</p>
    </div>
  );
}
