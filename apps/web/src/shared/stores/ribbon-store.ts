/**
 * ribbon-store.ts -- Zustand store for the ribbon (vertical icon strip).
 *
 * Persisted to localStorage under 'notesaner-ribbon'.
 *
 * Responsibilities:
 *   - Track the ordered list of ribbon action IDs
 *   - Track per-icon visibility (show/hide)
 *   - Support plugin-registered ribbon actions via registerRibbonAction()
 *   - Toggle state for built-in actions (e.g. file explorer open/closed)
 *   - Reorder icons via drag-and-drop
 *
 * Built-in actions are always present; plugin-registered actions are appended
 * after the built-in set and also persisted for ordering/visibility.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Built-in ribbon action IDs that ship with the app. */
export type BuiltInRibbonActionId =
  | 'file-explorer'
  | 'search'
  | 'graph-view'
  | 'daily-note'
  | 'new-note';

/** A single ribbon action definition. */
export interface RibbonAction {
  /** Unique identifier. Built-in IDs are type-safe; plugin IDs are freeform strings. */
  id: string;
  /** Display label shown in tooltip. */
  label: string;
  /** Keyboard shortcut ID from the shortcut registry (optional). */
  shortcutId?: string;
  /**
   * Whether this is a toggle-style action (e.g. file explorer open/close).
   * When true, the ribbon icon shows an active state when its toggle is on.
   */
  isToggle?: boolean;
  /** Whether this action was registered by a plugin (not built-in). */
  isPlugin?: boolean;
  /**
   * Ant Design icon name (for built-in icons).
   * Plugin actions supply their own icon via the registration API.
   */
  iconName?: string;
}

/** The full set of default built-in ribbon actions. */
export const DEFAULT_RIBBON_ACTIONS: RibbonAction[] = [
  {
    id: 'file-explorer',
    label: 'File Explorer',
    shortcutId: 'toggle-left-sidebar',
    isToggle: true,
    iconName: 'FolderOutlined',
  },
  {
    id: 'search',
    label: 'Search',
    shortcutId: 'global-search',
    iconName: 'SearchOutlined',
  },
  {
    id: 'graph-view',
    label: 'Graph View',
    iconName: 'ApartmentOutlined',
  },
  {
    id: 'daily-note',
    label: 'Daily Note',
    iconName: 'CalendarOutlined',
  },
  {
    id: 'new-note',
    label: 'New Note',
    shortcutId: 'new-note',
    iconName: 'FileAddOutlined',
  },
];

