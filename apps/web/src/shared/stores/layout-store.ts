// NOTE: Mixed store — business + transient UI state. Zustand is kept because:
//   - Persisted fields (currentLayout, activeLayoutId, savedLayouts) require
//     localStorage persistence, which Zustand provides via the persist middleware.
//   - Transient UI fields (isResizing, draggedPanelId, snapZoneActive,
//     isSnapPickerOpen) are excluded from persistence via `partialize`.
//     Splitting them into a separate React Context would add complexity
//     without clear benefit — they are tightly coupled to the layout actions.
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SavedLayout, SnapTemplateId } from '@/features/workspace/model/snap-layout-types';
import { SNAP_TEMPLATES } from '@/features/workspace/model/snap-layout-types';

type SnapZone =
  | 'left-half'
  | 'right-half'
  | 'top-half'
  | 'bottom-half'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-third'
  | 'center-third'
  | 'right-third';

export interface PanelConfig {
  id: string;
  type: 'editor' | 'graph' | 'preview' | 'terminal';
  noteId?: string;
  /** Size as a percentage of the available space in the split direction */
  size: number;
}

export interface TabConfig {
  id: string;
  panelId: string;
  noteId: string;
  title: string;
  isPinned: boolean;
  isDirty: boolean;
}

/**
 * Grid configuration for the CSS Grid-based layout system.
 * When present, this replaces the older snapTemplateId + customRatios approach.
 */
export interface GridLayoutConfig {
  columns: string[];
  rows: string[];
  panes: Array<{
    id: string;
    gridArea: string;
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
    focusedNoteId: string | null;
  }>;
}

export interface LayoutConfig {
  panels: PanelConfig[];
  tabs: TabConfig[];
  splitDirection: 'horizontal' | 'vertical' | null;
  /** Active snap template id for grid rendering */
  snapTemplateId?: SnapTemplateId;
  /** Custom ratios in CSS fr units per column/row, e.g. [7, 3] for 70/30 */
  customRatios?: number[];
  /**
   * Full grid layout configuration. When present, the new CSS Grid system
   * uses this directly rather than deriving from snapTemplateId + customRatios.
   */
  gridLayout?: GridLayoutConfig;
}

interface LayoutDto {
  id: string;
  name: string;
  config: LayoutConfig;
  createdAt: string;
}

const DEFAULT_LAYOUT: LayoutConfig = {
  panels: [{ id: 'main', type: 'editor', size: 100 }],
  tabs: [],
  splitDirection: null,
  snapTemplateId: 'single',
};

interface LayoutState {
  // State
  layouts: LayoutDto[];
  activeLayoutId: string | null;
  currentLayout: LayoutConfig;
  isResizing: boolean;
  draggedPanelId: string | null;
  snapZoneActive: SnapZone | null;
  /** Whether the snap layout picker popup is open */
  isSnapPickerOpen: boolean;
  /** Named layouts saved by the user (persisted in localStorage) */
  savedLayouts: SavedLayout[];

