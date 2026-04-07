// NOTE: UI configuration store, kept in Zustand for localStorage persistence.
// All current fields (sidebar visibility, widths, panel layout, expanded folders)
// are persisted so the user's workspace arrangement survives page reloads.
// No transient-only UI state exists here — if hover/focus indicators are added
// in the future, they should use local component state or React Context.
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SidebarSide } from '@/features/workspace/model/PanelRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted state for a single panel instance within a sidebar. */
export interface PanelConfig {
  /** Panel type ID (references PanelRegistry). */
  id: string;
  /** Which sidebar the panel currently belongs to. */
  sidebar: SidebarSide;
  /** Sort order within its sidebar (0-based). */
  order: number;
  /** Whether the panel body is collapsed (header still visible). */
  collapsed: boolean;
}

interface SidebarState {
  // -- Sidebar visibility --
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  // -- Sidebar widths --
  leftSidebarWidth: number;
  rightSidebarWidth: number;

  // -- Panel layout (ordered arrays of panel IDs per sidebar) --
  leftPanels: string[];
  rightPanels: string[];

  // -- Panel collapse state (keyed by panel ID) --
  collapsedPanels: Record<string, boolean>;

  // -- File explorer state (carried over from v1) --
  expandedFolders: string[];
  selectedFileId: string | null;

  // -- Actions: sidebar visibility --
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;

  // -- Actions: sidebar width --
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;

  // -- Actions: panel management --
  /**
   * Move a panel from one sidebar to another, inserting at the given index.
   * If `toIndex` is not provided, the panel is appended to the target sidebar.
   */
  movePanel: (panelId: string, toSidebar: SidebarSide, toIndex?: number) => void;
  /**
   * Reorder a panel within its current sidebar.
   * Moves `panelId` from its current position to `newIndex`.
   */
  reorderPanel: (panelId: string, newIndex: number) => void;
  /** Toggle the collapsed state of a panel. */
  togglePanelCollapse: (panelId: string) => void;
  /** Set the collapsed state of a panel explicitly. */
  setPanelCollapsed: (panelId: string, collapsed: boolean) => void;
  /** Reset panel layout to defaults (empty sidebars). */
  resetPanelLayout: () => void;

