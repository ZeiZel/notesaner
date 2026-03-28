/**
 * plugin-store.ts
 *
 * Zustand store for installed plugin management.
 *
 * Responsibilities:
 *   - Track installed plugins and their metadata
 *   - Manage per-plugin enable/disable state per workspace
 *   - Track async operation states for install/enable/disable
 *
 * NOTE: This is distinct from plugin-browser-store which handles
 * the discovery/search UI. This store manages locally installed plugins.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author: string;
  repository?: string;
  main?: string;
  [key: string]: unknown;
}

export interface InstalledPluginMeta {
  pluginId: string;
  manifest: PluginManifest;
  installedAt: string;
  /** Per-workspace enable/disable mapping */
  enabledWorkspaces: Set<string>;
  /** Optional user-configured settings */
  settings?: Record<string, unknown>;
}

export type PluginOpStatus = 'idle' | 'pending' | 'success' | 'error';

export interface PluginOperationState {
  status: PluginOpStatus;
  error?: string;
}

// ---------------------------------------------------------------------------
// Store state & actions
// ---------------------------------------------------------------------------

interface InstalledPluginStoreState {
  /** Map of pluginId -> metadata */
  installed: Record<string, InstalledPluginMeta>;

  /** Per-plugin operation tracking */
  operations: Record<string, PluginOperationState>;

  /** Enable a plugin for a specific workspace */
  enablePlugin: (pluginId: string, workspaceId: string) => void;

  /** Disable a plugin for a specific workspace */
  disablePlugin: (pluginId: string, workspaceId: string) => void;

  /** Check if a plugin is enabled in a workspace */
  isPluginEnabled: (pluginId: string, workspaceId: string) => boolean;

  /** Install a plugin from metadata */
  installPlugin: (meta: InstalledPluginMeta) => void;

  /** Uninstall a plugin */
  uninstallPlugin: (pluginId: string) => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useInstalledPluginStore = create<InstalledPluginStoreState>()(
  devtools(
    (set, get) => ({
      installed: {},
      operations: {},

      enablePlugin: (pluginId, workspaceId) => {
        set(
          (state) => {
            const plugin = state.installed[pluginId];
            if (!plugin) return state;
            const enabled = new Set(plugin.enabledWorkspaces);
            enabled.add(workspaceId);
            return {
              installed: {
                ...state.installed,
                [pluginId]: { ...plugin, enabledWorkspaces: enabled },
              },
            };
          },
          false,
          'plugins/enable',
        );
      },

      disablePlugin: (pluginId, workspaceId) => {
        set(
          (state) => {
            const plugin = state.installed[pluginId];
            if (!plugin) return state;
            const enabled = new Set(plugin.enabledWorkspaces);
            enabled.delete(workspaceId);
            return {
              installed: {
                ...state.installed,
                [pluginId]: { ...plugin, enabledWorkspaces: enabled },
              },
            };
          },
          false,
          'plugins/disable',
        );
      },

      isPluginEnabled: (pluginId, workspaceId) => {
        const plugin = get().installed[pluginId];
        return plugin?.enabledWorkspaces.has(workspaceId) ?? false;
      },

      installPlugin: (meta) => {
        set(
          (state) => ({
            installed: { ...state.installed, [meta.pluginId]: meta },
          }),
          false,
          'plugins/install',
        );
      },

      uninstallPlugin: (pluginId) => {
        set(
          (state) => {
            const { [pluginId]: _removed, ...rest } = state.installed;
            return { installed: rest };
          },
          false,
          'plugins/uninstall',
        );
      },
    }),
    { name: 'InstalledPluginStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Return an array of all installed plugin metadata, sorted by name.
 */
export function selectInstalledPlugins(
  installed: Record<string, InstalledPluginMeta>,
): InstalledPluginMeta[] {
  return Object.values(installed).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/**
 * Return the operation state for a specific plugin, defaulting to idle.
 */
export function selectPluginOperation(
  operations: Record<string, PluginOperationState>,
  pluginId: string,
): PluginOperationState {
  return operations[pluginId] ?? { status: 'idle' };
}
