// NOTE: Business store — core workspace navigation state. Zustand kept because:
//   - All fields (tabs, activeTabId) are persisted to localStorage so open tabs
//     survive page reloads — a core user expectation for a note-taking app.
//   - Tab management logic (close others, close to right, pin) is domain logic.
//   - Location in shared/stores is appropriate since tabs are cross-feature.
/**
 * tab-store.ts
 *
 * Zustand store for managing the global tab bar state.
 *
 * Each tab represents an open note/buffer with:
 *   - id: unique tab identifier
 *   - noteId: the note this tab displays
 *   - title: display title (derived from note title or path)
 *   - path: file path for tooltip display
 *   - isDirty: whether the buffer has unsaved changes
 *   - isPinned: whether the tab is pinned (cannot be closed by "close others")
 *   - order: sort order within the tab bar
 *
 * Design notes:
 *   - Tab ordering is stored as an array for drag-to-reorder support.
 *   - Active tab is tracked by ID, not index.
 *   - "Close others" and "close all" respect pinned tabs.
 *   - Store is persisted so open tabs survive page reloads.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tab {
  /** Unique tab identifier. */
  id: string;
  /** The note ID this tab is viewing. */
  noteId: string;
  /** Display title shown in the tab. */
  title: string;
  /** Full file path (shown in tooltip). */
  path: string;
  /** Whether the note has unsaved changes. */
  isDirty: boolean;
  /** Whether the tab is pinned (protected from bulk close). */
  isPinned: boolean;
}

interface TabState {
  // State
  /** Ordered list of open tabs. Array order = display order. */
  tabs: Tab[];
  /** ID of the currently active tab, or null if none. */
  activeTabId: string | null;

  // Actions
  /** Open a new tab (or activate it if already open for this noteId). */
  openTab: (tab: Pick<Tab, 'noteId' | 'title' | 'path'>) => void;
  /** Close a tab by ID. Activates an adjacent tab if the closed tab was active. */
  closeTab: (tabId: string) => void;
  /** Close all tabs except the given one. Pinned tabs are preserved. */
  closeOthers: (tabId: string) => void;
  /** Close all tabs to the right of the given tab. */
  closeToTheRight: (tabId: string) => void;
  /** Close all tabs. Pinned tabs are preserved unless force is true. */
  closeAll: (force?: boolean) => void;
  /** Set the active tab by ID. */
  setActiveTab: (tabId: string) => void;
  /** Reorder tabs by moving a tab from one index to another. */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Mark a tab as dirty or clean. */
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  /** Pin or unpin a tab. */
  togglePinTab: (tabId: string) => void;
  /** Update the title of a tab (e.g., when note is renamed). */
  updateTabTitle: (tabId: string, title: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * After closing a tab, determine which tab to activate.
 * Prefers the tab at the same index, falls back to the previous one.
 */
function findNextActiveTab(
  tabs: Tab[],
  closedIndex: number,
  closedId: string,
  currentActiveId: string | null,
): string | null {
  if (tabs.length === 0) return null;
  // If the closed tab was not active, keep current
  if (currentActiveId !== closedId) {
    // Ensure the current active is still present
    return (
      tabs.find((t) => t.id === currentActiveId)?.id ??
      tabs[Math.min(closedIndex, tabs.length - 1)]?.id ??
      null
    );
  }
  // Prefer the same index, then previous
  const idx = Math.min(closedIndex, tabs.length - 1);
  return tabs[idx]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTabStore = create<TabState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        tabs: [],
        activeTabId: null,

        openTab: (tabInfo) =>
          set(
            (state) => {
              // If a tab for this noteId already exists, just activate it
              const existing = state.tabs.find((t) => t.noteId === tabInfo.noteId);
              if (existing) {
                return { activeTabId: existing.id };
              }

              const newTab: Tab = {
                id: generateTabId(),
                noteId: tabInfo.noteId,
                title: tabInfo.title,
                path: tabInfo.path,
                isDirty: false,
                isPinned: false,
              };

              return {
                tabs: [...state.tabs, newTab],
                activeTabId: newTab.id,
              };
            },
            false,
            'tabs/openTab',
          ),

        closeTab: (tabId) =>
          set(
            (state) => {
              const index = state.tabs.findIndex((t) => t.id === tabId);
              if (index === -1) return state;

              const newTabs = state.tabs.filter((t) => t.id !== tabId);
              const newActiveId = findNextActiveTab(newTabs, index, tabId, state.activeTabId);

              return {
                tabs: newTabs,
                activeTabId: newActiveId,
              };
            },
            false,
            'tabs/closeTab',
          ),

        closeOthers: (tabId) =>
          set(
            (state) => {
              const newTabs = state.tabs.filter((t) => t.id === tabId || t.isPinned);
              return {
                tabs: newTabs,
                activeTabId: tabId,
              };
            },
            false,
            'tabs/closeOthers',
          ),

        closeToTheRight: (tabId) =>
          set(
            (state) => {
              const index = state.tabs.findIndex((t) => t.id === tabId);
              if (index === -1) return state;

              const newTabs = state.tabs.filter((t, i) => i <= index || t.isPinned);
              const activeStillExists = newTabs.find((t) => t.id === state.activeTabId);

              return {
                tabs: newTabs,
                activeTabId: activeStillExists ? state.activeTabId : tabId,
              };
            },
            false,
            'tabs/closeToTheRight',
          ),

        closeAll: (force = false) =>
          set(
            (state) => {
              const newTabs = force ? [] : state.tabs.filter((t) => t.isPinned);
              const activeStillExists = newTabs.find((t) => t.id === state.activeTabId);

              return {
                tabs: newTabs,
                activeTabId: activeStillExists ? state.activeTabId : (newTabs[0]?.id ?? null),
              };
            },
            false,
            'tabs/closeAll',
          ),

        setActiveTab: (tabId) =>
          set(
            (state) => {
              if (state.tabs.find((t) => t.id === tabId) === undefined) return state;
              return { activeTabId: tabId };
            },
            false,
            'tabs/setActiveTab',
          ),

        reorderTabs: (fromIndex, toIndex) =>
          set(
            (state) => {
              if (
                fromIndex < 0 ||
                fromIndex >= state.tabs.length ||
                toIndex < 0 ||
                toIndex >= state.tabs.length ||
                fromIndex === toIndex
              ) {
                return state;
              }

              const newTabs = [...state.tabs];
              const [moved] = newTabs.splice(fromIndex, 1);
              newTabs.splice(toIndex, 0, moved);

              return { tabs: newTabs };
            },
            false,
            'tabs/reorderTabs',
          ),

        setTabDirty: (tabId, isDirty) =>
          set(
            (state) => ({
              tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
            }),
            false,
            'tabs/setTabDirty',
          ),

        togglePinTab: (tabId) =>
          set(
            (state) => ({
              tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
            }),
            false,
            'tabs/togglePinTab',
          ),

        updateTabTitle: (tabId, title) =>
          set(
            (state) => ({
              tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
            }),
            false,
            'tabs/updateTabTitle',
          ),
      }),
      {
        name: 'notesaner-tabs',
        partialize: (state) => ({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        }),
      },
    ),
    { name: 'TabStore' },
  ),
);