  // -- Actions: file explorer (carried over) --
  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH_RATIO = 0.5; // 50% of viewport

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 280;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampWidth(width: number): number {
  const maxWidth =
    typeof window !== 'undefined' ? window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO : 600;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(width, maxWidth));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSidebarStore = create<SidebarState>()(
  devtools(
    persist(
      (set) => {
        return {
          // -- Initial state --
          // Sidebars are ALWAYS visible (not toggled)
          leftSidebarOpen: true,
          rightSidebarOpen: true,
          leftSidebarWidth: DEFAULT_LEFT_WIDTH,
          rightSidebarWidth: DEFAULT_RIGHT_WIDTH,
          // Sidebars start EMPTY — user drags panels into them
          leftPanels: [],
          rightPanels: [],
          collapsedPanels: {},
          expandedFolders: [],
          selectedFileId: null,

          // -- Sidebar visibility --
          toggleLeftSidebar: () =>
            set(
              (state) => ({ leftSidebarOpen: !state.leftSidebarOpen }),
              false,
              'sidebar/toggleLeft',
            ),

          toggleRightSidebar: () =>
            set(
              (state) => ({ rightSidebarOpen: !state.rightSidebarOpen }),
              false,
              'sidebar/toggleRight',
            ),

          setLeftSidebarOpen: (open) =>
            set({ leftSidebarOpen: open }, false, 'sidebar/setLeftOpen'),

          setRightSidebarOpen: (open) =>
            set({ rightSidebarOpen: open }, false, 'sidebar/setRightOpen'),

          // -- Sidebar width --
          setLeftSidebarWidth: (width) =>
            set({ leftSidebarWidth: clampWidth(width) }, false, 'sidebar/setLeftWidth'),

          setRightSidebarWidth: (width) =>
            set({ rightSidebarWidth: clampWidth(width) }, false, 'sidebar/setRightWidth'),

          // -- Panel management --
          movePanel: (panelId, toSidebar, toIndex) =>
            set(
              (state) => {
                // Remove from current sidebar
                const newLeft = state.leftPanels.filter((id) => id !== panelId);
                const newRight = state.rightPanels.filter((id) => id !== panelId);

                // Insert into target sidebar
                const target = toSidebar === 'left' ? newLeft : newRight;
                const insertAt =
                  toIndex !== undefined ? Math.min(toIndex, target.length) : target.length;
                target.splice(insertAt, 0, panelId);

                return {
                  leftPanels: newLeft,
                  rightPanels: newRight,
                };
              },
              false,
              'sidebar/movePanel',
            ),

          reorderPanel: (panelId, newIndex) =>
            set(
              (state) => {
                const inLeft = state.leftPanels.includes(panelId);
                const panels = inLeft ? [...state.leftPanels] : [...state.rightPanels];

                const currentIndex = panels.indexOf(panelId);
                if (currentIndex === -1) return state;

                // Remove from current position
                panels.splice(currentIndex, 1);
                // Insert at new position
                const clampedIndex = Math.min(newIndex, panels.length);
                panels.splice(clampedIndex, 0, panelId);

                return inLeft ? { leftPanels: panels } : { rightPanels: panels };
              },
              false,
              'sidebar/reorderPanel',
            ),

          togglePanelCollapse: (panelId) =>
            set(
              (state) => ({
                collapsedPanels: {
                  ...state.collapsedPanels,
                  [panelId]: !state.collapsedPanels[panelId],
                },
              }),
              false,
              'sidebar/togglePanelCollapse',
            ),

          setPanelCollapsed: (panelId, collapsed) =>
            set(
              (state) => ({
                collapsedPanels: {
                  ...state.collapsedPanels,
                  [panelId]: collapsed,
                },
              }),
              false,
              'sidebar/setPanelCollapsed',
            ),

          resetPanelLayout: () =>
            set(
              () => {
                return {
                  leftPanels: [],
                  rightPanels: [],
                  collapsedPanels: {},
                };
              },
              false,
              'sidebar/resetPanelLayout',
            ),

          // -- File explorer --
          toggleFolder: (folderId) =>
            set(
              (state) => ({
                expandedFolders: state.expandedFolders.includes(folderId)
                  ? state.expandedFolders.filter((id) => id !== folderId)
                  : [...state.expandedFolders, folderId],
              }),
              false,
              'sidebar/toggleFolder',
            ),

          setSelectedFile: (selectedFileId) =>
            set({ selectedFileId }, false, 'sidebar/setSelectedFile'),
        };
      },
      {
        name: 'notesaner-sidebar',
        version: 3,
        partialize: (state) => ({
          leftSidebarOpen: state.leftSidebarOpen,
          rightSidebarOpen: state.rightSidebarOpen,
          leftSidebarWidth: state.leftSidebarWidth,
          rightSidebarWidth: state.rightSidebarWidth,
          leftPanels: state.leftPanels,
          rightPanels: state.rightPanels,
          collapsedPanels: state.collapsedPanels,
          expandedFolders: state.expandedFolders,
        }),
        migrate: (persisted: unknown, version: number) => {
          // Migrate from v1 or v2 to v3 (empty default panels, both sidebars open)
          if (version < 3) {
            const old = persisted as Record<string, unknown>;
            return {
              ...old,
              leftPanels: [],
              rightPanels: [],
              collapsedPanels: {},
              leftSidebarOpen: true,
              rightSidebarOpen: true,
              // Remove legacy keys
              leftActiveTab: undefined,
              rightActiveTab: undefined,
            };
          }
          return persisted;
        },
      },
    ),
    { name: 'SidebarStore' },
  ),
);
