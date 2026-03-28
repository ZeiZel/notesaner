/**
 * graph-layout-store — Zustand store for persisting named graph layouts.
 *
 * A "layout" captures the (x, y) position of every node after the user has
 * interacted with the graph.  Multiple named layouts can be stored and
 * switched between.  The active layout is restored when the graph mounts.
 *
 * Persistence: localStorage key `notesaner-graph-layouts`.
 * Auto-save:   30 s of inactivity triggers an automatic save to the active
 *              layout (if one exists).  The timer is managed externally by
 *              GraphView via `scheduleAutoSave` / `cancelAutoSave`.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored position of a single node. */
export interface NodePosition {
  x: number;
  y: number;
}

/** A named snapshot of node positions. */
export interface GraphLayout {
  /** Unique identifier (nanoid-like, generated on creation). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Map from node ID to its (x, y) coordinate. */
  positions: Record<string, NodePosition>;
  /** Unix timestamp (ms) when this layout was last saved. */
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface GraphLayoutState {
  /** All saved layouts, keyed by id. */
  layouts: Record<string, GraphLayout>;
  /** The id of the currently active layout, or null for force-simulation default. */
  activeLayoutId: string | null;
}

export interface GraphLayoutActions {
  /**
   * Save current node positions under the given name.
   * If a layout with that name already exists, it is updated in-place.
   * Returns the id of the created/updated layout.
   */
  saveLayout: (name: string, positions: Record<string, NodePosition>) => string;

  /**
   * Overwrite the positions in an existing layout by id.
   * No-op if the id is not found.
   */
  updateLayout: (id: string, positions: Record<string, NodePosition>) => void;

  /** Delete a layout by id. If it was active, activeLayoutId becomes null. */
  deleteLayout: (id: string) => void;

  /** Set the active layout id.  Pass null to reset to force-simulation. */
  setActiveLayoutId: (id: string | null) => void;
}

export type GraphLayoutStore = GraphLayoutState & GraphLayoutActions;

// ---------------------------------------------------------------------------
// ID generator (no external dependency)
// ---------------------------------------------------------------------------

function generateId(): string {
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphLayoutStore = create<GraphLayoutStore>()(
  persist(
    (set, get) => ({
      // ----- initial state -----
      layouts: {},
      activeLayoutId: null,

      // ----- actions -----

      saveLayout(name: string, positions: Record<string, NodePosition>): string {
        const trimmedName = name.trim() || 'Untitled layout';

        // Check if a layout with this name already exists — update it.
        const existing = Object.values(get().layouts).find((l) => l.name === trimmedName);

        if (existing) {
          const updated: GraphLayout = {
            ...existing,
            positions,
            savedAt: Date.now(),
          };
          set((state) => ({
            layouts: { ...state.layouts, [existing.id]: updated },
            activeLayoutId: existing.id,
          }));
          return existing.id;
        }

        const id = generateId();
        const layout: GraphLayout = {
          id,
          name: trimmedName,
          positions,
          savedAt: Date.now(),
        };
        set((state) => ({
          layouts: { ...state.layouts, [id]: layout },
          activeLayoutId: id,
        }));
        return id;
      },

      updateLayout(id: string, positions: Record<string, NodePosition>): void {
        const existing = get().layouts[id];
        if (!existing) return;
        const updated: GraphLayout = {
          ...existing,
          positions,
          savedAt: Date.now(),
        };
        set((state) => ({
          layouts: { ...state.layouts, [id]: updated },
        }));
      },

      deleteLayout(id: string): void {
        set((state) => {
          const next = { ...state.layouts };
          delete next[id];
          return {
            layouts: next,
            activeLayoutId: state.activeLayoutId === id ? null : state.activeLayoutId,
          };
        });
      },

      setActiveLayoutId(id: string | null): void {
        set({ activeLayoutId: id });
      },
    }),
    {
      name: 'notesaner-graph-layouts',
      storage: createJSONStorage(() => {
        // Guard for SSR environments where localStorage is unavailable.
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector helpers (stable references — use in components)
// ---------------------------------------------------------------------------

/** Returns the currently active GraphLayout object, or null. */
export function selectActiveLayout(state: GraphLayoutState): GraphLayout | null {
  if (!state.activeLayoutId) return null;
  return state.layouts[state.activeLayoutId] ?? null;
}

/** Returns all layouts as a sorted array (newest first). */
export function selectLayoutList(state: GraphLayoutState): GraphLayout[] {
  return Object.values(state.layouts).sort((a, b) => b.savedAt - a.savedAt);
}
