/**
 * floating-windows-store.ts
 *
 * Zustand store for floating/detachable windows in the workspace.
 *
 * Design notes:
 *   - Floating windows are workspace-level domain state: multiple components
 *     (GridPane header button, FloatingWindow, FloatingWindowsLayer) consume it.
 *   - Position and size are persisted to localStorage so windows survive a reload.
 *   - Z-index is managed here: focusing a window brings it to the front.
 *   - Windows can hold any panel content (editor, preview, graph, etc.).
 *   - The store follows the existing grid-layout-store pattern for consistency.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Starting z-index for floating windows (above fixed sidebars). */
const BASE_Z_INDEX = 100;

/** Default window dimensions when opened without a size hint. */
export const DEFAULT_WINDOW_SIZE: FloatingWindowSize = { width: 600, height: 400 };

/** Default position offset applied to each new window so they don't stack exactly. */
const STACK_OFFSET = 24;

/** Snap threshold in pixels — window edge snaps when within this distance. */
export const SNAP_EDGE_THRESHOLD = 16;

/** Minimum window dimensions. */
export const MIN_WINDOW_WIDTH = 280;
export const MIN_WINDOW_HEIGHT = 160;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingWindowPosition {
  x: number;
  y: number;
}

export interface FloatingWindowSize {
  width: number;
  height: number;
}

/** The type of content the window is hosting. Matches PanelRegistry panel IDs. */
export type FloatingWindowContentType =
  | 'editor'
  | 'preview'
  | 'graph'
  | 'outline'
  | 'backlinks'
  | 'properties'
  | 'search'
  | 'comments'
  | string;

export interface FloatingWindow {
  /** Unique identifier for this window instance. */
  id: string;
  /** Human-readable title shown in the window title bar. */
  title: string;
  /** Which panel type this window hosts. */
  contentType: FloatingWindowContentType;
  /** Arbitrary props forwarded to the content component. */
  contentProps: Record<string, unknown>;
  /** Current position (top-left corner, relative to viewport). */
  position: FloatingWindowPosition;
  /** Current size. */
  size: FloatingWindowSize;
  /** Z-index: higher values appear on top. */
  zIndex: number;
  /** Whether the window is currently minimized to its title bar. */
  isMinimized: boolean;
  /** Whether the window is currently maximized to fill the workspace. */
  isMaximized: boolean;
}

// ---------------------------------------------------------------------------
// Payload types for actions
// ---------------------------------------------------------------------------

export interface OpenWindowPayload {
  title: string;
  contentType: FloatingWindowContentType;
  contentProps?: Record<string, unknown>;
  position?: FloatingWindowPosition;
  size?: FloatingWindowSize;
}

// ---------------------------------------------------------------------------
// Store state + actions interface
// ---------------------------------------------------------------------------

interface FloatingWindowsState {
  /** All currently open floating windows. */
  windows: FloatingWindow[];

  /** The next z-index to assign when a window is focused. */
  nextZIndex: number;

  // -- Actions --

  /** Open a new floating window. Returns the new window's ID. */
  openWindow: (payload: OpenWindowPayload) => string;

  /** Close (remove) a floating window by ID. */
  closeWindow: (id: string) => void;

  /** Move a window to a new position, with optional edge snapping. */
  updatePosition: (id: string, position: FloatingWindowPosition) => void;

  /** Resize a window, clamping to minimum dimensions. */
  updateSize: (id: string, size: FloatingWindowSize) => void;

  /** Bring a window to the front by giving it the highest z-index. */
  focusWindow: (id: string) => void;

  /** Toggle minimize for a window. */
  toggleMinimize: (id: string) => void;

  /** Toggle maximize for a window. */
  toggleMaximize: (id: string) => void;

  /** Close all open floating windows. */
  closeAllWindows: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a staggered default position for new windows so they don't
 * overlap perfectly when opened in quick succession.
 */
function computeDefaultPosition(windowCount: number): FloatingWindowPosition {
  const offset = (windowCount % 8) * STACK_OFFSET;
  return { x: 80 + offset, y: 80 + offset };
}

/**
 * Clamps a position so the window title bar stays on-screen.
 * Requires viewport dimensions; falls back to generous defaults on SSR.
 */
function clampPosition(
  pos: FloatingWindowPosition,
  size: FloatingWindowSize,
): FloatingWindowPosition {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  // Keep at least 80px of the title bar accessible horizontally.
  const minX = -(size.width - 80);
  const maxX = vw - 80;

  // Keep the top of the window (title bar) always on screen.
  const minY = 0;
  const maxY = vh - 32; // 32 = approx title-bar height

  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  };
}