/** Default ordering: built-in IDs in their canonical order. */
const DEFAULT_ORDER: string[] = DEFAULT_RIBBON_ACTIONS.map((a) => a.id);

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface RibbonState {
  // ---- State ----

  /** Ordered array of ribbon action IDs (determines display order). */
  order: string[];

  /** Set of hidden action IDs. An action in this set is not rendered. */
  hiddenIds: string[];

  /**
   * Plugin-registered actions. Keyed by action ID.
   * These extend the built-in set at runtime.
   */
  pluginActions: Record<string, RibbonAction>;

  /**
   * Active toggle states. Keyed by action ID.
   * Only relevant for actions with isToggle: true.
   * Built-in toggles are driven externally (e.g. sidebar store);
   * this map is used for plugin-registered toggles.
   */
  pluginToggles: Record<string, boolean>;

  // ---- Actions ----

  /** Reorder an action to a new index. */
  reorder: (actionId: string, newIndex: number) => void;

  /** Toggle visibility of a ribbon action. */
  toggleVisibility: (actionId: string) => void;

  /** Set explicit visibility for a ribbon action. */
  setVisible: (actionId: string, visible: boolean) => void;

  /**
   * Register a plugin ribbon action.
   * Appends to the end of the order if not already present.
   */
  registerPluginAction: (action: RibbonAction) => void;

  /** Unregister a plugin ribbon action. */
  unregisterPluginAction: (actionId: string) => void;

  /** Set the toggle state for a plugin toggle action. */
  setPluginToggle: (actionId: string, active: boolean) => void;

  /** Reset order and visibility to defaults (preserves plugin registrations). */
  resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRibbonStore = create<RibbonState>()(
  devtools(
    persist(
      (set) => ({
        // ---- Initial state ----
        order: DEFAULT_ORDER,
        hiddenIds: [],
        pluginActions: {},
        pluginToggles: {},

        // ---- Actions ----

        reorder: (actionId, newIndex) =>
          set(
            (state) => {
              const currentOrder = [...state.order];
              const currentIndex = currentOrder.indexOf(actionId);
              if (currentIndex === -1) return state;

              currentOrder.splice(currentIndex, 1);
              const clampedIndex = Math.min(newIndex, currentOrder.length);
              currentOrder.splice(clampedIndex, 0, actionId);

              return { order: currentOrder };
            },
            false,
            'ribbon/reorder',
          ),

        toggleVisibility: (actionId) =>
          set(
            (state) => {
              const isHidden = state.hiddenIds.includes(actionId);
              return {
                hiddenIds: isHidden
                  ? state.hiddenIds.filter((id) => id !== actionId)
                  : [...state.hiddenIds, actionId],
              };
            },
            false,
            'ribbon/toggleVisibility',
          ),

        setVisible: (actionId, visible) =>
          set(
            (state) => ({
              hiddenIds: visible
                ? state.hiddenIds.filter((id) => id !== actionId)
                : state.hiddenIds.includes(actionId)
                  ? state.hiddenIds
                  : [...state.hiddenIds, actionId],
            }),
            false,
            'ribbon/setVisible',
          ),

        registerPluginAction: (action) =>
          set(
            (state) => {
              const newPluginActions = {
                ...state.pluginActions,
                [action.id]: { ...action, isPlugin: true },
              };
              // Add to order if not already present
              const newOrder = state.order.includes(action.id)
                ? state.order
                : [...state.order, action.id];

              return {
                pluginActions: newPluginActions,
                order: newOrder,
              };
            },
            false,
            'ribbon/registerPluginAction',
          ),

        unregisterPluginAction: (actionId) =>
          set(
            (state) => {
              const newPluginActions = { ...state.pluginActions };
              delete newPluginActions[actionId];

              return {
                pluginActions: newPluginActions,
                order: state.order.filter((id) => id !== actionId),
                hiddenIds: state.hiddenIds.filter((id) => id !== actionId),
              };
            },
            false,
            'ribbon/unregisterPluginAction',
          ),

        setPluginToggle: (actionId, active) =>
          set(
            (state) => ({
              pluginToggles: { ...state.pluginToggles, [actionId]: active },
            }),
            false,
            'ribbon/setPluginToggle',
          ),

        resetToDefaults: () =>
          set(
            (state) => {
              // Keep plugin action IDs at the end of default order
              const pluginIds = Object.keys(state.pluginActions);
              return {
                order: [...DEFAULT_ORDER, ...pluginIds],
                hiddenIds: [],
              };
            },
            false,
            'ribbon/resetToDefaults',
          ),
      }),
      {
        name: 'notesaner-ribbon',
        version: 1,
        partialize: (state) => ({
          order: state.order,
          hiddenIds: state.hiddenIds,
          // pluginActions are NOT persisted -- plugins re-register on mount.
          // pluginToggles are NOT persisted -- they are transient runtime state.
        }),
      },
    ),
    { name: 'RibbonStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Returns the full action definition for a given action ID.
 * Checks built-in actions first, then plugin-registered actions.
 */
export function getActionDefinition(
  actionId: string,
  pluginActions: Record<string, RibbonAction>,
): RibbonAction | undefined {
  return DEFAULT_RIBBON_ACTIONS.find((a) => a.id === actionId) ?? pluginActions[actionId];
}

/**
 * Returns the ordered list of visible ribbon actions with their definitions.
 * This is a pure function (no hooks) for composition with selectors.
 */
export function getVisibleActions(
  order: string[],
  hiddenIds: string[],
  pluginActions: Record<string, RibbonAction>,
): RibbonAction[] {
  return order
    .filter((id) => !hiddenIds.includes(id))
    .map((id) => getActionDefinition(id, pluginActions))
    .filter((action): action is RibbonAction => action !== undefined);
}

// ---------------------------------------------------------------------------
// Plugin API — convenience wrapper for registerRibbonAction()
// ---------------------------------------------------------------------------

/**
 * Register a ribbon action from a plugin. Returns an unregister function.
 *
 * @example
 * ```ts
 * const unregister = registerRibbonAction({
 *   id: 'plugin-kanban',
 *   label: 'Kanban Board',
 *   iconName: 'ProjectOutlined',
 * });
 *
 * // Cleanup:
 * unregister();
 * ```
 */
export function registerRibbonAction(action: Omit<RibbonAction, 'isPlugin'>): () => void {
  const store = useRibbonStore.getState();
  store.registerPluginAction({ ...action, isPlugin: true });

  return () => {
    useRibbonStore.getState().unregisterPluginAction(action.id);
  };
}
