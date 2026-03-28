// NOTE: Mixed store — grid layout configuration + transient drag state.
// Not persisted (session-only). Zustand is kept because:
//   - Grid config (columns, rows, panes, focusedNoteId) is workspace-level
//     domain state shared across multiple components (7+ files).
//   - Transient drag fields (activeDivider, isDragging, draggedPaneId, dropZone)
//     are tightly coupled to layout mutation actions.
//   - focusedPaneId bridges keyboard navigation with pane rendering.
/**
 * grid-layout-store.ts
 *
 * Zustand store managing the CSS Grid-based window layout system.
 *
 * Design notes:
 *   - Grid panes are positioned using CSS Grid named areas
 *   - Each pane tracks its own focusedNoteId
 *   - Pane focus is managed here for keyboard navigation (Ctrl+Arrow)
 *   - Column and row templates are stored as string arrays for CSS Grid
 *   - Minimum pane sizes enforced: 200px width, 150px height
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_PANE_WIDTH = 200;
export const MIN_PANE_HEIGHT = 150;
export const SNAP_THRESHOLD = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridPaneConfig {
  /** Unique identifier for this pane */
  id: string;
  /** CSS Grid area name, e.g. "p1" */
  gridArea: string;
  /** Column start (1-indexed) */
  colStart: number;
  /** Column end (1-indexed, exclusive) */
  colEnd: number;
  /** Row start (1-indexed) */
  rowStart: number;
  /** Row end (1-indexed, exclusive) */
  rowEnd: number;
  /** The note currently focused in this pane (if any) */
  focusedNoteId: string | null;
}

export interface GridConfig {
  /** CSS Grid column templates, e.g. ["1fr", "1fr"] */
  columns: string[];
  /** CSS Grid row templates, e.g. ["1fr"] */
  rows: string[];
  /** Panes positioned on the grid */
  panes: GridPaneConfig[];
}

/**
 * Identifies a divider between two grid tracks.
 * index = the 0-based index of the gap between tracks.
 * e.g. for 3 columns, divider index 0 is between col 0 and col 1,
 * index 1 is between col 1 and col 2.
 */
export interface DividerInfo {
  axis: 'column' | 'row';
  index: number;
}

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

