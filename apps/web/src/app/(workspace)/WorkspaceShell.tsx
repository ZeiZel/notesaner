'use client';

import { type ReactNode } from 'react';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useLayoutStore } from '@/shared/stores/layout-store';
import { useSnapLayout } from '@/features/workspace/useSnapLayout';
import { SnapLayoutPicker } from '@/features/workspace/SnapLayoutPicker';

interface WorkspaceShellProps {
  children: ReactNode;
}

/**
 * WorkspaceShell — the three-panel application layout.
 *
 * Structure:
 *   +--------------------+---------------------------+-----------------+
 *   | Left Sidebar       | Main Content Area         | Right Sidebar   |
 *   | 260px (resizable)  | flex-1                    | 280px (toggle)  |
 *   +--------------------+---------------------------+-----------------+
 *
 * Panel visibility and widths are persisted in the sidebar Zustand store.
 */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  // Register Cmd+Shift+L shortcut for snap layout picker
  useSnapLayout();

  const leftSidebarOpen = useSidebarStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useSidebarStore((s) => s.rightSidebarOpen);
  const leftSidebarWidth = useSidebarStore((s) => s.leftSidebarWidth);
  const rightSidebarWidth = useSidebarStore((s) => s.rightSidebarWidth);
  const leftActiveTab = useSidebarStore((s) => s.leftActiveTab);
  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useSidebarStore((s) => s.toggleRightSidebar);
  const setLeftTab = useSidebarStore((s) => s.setLeftTab);
  const setRightTab = useSidebarStore((s) => s.setRightTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <aside
        aria-label="File explorer"
        data-state={leftSidebarOpen ? 'open' : 'closed'}
        style={{
          width: leftSidebarOpen ? `${leftSidebarWidth}px` : '0px',
          minWidth: leftSidebarOpen ? `${leftSidebarWidth}px` : '0px',
        }}
        className="flex flex-col border-r border-sidebar-border bg-sidebar-background transition-[width,min-width] duration-slow overflow-hidden"
      >
        {leftSidebarOpen && (
          <>
            {/* Sidebar header */}
            <div className="flex h-10 items-center justify-between border-b border-sidebar-border px-3">
              <div className="flex items-center gap-1">
                {/* Tab buttons */}
                {(
                  [
                    { id: 'files', label: 'Files', icon: '📁' },
                    { id: 'search', label: 'Search', icon: '🔍' },
                    { id: 'bookmarks', label: 'Bookmarks', icon: '🔖' },
                    { id: 'tags', label: 'Tags', icon: '🏷️' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    title={tab.label}
                    aria-label={tab.label}
                    aria-pressed={leftActiveTab === tab.id}
                    onClick={() => setLeftTab(tab.id)}
                    className="flex h-6 w-6 items-center justify-center rounded text-xs transition-colors hover:bg-sidebar-accent aria-pressed:bg-sidebar-accent"
                  >
                    {tab.icon}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleLeftSidebar}
                aria-label="Close sidebar"
                className="flex h-6 w-6 items-center justify-center rounded text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M9.293 2.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L11.586 9H3a1 1 0 010-2h8.586L9.293 3.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>

            {/* Sidebar content area */}
            <div className="flex-1 overflow-y-auto p-2">
              {leftActiveTab === 'files' && <FileExplorerPlaceholder />}
              {leftActiveTab === 'search' && <SearchPanelPlaceholder />}
              {leftActiveTab === 'bookmarks' && (
                <EmptyPanelState label="No bookmarks yet" />
              )}
              {leftActiveTab === 'tags' && (
                <EmptyPanelState label="No tags yet" />
              )}
            </div>
          </>
        )}
      </aside>

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Toolbar / tab bar placeholder */}
        <div className="flex h-9 items-center border-b border-border bg-background-surface px-2">
          {/* Toggle left sidebar when closed */}
          {!leftSidebarOpen && (
            <button
              onClick={toggleLeftSidebar}
              aria-label="Open file explorer"
              className="mr-2 flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M3 4.5A1.5 1.5 0 014.5 3h7A1.5 1.5 0 0113 4.5v7A1.5 1.5 0 0111.5 13h-7A1.5 1.5 0 013 11.5v-7zM4.5 4a.5.5 0 00-.5.5v7a.5.5 0 00.5.5H7V4H4.5zm3.5 8h3.5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5H8v8z" />
              </svg>
            </button>
          )}
          <span className="text-xs text-foreground-muted">No file open</span>
          <div className="ml-auto flex items-center gap-1">
            {/* Snap layout picker toggle */}
            <SnapLayoutButton />

            <button
              onClick={toggleRightSidebar}
              aria-label="Toggle right sidebar"
              aria-pressed={rightSidebarOpen}
              className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M3 4.5A1.5 1.5 0 014.5 3h7A1.5 1.5 0 0113 4.5v7A1.5 1.5 0 0111.5 13h-7A1.5 1.5 0 013 11.5v-7zM4.5 4a.5.5 0 00-.5.5v7a.5.5 0 00.5.5H7V4H4.5zm3.5 8h3.5a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5H8v8z" />
              </svg>
            </button>
          </div>

          {/* Floating snap layout picker (keyboard-triggered, no anchor) */}
          <SnapLayoutPicker />
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">{children}</div>

        {/* Status bar */}
        <footer className="flex h-6 items-center border-t border-border bg-background-surface px-3 text-foreground-muted" style={{ fontSize: 'var(--ns-text-2xs)' }}>
          <span className="mr-4">Notesaner</span>
          <span className="ml-auto">Ready</span>
        </footer>
      </main>

      {/* Right Sidebar */}
      {rightSidebarOpen && (
        <aside
          aria-label="Note outline and backlinks"
          style={{ width: `${rightSidebarWidth}px`, minWidth: `${rightSidebarWidth}px` }}
          className="flex flex-col border-l border-sidebar-border bg-sidebar-background"
        >
          {/* Right sidebar header */}
          <div className="flex h-10 items-center justify-between border-b border-sidebar-border px-3">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'outline', label: 'Outline' },
                  { id: 'backlinks', label: 'Backlinks' },
                  { id: 'properties', label: 'Properties' },
                  { id: 'comments', label: 'Comments' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={toggleRightSidebar}
              aria-label="Close right sidebar"
              className="flex h-6 w-6 items-center justify-center rounded text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M2 8a1 1 0 011-1h10a1 1 0 010 2H3a1 1 0 01-1-1z" />
              </svg>
            </button>
          </div>

          {/* Right sidebar content */}
          <div className="flex-1 overflow-y-auto p-3">
            <EmptyPanelState label="Open a note to see its outline" />
          </div>
        </aside>
      )}
    </div>
  );
}

// --- Snap layout toolbar button ---

function SnapLayoutButton() {
  const isOpen = useLayoutStore((s) => s.isSnapPickerOpen);
  const setOpen = useLayoutStore((s) => s.setSnapPickerOpen);
  const currentTemplateId = useLayoutStore(
    (s) => s.currentLayout.snapTemplateId ?? 'single',
  );

  return (
    <button
      onClick={() => setOpen(!isOpen)}
      aria-label="Snap layout picker"
      aria-pressed={isOpen}
      title="Snap layout picker (Cmd+Shift+L)"
      className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
    >
      {/* Icon: grid squares layout icon */}
      {currentTemplateId === 'split-50-50' || currentTemplateId === 'split-70-30' || currentTemplateId === 'split-30-70' ? (
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
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M2 2h12v12H2V2z" />
        </svg>
      )}
    </button>
  );
}

// --- Placeholder sub-components ---

function FileExplorerPlaceholder() {
  return (
    <div className="space-y-0.5">
      {/* Workspace header */}
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
        <span>My Workspace</span>
      </div>

      {/* Stub folders */}
      {['Getting Started', 'Projects', 'Daily Notes', 'Archive'].map((folder) => (
        <button
          key={folder}
          className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" fill="currentColor" aria-hidden="true">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
          </svg>
          {folder}
        </button>
      ))}

      {/* New note button */}
      <div className="pt-2">
        <button className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-xs text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
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
    <div className="space-y-2">
      <input
        type="search"
        placeholder="Search notes…"
        className="w-full rounded-sm border border-sidebar-border bg-background-input px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
      />
      <p className="px-2 text-xs text-sidebar-muted">Type to search across all notes.</p>
    </div>
  );
}

function EmptyPanelState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center py-8">
      <p className="text-xs text-sidebar-muted">{label}</p>
    </div>
  );
}
