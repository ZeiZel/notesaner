import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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

interface PanelConfig {
  id: string;
  type: 'editor' | 'graph' | 'preview' | 'terminal';
  noteId?: string;
  size: number; // percentage
}

interface TabConfig {
  id: string;
  panelId: string;
  noteId: string;
  title: string;
  isPinned: boolean;
  isDirty: boolean;
}

interface LayoutConfig {
  panels: PanelConfig[];
  tabs: TabConfig[];
  splitDirection: 'horizontal' | 'vertical' | null;
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
};

interface LayoutState {
  // State
  layouts: LayoutDto[];
  activeLayoutId: string | null;
  currentLayout: LayoutConfig;
  isResizing: boolean;
  draggedPanelId: string | null;
  snapZoneActive: SnapZone | null;

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

        // Actions
        setLayout: (config) =>
          set({ currentLayout: config }, false, 'layout/setLayout'),

        setLayouts: (layouts) =>
          set({ layouts }, false, 'layout/setLayouts'),

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
                panels: state.currentLayout.panels.filter(
                  (p) => p.id !== panelId,
                ),
                tabs: state.currentLayout.tabs.filter(
                  (t) => t.panelId !== panelId,
                ),
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
              const existing = state.currentLayout.tabs.find(
                (t) => t.noteId === tab.noteId,
              );
              if (existing) return state;

              return {
                currentLayout: {
                  ...state.currentLayout,
                  tabs: [
                    ...state.currentLayout.tabs,
                    { ...tab, isPinned: false, isDirty: false },
                  ],
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
                tabs: state.currentLayout.tabs.map((t) =>
                  t.id === tabId ? { ...t, isDirty } : t,
                ),
              },
            }),
            false,
            'layout/markTabDirty',
          ),

        setResizing: (isResizing) =>
          set({ isResizing }, false, 'layout/setResizing'),

        setDraggedPanel: (draggedPanelId) =>
          set({ draggedPanelId }, false, 'layout/setDraggedPanel'),

        setSnapZone: (snapZoneActive) =>
          set({ snapZoneActive }, false, 'layout/setSnapZone'),
      }),
      {
        name: 'notesaner-layout',
        partialize: (state) => ({
          currentLayout: state.currentLayout,
          activeLayoutId: state.activeLayoutId,
        }),
      },
    ),
    { name: 'LayoutStore' },
  ),
);
