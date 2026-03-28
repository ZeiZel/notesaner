'use client';

/**
 * PanelControlsContext.tsx
 *
 * React Context replacement for the former panel-controls Zustand store.
 *
 * Panel maximize/minimize/restore state is purely transient UI state:
 *   - Not persisted to localStorage (panels restore to normal on page reload)
 *   - No business logic or API calls
 *   - Scoped entirely to the workspace grid layout
 *
 * Migrated from Zustand to React Context per project convention:
 * "Zustand stores hold domain/business state; React.createContext for UI state."
 */

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PanelState = 'normal' | 'maximized' | 'minimized';

interface PanelControlsState {
  /** Map of pane ID to its current state. Missing keys default to 'normal'. */
  panelStates: Record<string, PanelState>;
  /** The ID of the currently maximized pane, if any. */
  maximizedPaneId: string | null;
}

interface PanelControlsActions {
  /** Maximize a pane. Restores any previously maximized pane. */
  maximize: (paneId: string) => void;
  /** Minimize a pane to header-only strip. */
  minimize: (paneId: string) => void;
  /** Restore a pane to its normal state. */
  restore: (paneId: string) => void;
  /** Restore all panes to normal state. */
  restoreAll: () => void;
  /** Returns true if any pane is currently maximized. */
  hasMaximizedPane: () => boolean;
  /** Returns true if the given pane should be visible in the grid. */
  isPaneVisible: (paneId: string) => boolean;
}

type PanelControlsContextValue = PanelControlsState & PanelControlsActions;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type PanelAction =
  | { type: 'MAXIMIZE'; paneId: string }
  | { type: 'MINIMIZE'; paneId: string }
  | { type: 'RESTORE'; paneId: string }
  | { type: 'RESTORE_ALL' };

const INITIAL_STATE: PanelControlsState = {
  panelStates: {},
  maximizedPaneId: null,
};

function panelControlsReducer(state: PanelControlsState, action: PanelAction): PanelControlsState {
  switch (action.type) {
    case 'MAXIMIZE': {
      const newStates = { ...state.panelStates };

      // If another pane was maximized, restore it
      if (state.maximizedPaneId && state.maximizedPaneId !== action.paneId) {
        newStates[state.maximizedPaneId] = 'normal';
      }

      newStates[action.paneId] = 'maximized';

      return {
        panelStates: newStates,
        maximizedPaneId: action.paneId,
      };
    }

    case 'MINIMIZE': {
      const newStates = { ...state.panelStates };
      newStates[action.paneId] = 'minimized';

      const newMaximized = state.maximizedPaneId === action.paneId ? null : state.maximizedPaneId;

      return {
        panelStates: newStates,
        maximizedPaneId: newMaximized,
      };
    }

    case 'RESTORE': {
      const newStates = { ...state.panelStates };
      newStates[action.paneId] = 'normal';

      const newMaximized = state.maximizedPaneId === action.paneId ? null : state.maximizedPaneId;

      return {
        panelStates: newStates,
        maximizedPaneId: newMaximized,
      };
    }

    case 'RESTORE_ALL':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PanelControlsContext = createContext<PanelControlsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PanelControlsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(panelControlsReducer, INITIAL_STATE);

  const maximize = useCallback((paneId: string) => dispatch({ type: 'MAXIMIZE', paneId }), []);

  const minimize = useCallback((paneId: string) => dispatch({ type: 'MINIMIZE', paneId }), []);

  const restore = useCallback((paneId: string) => dispatch({ type: 'RESTORE', paneId }), []);

  const restoreAll = useCallback(() => dispatch({ type: 'RESTORE_ALL' }), []);

  const hasMaximizedPane = useCallback(
    () => state.maximizedPaneId !== null,
    [state.maximizedPaneId],
  );

  const isPaneVisible = useCallback(
    (paneId: string) => {
      if (state.maximizedPaneId !== null) {
        return state.maximizedPaneId === paneId;
      }
      return true;
    },
    [state.maximizedPaneId],
  );

  const value = useMemo<PanelControlsContextValue>(
    () => ({
      ...state,
      maximize,
      minimize,
      restore,
      restoreAll,
      hasMaximizedPane,
      isPaneVisible,
    }),
    [state, maximize, minimize, restore, restoreAll, hasMaximizedPane, isPaneVisible],
  );

  return <PanelControlsContext.Provider value={value}>{children}</PanelControlsContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access panel controls state and actions.
 *
 * Must be used within a <PanelControlsProvider>.
 *
 * Supports an optional selector for optimized re-renders:
 *   usePanelControls()                  -- returns full context value
 *   usePanelControls(s => s.panelStates) -- returns only panelStates
 */
export function usePanelControls(): PanelControlsContextValue;
export function usePanelControls<T>(selector: (ctx: PanelControlsContextValue) => T): T;
export function usePanelControls<T>(
  selector?: (ctx: PanelControlsContextValue) => T,
): PanelControlsContextValue | T {
  const ctx = useContext(PanelControlsContext);
  if (ctx === null) {
    throw new Error('usePanelControls must be used within a <PanelControlsProvider>');
  }
  return selector ? selector(ctx) : ctx;
}
