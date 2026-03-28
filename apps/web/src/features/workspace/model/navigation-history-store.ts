/**
 * navigation-history-store.ts
 *
 * Per-tab navigation history for back/forward navigation.
 *
 * Each editor tab maintains its own independent navigation stack, allowing
 * users to navigate back/forward within a single tab without affecting others.
 *
 * Design notes:
 *   - History is stored in-memory only (no persistence across page reloads).
 *   - Maximum 50 history entries per tab to prevent unbounded growth.
 *   - When navigating back then opening a new note, forward history is cleared
 *     (browser-like behavior).
 *   - Store is NOT persisted — navigation history is session-only.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY_PER_TAB = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabHistory {
  /** Stack of note IDs that can be navigated back to. */
  backStack: string[];
  /** Stack of note IDs that can be navigated forward to. */
  forwardStack: string[];
  /** The currently active note ID in this tab. */
  currentNoteId: string | null;
}

interface NavigationHistoryState {
  // State
  /** Map of tab ID -> per-tab navigation history */
  histories: Record<string, TabHistory>;

  // Actions
  /**
   * Record a navigation to a new note within a tab.
   * Pushes the current note onto the back stack and clears the forward stack.
   */
  navigate: (tabId: string, noteId: string) => void;

  /**
   * Navigate back in a specific tab's history.
   * Returns the note ID to navigate to, or null if no history.
   */
  goBack: (tabId: string) => string | null;

  /**
   * Navigate forward in a specific tab's history.
   * Returns the note ID to navigate to, or null if no forward history.
   */
  goForward: (tabId: string) => string | null;

  /**
   * Check if a tab can navigate back.
   */
  canGoBack: (tabId: string) => boolean;

  /**
   * Check if a tab can navigate forward.
   */
  canGoForward: (tabId: string) => boolean;

  /**
   * Remove history for a tab (when the tab is closed).
   */
  removeTabHistory: (tabId: string) => void;

  /**
   * Reset all navigation history.
   */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrCreateHistory(histories: Record<string, TabHistory>, tabId: string): TabHistory {
  return histories[tabId] ?? { backStack: [], forwardStack: [], currentNoteId: null };
}

function trimStack(stack: string[]): string[] {
  if (stack.length > MAX_HISTORY_PER_TAB) {
    return stack.slice(stack.length - MAX_HISTORY_PER_TAB);
  }
  return stack;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNavigationHistoryStore = create<NavigationHistoryState>()(
  devtools(
    (set, get) => ({
      histories: {},

      navigate: (tabId, noteId) =>
        set(
          (state) => {
            const history = getOrCreateHistory(state.histories, tabId);

            // If we're already on this note, do nothing
            if (history.currentNoteId === noteId) return state;

            const newBackStack =
              history.currentNoteId !== null
                ? trimStack([...history.backStack, history.currentNoteId])
                : history.backStack;

            return {
              histories: {
                ...state.histories,
                [tabId]: {
                  backStack: newBackStack,
                  forwardStack: [], // Clear forward stack on new navigation
                  currentNoteId: noteId,
                },
              },
            };
          },
          false,
          'navHistory/navigate',
        ),

      goBack: (tabId) => {
        const state = get();
        const history = getOrCreateHistory(state.histories, tabId);

        if (history.backStack.length === 0) return null;

        const newBackStack = [...history.backStack];
        const targetNoteId = newBackStack.pop();
        if (targetNoteId === undefined) return null;

        const newForwardStack =
          history.currentNoteId !== null
            ? [history.currentNoteId, ...history.forwardStack]
            : history.forwardStack;

        set(
          {
            histories: {
              ...state.histories,
              [tabId]: {
                backStack: newBackStack,
                forwardStack: trimStack(newForwardStack),
                currentNoteId: targetNoteId,
              },
            },
          },
          false,
          'navHistory/goBack',
        );

        return targetNoteId;
      },

      goForward: (tabId) => {
        const state = get();
        const history = getOrCreateHistory(state.histories, tabId);

        if (history.forwardStack.length === 0) return null;

        const newForwardStack = [...history.forwardStack];
        const targetNoteId = newForwardStack.shift();
        if (targetNoteId === undefined) return null;

        const newBackStack =
          history.currentNoteId !== null
            ? trimStack([...history.backStack, history.currentNoteId])
            : history.backStack;

        set(
          {
            histories: {
              ...state.histories,
              [tabId]: {
                backStack: newBackStack,
                forwardStack: newForwardStack,
                currentNoteId: targetNoteId,
              },
            },
          },
          false,
          'navHistory/goForward',
        );

        return targetNoteId;
      },

      canGoBack: (tabId) => {
        const history = getOrCreateHistory(get().histories, tabId);
        return history.backStack.length > 0;
      },

      canGoForward: (tabId) => {
        const history = getOrCreateHistory(get().histories, tabId);
        return history.forwardStack.length > 0;
      },

      removeTabHistory: (tabId) =>
        set(
          (state) => {
            const { [tabId]: _removed, ...rest } = state.histories;
            return { histories: rest };
          },
          false,
          'navHistory/removeTabHistory',
        ),

      reset: () => set({ histories: {} }, false, 'navHistory/reset'),
    }),
    { name: 'NavigationHistoryStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Returns the back stack length for a given tab.
 * Useful for showing a history count indicator.
 */
export function selectBackStackLength(state: NavigationHistoryState, tabId: string): number {
  return state.histories[tabId]?.backStack.length ?? 0;
}

/**
 * Returns the forward stack length for a given tab.
 */
export function selectForwardStackLength(state: NavigationHistoryState, tabId: string): number {
  return state.histories[tabId]?.forwardStack.length ?? 0;
}