  // Actions
  setLayout: (config: LayoutConfig) => void;
  setLayouts: (layouts: LayoutDto[]) => void;
  loadLayout: (layoutId: string) => void;
  splitPanel: (panelId: string, direction: 'horizontal' | 'vertical') => void;
  closePanel: (panelId: string) => void;
  resizePanel: (panelId: string, size: number) => void;
  openTab: (tab: Omit<TabConfig, 'isPinned' | 'isDirty'>) => void;
  closeTab: (tabId: string) => void;
  moveTab: (tabId: string, targetPanelId: string) => void;
  pinTab: (tabId: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  setResizing: (isResizing: boolean) => void;
  setDraggedPanel: (panelId: string | null) => void;
  setSnapZone: (zone: SnapZone | null) => void;
  /** Open or close the snap layout picker popup */
  setSnapPickerOpen: (open: boolean) => void;
  /** Apply a snap template, generating panels from its definition */
  applySnapTemplate: (templateId: SnapTemplateId) => void;
  /** Update custom column/row ratios after a divider drag */
  setCustomRatios: (ratios: number[]) => void;
  /** Save the current layout under a custom name */
  saveCurrentLayout: (name: string) => void;
  /** Load a previously saved named layout */
  loadSavedLayout: (savedLayoutId: string) => void;
  /** Delete a saved layout by id */
  deleteSavedLayout: (savedLayoutId: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        layouts: [],
        activeLayoutId: null,
        currentLayout: DEFAULT_LAYOUT,
        isResizing: false,
        draggedPanelId: null,
        snapZoneActive: null,
        isSnapPickerOpen: false,
        savedLayouts: [],

        // Actions
        setLayout: (config) => set({ currentLayout: config }, false, 'layout/setLayout'),

        setLayouts: (layouts) => set({ layouts }, false, 'layout/setLayouts'),

        loadLayout: (layoutId) => {
          const layout = get().layouts.find((l) => l.id === layoutId);
          if (layout) {
            set(
              { activeLayoutId: layoutId, currentLayout: layout.config },
              false,
              'layout/loadLayout',
            );
          }
        },

        splitPanel: (panelId, direction) =>
          set(
            (state) => {
              const panels = state.currentLayout.panels;
              const target = panels.find((p) => p.id === panelId);
              if (!target) return state;

              const newPanel: PanelConfig = {
                id: `panel-${Date.now()}`,
                type: 'editor',
                size: target.size / 2,
              };
              const updatedPanels = panels.map((p) =>
                p.id === panelId ? { ...p, size: p.size / 2 } : p,
              );

              return {
                currentLayout: {
                  ...state.currentLayout,
                  panels: [...updatedPanels, newPanel],
                  splitDirection: direction,
                },
              };
            },
            false,
            'layout/splitPanel',
          ),

        closePanel: (panelId) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                panels: state.currentLayout.panels.filter((p) => p.id !== panelId),
                tabs: state.currentLayout.tabs.filter((t) => t.panelId !== panelId),
              },
            }),
            false,
            'layout/closePanel',
          ),

        resizePanel: (panelId, size) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                panels: state.currentLayout.panels.map((p) =>
                  p.id === panelId ? { ...p, size } : p,
                ),
              },
            }),
            false,
            'layout/resizePanel',
          ),

        openTab: (tab) =>
          set(
            (state) => {
              // If already open, just activate the panel
              const existing = state.currentLayout.tabs.find((t) => t.noteId === tab.noteId);
              if (existing) return state;

              return {
                currentLayout: {
                  ...state.currentLayout,
                  tabs: [...state.currentLayout.tabs, { ...tab, isPinned: false, isDirty: false }],
                },
              };
            },
            false,
            'layout/openTab',
          ),

        closeTab: (tabId) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                tabs: state.currentLayout.tabs.filter((t) => t.id !== tabId),
              },
            }),
            false,
            'layout/closeTab',
          ),

        moveTab: (tabId, targetPanelId) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                tabs: state.currentLayout.tabs.map((t) =>
                  t.id === tabId ? { ...t, panelId: targetPanelId } : t,
                ),
              },
            }),
            false,
            'layout/moveTab',
          ),

        pinTab: (tabId) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                tabs: state.currentLayout.tabs.map((t) =>
                  t.id === tabId ? { ...t, isPinned: !t.isPinned } : t,
                ),
              },
            }),
            false,
            'layout/pinTab',
          ),

        markTabDirty: (tabId, isDirty) =>
          set(
            (state) => ({
              currentLayout: {
                ...state.currentLayout,
                tabs: state.currentLayout.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
              },
            }),
            false,
            'layout/markTabDirty',
          ),

        setResizing: (isResizing) => set({ isResizing }, false, 'layout/setResizing'),

        setDraggedPanel: (draggedPanelId) =>
          set({ draggedPanelId }, false, 'layout/setDraggedPanel'),

        setSnapZone: (snapZoneActive) => set({ snapZoneActive }, false, 'layout/setSnapZone'),

        setSnapPickerOpen: (isSnapPickerOpen) =>
          set({ isSnapPickerOpen }, false, 'layout/setSnapPickerOpen'),

        applySnapTemplate: (templateId) =>
          set(
            (state) => {
              const template = SNAP_TEMPLATES.find((t) => t.id === templateId);
              if (!template) return state;

              // Re-use existing tabs, distribute evenly across new panels
              const existingTabs = state.currentLayout.tabs;

              // Build panels from template definition
              const newPanels: PanelConfig[] = template.panels.map((_tp, i) => ({
                id: `panel-${i + 1}`,
                type: 'editor' as const,
                size: Math.floor(100 / template.panels.length),
              }));

              // Re-assign tabs: keep them in their closest existing panel
              const reassignedTabs = existingTabs.map((tab, i) => ({
                ...tab,
                panelId: newPanels[i % newPanels.length]?.id ?? newPanels[0].id,
              }));

              // Build grid layout config from template
              const gridLayout: GridLayoutConfig = {
                columns: template.gridCols.split(/\s+/),
                rows: template.gridRows.split(/\s+/),
                panes: template.panels.map((tp) => ({
                  id: tp.id,
                  gridArea: tp.id,
                  colStart: tp.colStart,
                  colEnd: tp.colEnd,
                  rowStart: tp.rowStart,
                  rowEnd: tp.rowEnd,
                  focusedNoteId: null,
                })),
              };

              return {
                currentLayout: {
                  panels: newPanels,
                  tabs: reassignedTabs,
                  splitDirection: template.panels.length > 1 ? 'horizontal' : null,
                  snapTemplateId: templateId,
                  customRatios: undefined,
                  gridLayout,
                },
                isSnapPickerOpen: false,
              };
            },
            false,
            'layout/applySnapTemplate',
          ),

        setCustomRatios: (customRatios) =>
          set(
            (state) => ({
              currentLayout: { ...state.currentLayout, customRatios },
            }),
            false,
            'layout/setCustomRatios',
          ),

        saveCurrentLayout: (name) =>
          set(
            (state) => {
              const saved: SavedLayout = {
                id: `saved-${Date.now()}`,
                name,
                templateId: state.currentLayout.snapTemplateId ?? 'single',
                customRatios: state.currentLayout.customRatios,
                gridConfig: state.currentLayout.gridLayout
                  ? {
                      columns: state.currentLayout.gridLayout.columns,
                      rows: state.currentLayout.gridLayout.rows,
                      panes: state.currentLayout.gridLayout.panes,
                    }
                  : undefined,
                createdAt: new Date().toISOString(),
              };
              return { savedLayouts: [...state.savedLayouts, saved] };
            },
            false,
            'layout/saveCurrentLayout',
          ),

        loadSavedLayout: (savedLayoutId) =>
          set(
            (state) => {
              const saved = state.savedLayouts.find((l) => l.id === savedLayoutId);
              if (!saved) return state;

              const template = SNAP_TEMPLATES.find((t) => t.id === saved.templateId);
              if (!template) return state;

              const newPanels: PanelConfig[] = template.panels.map((_p, i) => ({
                id: `panel-${i + 1}`,
                type: 'editor' as const,
                size: Math.floor(100 / template.panels.length),
              }));

              // Restore grid layout from saved config, or derive from template
              const gridLayout: GridLayoutConfig = saved.gridConfig
                ? {
                    columns: saved.gridConfig.columns,
                    rows: saved.gridConfig.rows,
                    panes: saved.gridConfig.panes,
                  }
                : {
                    columns:
                      (saved.customRatios ?? template.gridCols.split(/\s+/).map(() => 1)).length > 0
                        ? saved.customRatios
                          ? saved.customRatios.map((r) => `${r}fr`)
                          : template.gridCols.split(/\s+/)
                        : template.gridCols.split(/\s+/),
                    rows: template.gridRows.split(/\s+/),
                    panes: template.panels.map((tp) => ({
                      id: tp.id,
                      gridArea: tp.id,
                      colStart: tp.colStart,
                      colEnd: tp.colEnd,
                      rowStart: tp.rowStart,
                      rowEnd: tp.rowEnd,
                      focusedNoteId: null,
                    })),
                  };

              return {
                currentLayout: {
                  panels: newPanels,
                  tabs: state.currentLayout.tabs.map((tab, i) => ({
                    ...tab,
                    panelId: newPanels[i % newPanels.length]?.id ?? newPanels[0].id,
                  })),
                  splitDirection: template.panels.length > 1 ? 'horizontal' : null,
                  snapTemplateId: saved.templateId,
                  customRatios: saved.customRatios,
                  gridLayout,
                },
                isSnapPickerOpen: false,
              };
            },
            false,
            'layout/loadSavedLayout',
          ),

        deleteSavedLayout: (savedLayoutId) =>
          set(
            (state) => ({
              savedLayouts: state.savedLayouts.filter((l) => l.id !== savedLayoutId),
            }),
            false,
            'layout/deleteSavedLayout',
          ),
      }),
      {
        name: 'notesaner-layout',
        partialize: (state) => ({
          currentLayout: state.currentLayout,
          activeLayoutId: state.activeLayoutId,
          savedLayouts: state.savedLayouts,
        }),
      },
    ),
    { name: 'LayoutStore' },
  ),
);