/**
 * Applies edge snapping: if the window edge is within SNAP_EDGE_THRESHOLD of
 * the viewport edge, snaps to 0 or viewport edge.
 */
function applyEdgeSnap(
  pos: FloatingWindowPosition,
  size: FloatingWindowSize,
): FloatingWindowPosition {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  let { x, y } = pos;

  if (Math.abs(x) <= SNAP_EDGE_THRESHOLD) x = 0;
  if (Math.abs(y) <= SNAP_EDGE_THRESHOLD) y = 0;
  if (Math.abs(x + size.width - vw) <= SNAP_EDGE_THRESHOLD) x = vw - size.width;
  if (Math.abs(y + size.height - vh) <= SNAP_EDGE_THRESHOLD) y = vh - size.height;

  return { x, y };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFloatingWindowsStore = create<FloatingWindowsState>()(
  devtools(
    persist(
      (set, get) => ({
        windows: [],
        nextZIndex: BASE_Z_INDEX,

        openWindow: (payload) => {
          const { windows, nextZIndex } = get();
          // Use a counter-based ID to guarantee uniqueness even when multiple
          // windows are opened within the same millisecond.
          const id = `fw-${Date.now()}-${nextZIndex}`;
          const size = payload.size ?? DEFAULT_WINDOW_SIZE;
          const rawPosition = payload.position ?? computeDefaultPosition(windows.length);
          const position = clampPosition(rawPosition, size);

          const newWindow: FloatingWindow = {
            id,
            title: payload.title,
            contentType: payload.contentType,
            contentProps: payload.contentProps ?? {},
            position,
            size,
            zIndex: nextZIndex,
            isMinimized: false,
            isMaximized: false,
          };

          set(
            { windows: [...windows, newWindow], nextZIndex: nextZIndex + 1 },
            false,
            'floatingWindows/openWindow',
          );

          return id;
        },

        closeWindow: (id) =>
          set(
            (state) => ({ windows: state.windows.filter((w) => w.id !== id) }),
            false,
            'floatingWindows/closeWindow',
          ),

        updatePosition: (id, rawPosition) =>
          set(
            (state) => ({
              windows: state.windows.map((w) => {
                if (w.id !== id) return w;
                const snapped = applyEdgeSnap(rawPosition, w.size);
                const clamped = clampPosition(snapped, w.size);
                return { ...w, position: clamped };
              }),
            }),
            false,
            'floatingWindows/updatePosition',
          ),

        updateSize: (id, size) =>
          set(
            (state) => ({
              windows: state.windows.map((w) => {
                if (w.id !== id) return w;
                const clamped: FloatingWindowSize = {
                  width: Math.max(MIN_WINDOW_WIDTH, size.width),
                  height: Math.max(MIN_WINDOW_HEIGHT, size.height),
                };
                return { ...w, size: clamped };
              }),
            }),
            false,
            'floatingWindows/updateSize',
          ),

        focusWindow: (id) => {
          const { nextZIndex } = get();
          set(
            (state) => ({
              windows: state.windows.map((w) => (w.id === id ? { ...w, zIndex: nextZIndex } : w)),
              nextZIndex: nextZIndex + 1,
            }),
            false,
            'floatingWindows/focusWindow',
          );
        },

        toggleMinimize: (id) =>
          set(
            (state) => ({
              windows: state.windows.map((w) =>
                w.id === id ? { ...w, isMinimized: !w.isMinimized, isMaximized: false } : w,
              ),
            }),
            false,
            'floatingWindows/toggleMinimize',
          ),

        toggleMaximize: (id) =>
          set(
            (state) => ({
              windows: state.windows.map((w) =>
                w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false } : w,
              ),
            }),
            false,
            'floatingWindows/toggleMaximize',
          ),

        closeAllWindows: () => set({ windows: [] }, false, 'floatingWindows/closeAllWindows'),
      }),
      {
        name: 'floating-windows-store',
        // Only persist position/size — not zIndex (recalculated on load).
        partialize: (state) => ({
          windows: state.windows.map((w) => ({
            ...w,
            // Reset z-indexes on restore; focusWindow re-assigns them.
            zIndex: BASE_Z_INDEX,
          })),
        }),
        // Skip automatic rehydration on store init.
        // Call useFloatingWindowsStore.persist.rehydrate() explicitly at app
        // mount to load persisted windows. This avoids race conditions in tests
        // and gives the caller full control over when persistence kicks in.
        skipHydration: true,
      },
    ),
    { name: 'FloatingWindowsStore' },
  ),
);
