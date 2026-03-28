/**
 * @deprecated Use PanelControlsContext.tsx instead.
 * This Zustand store has been replaced by a React Context provider because
 * panel maximize/minimize/restore state is purely transient UI state:
 *   - Not persisted to localStorage
 *   - No business logic or API calls
 *   - Scoped entirely to the workspace grid layout
 *
 * panel-controls-store.ts
 *
 * Zustand store managing panel maximize/minimize/restore state.
 *
 * Design:
 *   - Each pane has a PanelState: 'normal' | 'maximized' | 'minimized'.
 *   - Only one pane can be maximized at a time.
 *   - Minimized panes collapse to header-only strips (height controlled by CSS).
 *   - State is NOT persisted (panels restore to normal on page reload).
 *   - The GridPane component reads state from this store to apply CSS overrides.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PanelState = 'normal' | 'maximized' | 'minimized';

interface PanelControlsState {
  /** Map of pane ID to its current state. Missing keys default to 'normal'. */
  panelStates: Record<string, PanelState>;

  /** The ID of the currently maximized pane, if any. */
  maximizedPaneId: string | null;

  // -- Actions --

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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePanelControlsStore = create<PanelControlsState>()(
  devtools(
    (set, get) => ({
      panelStates: {},
      maximizedPaneId: null,

      maximize: (paneId) =>
        set(
          (state) => {
            const newStates = { ...state.panelStates };

            // If another pane was maximized, restore it
            if (state.maximizedPaneId && state.maximizedPaneId !== paneId) {
              newStates[state.maximizedPaneId] = 'normal';
            }

            newStates[paneId] = 'maximized';

            return {
              panelStates: newStates,
              maximizedPaneId: paneId,
            };
          },
          false,
          'panelControls/maximize',
        ),

      minimize: (paneId) =>
        set(
          (state) => {
            const newStates = { ...state.panelStates };
            newStates[paneId] = 'minimized';

            // If this pane was maximized, clear the maximized state
            const newMaximized = state.maximizedPaneId === paneId ? null : state.maximizedPaneId;

            return {
              panelStates: newStates,
              maximizedPaneId: newMaximized,
            };
          },
          false,
          'panelControls/minimize',
        ),

      restore: (paneId) =>
        set(
          (state) => {
            const newStates = { ...state.panelStates };
            newStates[paneId] = 'normal';

            // If this pane was maximized, clear the maximized state
            const newMaximized = state.maximizedPaneId === paneId ? null : state.maximizedPaneId;

            return {
              panelStates: newStates,
              maximizedPaneId: newMaximized,
            };
          },
          false,
          'panelControls/restore',
        ),

      restoreAll: () =>
        set({ panelStates: {}, maximizedPaneId: null }, false, 'panelControls/restoreAll'),

      hasMaximizedPane: () => get().maximizedPaneId !== null,

      isPaneVisible: (paneId) => {
        const state = get();
        // When a pane is maximized, only the maximized pane is visible
        if (state.maximizedPaneId !== null) {
          return state.maximizedPaneId === paneId;
        }
        // Otherwise all panes are visible (minimized panes show as strips)
        return true;
      },
    }),
    { name: 'PanelControlsStore' },
  ),
);