export const GRID_PRESETS: Record<string, GridConfig> = {
  single: {
    columns: ['1fr'],
    rows: ['1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
    ],
  },
  'split-50-50': {
    columns: ['1fr', '1fr'],
    rows: ['1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
    ],
  },
  'split-70-30': {
    columns: ['7fr', '3fr'],
    rows: ['1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
    ],
  },
  'split-30-70': {
    columns: ['3fr', '7fr'],
    rows: ['1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
    ],
  },
  'three-columns': {
    columns: ['1fr', '1fr', '1fr'],
    rows: ['1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p3',
        gridArea: 'p3',
        colStart: 3,
        colEnd: 4,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
    ],
  },
  'two-x-two': {
    columns: ['1fr', '1fr'],
    rows: ['1fr', '1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p3',
        gridArea: 'p3',
        colStart: 1,
        colEnd: 2,
        rowStart: 2,
        rowEnd: 3,
        focusedNoteId: null,
      },
      {
        id: 'p4',
        gridArea: 'p4',
        colStart: 2,
        colEnd: 3,
        rowStart: 2,
        rowEnd: 3,
        focusedNoteId: null,
      },
    ],
  },
  'main-plus-two': {
    columns: ['2fr', '1fr'],
    rows: ['1fr', '1fr'],
    panes: [
      {
        id: 'p1',
        gridArea: 'p1',
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 3,
        focusedNoteId: null,
      },
      {
        id: 'p2',
        gridArea: 'p2',
        colStart: 2,
        colEnd: 3,
        rowStart: 1,
        rowEnd: 2,
        focusedNoteId: null,
      },
      {
        id: 'p3',
        gridArea: 'p3',
        colStart: 2,
        colEnd: 3,
        rowStart: 2,
        rowEnd: 3,
        focusedNoteId: null,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface GridLayoutState {
  /** Current grid configuration */
  gridConfig: GridConfig;
  /** ID of the currently focused pane (for keyboard navigation) */
  focusedPaneId: string | null;
  /** Active divider being dragged (null when not resizing) */
  activeDivider: DividerInfo | null;
  /** Whether a pane is currently being dragged */
  isDragging: boolean;
  /** ID of the pane being dragged */
  draggedPaneId: string | null;
  /** Drop zone indicator position */
  dropZone: { colStart: number; colEnd: number; rowStart: number; rowEnd: number } | null;

  // Actions
  /** Apply a preset grid configuration by key */
  applyPreset: (presetKey: string) => void;
  /** Set an arbitrary grid config (e.g. from persistence) */
  setGridConfig: (config: GridConfig) => void;
  /** Focus a specific pane */
  focusPane: (paneId: string) => void;
  /** Navigate focus to adjacent pane (keyboard) */
  moveFocus: (direction: 'left' | 'right' | 'up' | 'down') => void;
  /** Set the note ID focused in a pane */
  setPaneFocusedNote: (paneId: string, noteId: string | null) => void;
  /** Start resizing a divider */
  startDividerDrag: (divider: DividerInfo) => void;
  /** Update column/row sizes during drag */
  resizeTracks: (axis: 'column' | 'row', newSizes: string[]) => void;
  /** Stop resizing */
  stopDividerDrag: () => void;
  /** Start pane drag */
  startPaneDrag: (paneId: string) => void;
  /** Update drop zone indicator */
  setDropZone: (zone: GridLayoutState['dropZone']) => void;
  /** Move a pane to a new grid position */
  movePaneTo: (
    paneId: string,
    colStart: number,
    colEnd: number,
    rowStart: number,
    rowEnd: number,
  ) => void;
  /** Stop pane drag */
  stopPaneDrag: () => void;
  /** Add a new pane at the specified position */
  addPane: (colStart: number, colEnd: number, rowStart: number, rowEnd: number) => void;
  /** Remove a pane by ID */
  removePane: (paneId: string) => void;
}

export const useGridLayoutStore = create<GridLayoutState>()(
  devtools(
    (set, get) => ({
      // Initial state: single pane
      gridConfig: GRID_PRESETS['single'],
      focusedPaneId: 'p1',
      activeDivider: null,
      isDragging: false,
      draggedPaneId: null,
      dropZone: null,

      applyPreset: (presetKey) => {
        const preset = GRID_PRESETS[presetKey];
        if (!preset) return;

        const state = get();
        const existingNotes = state.gridConfig.panes.map((p) => p.focusedNoteId);

        // Carry over focused note IDs from existing panes into new ones
        const newPanes = preset.panes.map((p, i) => ({
          ...p,
          focusedNoteId: existingNotes[i] ?? null,
        }));

        set(
          {
            gridConfig: { ...preset, panes: newPanes },
            focusedPaneId: newPanes[0]?.id ?? null,
            activeDivider: null,
            isDragging: false,
            draggedPaneId: null,
            dropZone: null,
          },
          false,
          'gridLayout/applyPreset',
        );
      },

      setGridConfig: (config) =>
        set(
          { gridConfig: config, focusedPaneId: config.panes[0]?.id ?? null },
          false,
          'gridLayout/setGridConfig',
        ),

      focusPane: (paneId) => set({ focusedPaneId: paneId }, false, 'gridLayout/focusPane'),

      moveFocus: (direction) => {
        const { gridConfig, focusedPaneId } = get();
        const current = gridConfig.panes.find((p) => p.id === focusedPaneId);
        if (!current) {
          // If no pane is focused, focus the first one
          if (gridConfig.panes.length > 0) {
            set({ focusedPaneId: gridConfig.panes[0].id }, false, 'gridLayout/moveFocus');
          }
          return;
        }

        // Find the best adjacent pane in the given direction
        const candidates = gridConfig.panes.filter((p) => p.id !== current.id);
        let best: GridPaneConfig | null = null;
        let bestDist = Infinity;

        for (const candidate of candidates) {
          let matches = false;
          let dist = 0;

          switch (direction) {
            case 'left':
              // Candidate must be to the left (its colEnd <= current colStart)
              matches = candidate.colEnd <= current.colStart;
              dist = current.colStart - candidate.colEnd;
              break;
            case 'right':
              matches = candidate.colStart >= current.colEnd;
              dist = candidate.colStart - current.colEnd;
              break;
            case 'up':
              matches = candidate.rowEnd <= current.rowStart;
              dist = current.rowStart - candidate.rowEnd;
              break;
            case 'down':
              matches = candidate.rowStart >= current.rowEnd;
              dist = candidate.rowStart - current.rowEnd;
              break;
          }

          if (matches && dist < bestDist) {
            bestDist = dist;
            best = candidate;
          }
        }

        if (best) {
          set({ focusedPaneId: best.id }, false, 'gridLayout/moveFocus');
        }
      },

      setPaneFocusedNote: (paneId, noteId) =>
        set(
          (state) => ({
            gridConfig: {
              ...state.gridConfig,
              panes: state.gridConfig.panes.map((p) =>
                p.id === paneId ? { ...p, focusedNoteId: noteId } : p,
              ),
            },
          }),
          false,
          'gridLayout/setPaneFocusedNote',
        ),

      startDividerDrag: (divider) =>
        set({ activeDivider: divider }, false, 'gridLayout/startDividerDrag'),

      resizeTracks: (axis, newSizes) =>
        set(
          (state) => ({
            gridConfig: {
              ...state.gridConfig,
              [axis === 'column' ? 'columns' : 'rows']: newSizes,
            },
          }),
          false,
          'gridLayout/resizeTracks',
        ),

      stopDividerDrag: () => set({ activeDivider: null }, false, 'gridLayout/stopDividerDrag'),

      startPaneDrag: (paneId) =>
        set({ isDragging: true, draggedPaneId: paneId }, false, 'gridLayout/startPaneDrag'),

      setDropZone: (zone) => set({ dropZone: zone }, false, 'gridLayout/setDropZone'),

      movePaneTo: (paneId, colStart, colEnd, rowStart, rowEnd) =>
        set(
          (state) => ({
            gridConfig: {
              ...state.gridConfig,
              panes: state.gridConfig.panes.map((p) =>
                p.id === paneId ? { ...p, colStart, colEnd, rowStart, rowEnd } : p,
              ),
            },
            dropZone: null,
          }),
          false,
          'gridLayout/movePaneTo',
        ),

      stopPaneDrag: () =>
        set(
          { isDragging: false, draggedPaneId: null, dropZone: null },
          false,
          'gridLayout/stopPaneDrag',
        ),

      addPane: (colStart, colEnd, rowStart, rowEnd) => {
        const id = `pane-${Date.now()}`;
        set(
          (state) => ({
            gridConfig: {
              ...state.gridConfig,
              panes: [
                ...state.gridConfig.panes,
                {
                  id,
                  gridArea: id,
                  colStart,
                  colEnd,
                  rowStart,
                  rowEnd,
                  focusedNoteId: null,
                },
              ],
            },
          }),
          false,
          'gridLayout/addPane',
        );
      },

      removePane: (paneId) =>
        set(
          (state) => {
            const newPanes = state.gridConfig.panes.filter((p) => p.id !== paneId);
            // If removing the focused pane, focus the first remaining one
            const newFocused =
              state.focusedPaneId === paneId ? (newPanes[0]?.id ?? null) : state.focusedPaneId;

            return {
              gridConfig: { ...state.gridConfig, panes: newPanes },
              focusedPaneId: newFocused,
            };
          },
          false,
          'gridLayout/removePane',
        ),
    }),
    { name: 'GridLayoutStore' },
  ),
);
