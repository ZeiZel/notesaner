/**
 * layout-persistence.ts
 *
 * Handles auto-saving the workspace layout to the server and restoring
 * it on login.
 *
 * Design notes:
 *   - Auto-save is debounced at 2 seconds to avoid excessive API calls
 *     during rapid layout changes (resizing, tab switching, etc.).
 *   - Uses Zustand subscribe for reacting to layout changes rather than
 *     useEffect — this keeps the persistence logic outside the React tree.
 *   - The restore function is called once after authentication and loads
 *     the user's last layout from the server.
 *   - Errors in auto-save are silently logged — layout is also persisted
 *     in localStorage via the layout store's persist middleware as a fallback.
 */

import { useLayoutStore, type LayoutConfig } from '@/shared/stores/layout-store';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useGridLayoutStore } from './grid-layout-store';
import { layoutsApi, type LayoutDto, type CreateLayoutDto } from '@/shared/api/layouts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FullLayoutSnapshot {
  layout: LayoutConfig;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftPanels?: string[];
  rightPanels?: string[];
  collapsedPanels?: Record<string, boolean>;
}

export interface LayoutPreset {
  id: string;
  name: string;
  config: LayoutConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Auto-save controller
// ---------------------------------------------------------------------------

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeLayout: (() => void) | null = null;
let unsubscribeSidebar: (() => void) | null = null;
let unsubscribeGrid: (() => void) | null = null;

const AUTO_SAVE_DEBOUNCE_MS = 2000;

/**
 * Captures the current full layout snapshot from all stores.
 * Includes the grid layout configuration for persistence.
 */
function captureSnapshot(): FullLayoutSnapshot {
  const layoutState = useLayoutStore.getState();
  const sidebarState = useSidebarStore.getState();
  const gridState = useGridLayoutStore.getState();

  // Merge current grid config into the layout config for persistence
  const layoutWithGrid: LayoutConfig = {
    ...layoutState.currentLayout,
    gridLayout: {
      columns: gridState.gridConfig.columns,
      rows: gridState.gridConfig.rows,
      panes: gridState.gridConfig.panes,
    },
  };

  return {
    layout: layoutWithGrid,
    leftSidebarOpen: sidebarState.leftSidebarOpen,
    rightSidebarOpen: sidebarState.rightSidebarOpen,
    leftSidebarWidth: sidebarState.leftSidebarWidth,
    rightSidebarWidth: sidebarState.rightSidebarWidth,
    leftPanels: sidebarState.leftPanels,
    rightPanels: sidebarState.rightPanels,
    collapsedPanels: sidebarState.collapsedPanels,
  };
}

/**
 * Schedule an auto-save of the current layout to the server.
 * Debounced at AUTO_SAVE_DEBOUNCE_MS.
 */
function scheduleAutoSave(token: string, workspaceId: string): void {
  if (autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(async () => {
    autoSaveTimer = null;

    try {
      const snapshot = captureSnapshot();
      await layoutsApi.saveCurrent(token, workspaceId, snapshot.layout);
    } catch (error) {
      // Silent fail — localStorage fallback is always active via persist middleware
      if (process.env.NODE_ENV === 'development') {
        console.warn('[layout-persistence] Auto-save failed:', error);
      }
    }
  }, AUTO_SAVE_DEBOUNCE_MS);
}

/**
 * Start auto-saving layout changes to the server.
 *
 * Subscribes to both the layout store and sidebar store. Any change
 * to layout config, sidebar widths, or sidebar open state triggers
 * a debounced save.
 *
 * Call the returned cleanup function to stop auto-saving (e.g. on logout).
 */
export function startAutoSave(token: string, workspaceId: string): () => void {
  // Clean up any previous subscriptions
  stopAutoSave();

  // Subscribe to layout changes using the basic subscribe API.
  // We track the previous reference to detect actual changes.
  let prevLayout = useLayoutStore.getState().currentLayout;
  unsubscribeLayout = useLayoutStore.subscribe((state) => {
    if (state.currentLayout !== prevLayout) {
      prevLayout = state.currentLayout;
      scheduleAutoSave(token, workspaceId);
    }
  });

  let prevSidebarKey = sidebarSnapshotKey(useSidebarStore.getState());
  unsubscribeSidebar = useSidebarStore.subscribe((state) => {
    const key = sidebarSnapshotKey(state);
    if (key !== prevSidebarKey) {
      prevSidebarKey = key;
      scheduleAutoSave(token, workspaceId);
    }
  });

  // Subscribe to grid layout changes
  let prevGridConfig = useGridLayoutStore.getState().gridConfig;
  unsubscribeGrid = useGridLayoutStore.subscribe((state) => {
    if (state.gridConfig !== prevGridConfig) {
      prevGridConfig = state.gridConfig;
      scheduleAutoSave(token, workspaceId);
    }
  });

  return stopAutoSave;
}

/**
 * Stop auto-saving and clean up subscriptions.
 */
export function stopAutoSave(): void {
  if (autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (unsubscribeLayout !== null) {
    unsubscribeLayout();
    unsubscribeLayout = null;
  }
  if (unsubscribeSidebar !== null) {
    unsubscribeSidebar();
    unsubscribeSidebar = null;
  }
  if (unsubscribeGrid !== null) {
    unsubscribeGrid();
    unsubscribeGrid = null;
  }
}

// ---------------------------------------------------------------------------
// Restore layout
// ---------------------------------------------------------------------------

/**
 * Restores the user's last layout from the server.
 *
 * Fetches the default/current layout and applies it to both the layout
 * and sidebar stores. Falls back to localStorage-persisted state if the
 * server has no saved layout.
 */
export async function restoreLayout(token: string, workspaceId: string): Promise<boolean> {
  try {
    const serverLayout = await layoutsApi.getDefault(token, workspaceId);

    if (serverLayout?.config) {
      useLayoutStore.getState().setLayout(serverLayout.config);

      // Restore grid layout config if available
      if (serverLayout.config.gridLayout) {
        useGridLayoutStore.getState().setGridConfig(serverLayout.config.gridLayout);
      } else if (serverLayout.config.snapTemplateId) {
        // Backward compatibility: convert old snap template to grid config
        useGridLayoutStore.getState().applyPreset(serverLayout.config.snapTemplateId);
      }

      return true;
    }
  } catch {
    // 404 or network error — fall back to localStorage-persisted state
    if (process.env.NODE_ENV === 'development') {
      console.warn('[layout-persistence] No server layout found; using local storage fallback.');
    }
  }

  // Check if localStorage has a grid layout to restore
  const localState = useLayoutStore.getState();
  if (localState.currentLayout.gridLayout) {
    useGridLayoutStore.getState().setGridConfig(localState.currentLayout.gridLayout);
  } else if (localState.currentLayout.snapTemplateId) {
    useGridLayoutStore.getState().applyPreset(localState.currentLayout.snapTemplateId);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Layout presets
// ---------------------------------------------------------------------------

/**
 * Fetch all named layout presets for the workspace.
 */
export async function fetchLayoutPresets(
  token: string,
  workspaceId: string,
): Promise<LayoutPreset[]> {
  const response = await layoutsApi.list(token, workspaceId);
  return response.data.map(dtoToPreset);
}

/**
 * Save the current layout as a named preset.
 */
export async function saveLayoutPreset(
  token: string,
  workspaceId: string,
  name: string,
  setAsDefault = false,
): Promise<LayoutPreset> {
  // Capture snapshot includes grid config automatically
  const snapshot = captureSnapshot();
  const dto: CreateLayoutDto = {
    name,
    config: snapshot.layout,
    isDefault: setAsDefault,
  };

  const created = await layoutsApi.create(token, workspaceId, dto);

  // Also save locally for instant access (includes grid config)
  useLayoutStore.getState().saveCurrentLayout(name);

  return dtoToPreset(created);
}

/**
 * Load a named layout preset by applying it to the stores.
 */
export async function loadLayoutPreset(
  token: string,
  workspaceId: string,
  presetId: string,
): Promise<void> {
  const preset = await layoutsApi.get(token, workspaceId, presetId);

  if (preset?.config) {
    useLayoutStore.getState().setLayout(preset.config);

    // Sync grid layout store
    if (preset.config.gridLayout) {
      useGridLayoutStore.getState().setGridConfig(preset.config.gridLayout);
    } else if (preset.config.snapTemplateId) {
      useGridLayoutStore.getState().applyPreset(preset.config.snapTemplateId);
    }
  }
}

/**
 * Delete a named layout preset.
 */
export async function deleteLayoutPreset(
  token: string,
  workspaceId: string,
  presetId: string,
): Promise<void> {
  await layoutsApi.delete(token, workspaceId, presetId);
  useLayoutStore.getState().deleteSavedLayout(presetId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produces a cheap string key for the sidebar state fields we care about.
 * Used for change detection without deep equality.
 */
function sidebarSnapshotKey(state: {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftPanels?: string[];
  rightPanels?: string[];
  collapsedPanels?: Record<string, boolean>;
}): string {
  const panels = `${(state.leftPanels ?? []).join(',')}|${(state.rightPanels ?? []).join(',')}`;
  const collapsed = state.collapsedPanels
    ? Object.entries(state.collapsedPanels)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .sort()
        .join(',')
    : '';
  return `${state.leftSidebarOpen}|${state.rightSidebarOpen}|${state.leftSidebarWidth}|${state.rightSidebarWidth}|${panels}|${collapsed}`;
}

function dtoToPreset(dto: LayoutDto): LayoutPreset {
  return {
    id: dto.id,
    name: dto.name,
    config: dto.config,
    isDefault: dto.isDefault,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
