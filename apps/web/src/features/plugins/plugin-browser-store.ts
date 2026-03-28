/**
 * plugin-browser-store.ts
 *
 * Zustand store for the plugin discovery / browser UI.
 *
 * Responsibilities:
 *   - Hold the current registry search results and pagination cursor
 *   - Track search query, tag filters, and sort selection
 *   - Track async loading and error states for search + install operations
 *   - Track which plugin detail modal is open
 *
 * Design:
 *   - This store is purely for browser UI state (distinct from
 *     useInstalledPluginStore which tracks installed-plugin metadata).
 *   - Search results are re-fetched from the API on filter changes.
 *   - Install/uninstall actions delegate to pluginRegistryApi; the
 *     caller is responsible for injecting the access token.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { RegistryPlugin, RegistrySearchParams, RegistrySortBy } from './plugin-registry-api';
import { pluginRegistryApi } from './plugin-registry-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Async operation status for browser-level operations. */
export type BrowserOpStatus = 'idle' | 'loading' | 'success' | 'error';

/** State of a single install / uninstall operation keyed by plugin id. */
export interface PluginBrowserOpState {
  status: BrowserOpStatus;
  error?: string;
}

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

interface PluginBrowserState {
  // ---- Search filters ----
  query: string;
  selectedTags: string[];
  sortBy: RegistrySortBy;

  // ---- Registry results ----
  plugins: RegistryPlugin[];
  total: number;
  cursor: string | null;
  searchStatus: BrowserOpStatus;
  searchError: string | null;

  // ---- All known tags (derived from results + well-known list) ----
  availableTags: string[];

  // ---- Detail modal ----
  detailPlugin: RegistryPlugin | null;
  detailStatus: BrowserOpStatus;
  detailError: string | null;

  // ---- Per-plugin install/uninstall operations ----
  operations: Record<string, PluginBrowserOpState>;

  // ---- Set of installed plugin ids in the current workspace (mirrored for
  //      quick badge rendering without a full store join). ----
  installedPluginIds: Set<string>;

  // ---- Actions ----

  setQuery: (query: string) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  setSortBy: (sortBy: RegistrySortBy) => void;

  /**
   * Fetch the first page of results using the current filters.
   * Replaces any existing results.
   */
  search: (token: string) => Promise<void>;

  /**
   * Append the next page of results (infinite scroll).
   * No-op when cursor is null.
   */
  loadMore: (token: string) => Promise<void>;

  /**
   * Open the detail modal for a plugin.
   * If the detail data is not already fetched, triggers an API call.
   */
  openDetail: (token: string, plugin: RegistryPlugin) => Promise<void>;

  /** Close the detail modal. */
  closeDetail: () => void;

  /**
   * Install a plugin in the current workspace.
   */
  installPlugin: (token: string, workspaceId: string, plugin: RegistryPlugin) => Promise<void>;

  /**
   * Uninstall a plugin from the current workspace.
   */
  uninstallPlugin: (token: string, workspaceId: string, pluginId: string) => Promise<void>;

  /**
   * Synchronise the set of installed plugin ids (call after workspace loads).
   */
  setInstalledPluginIds: (ids: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

export const usePluginBrowserStore = create<PluginBrowserState>()(
  devtools(
    (set, get) => ({
      // ---- Initial state ----

      query: '',
      selectedTags: [],
      sortBy: 'stars',

      plugins: [],
      total: 0,
      cursor: null,
      searchStatus: 'idle',
      searchError: null,

      availableTags: [],

      detailPlugin: null,
      detailStatus: 'idle',
      detailError: null,

      operations: {},

      installedPluginIds: new Set(),

      // ---- Filter mutations ----

      setQuery: (query) => set({ query }, false, 'browser/setQuery'),

      toggleTag: (tag) =>
        set(
          (state) => {
            const already = state.selectedTags.includes(tag);
            return {
              selectedTags: already
                ? state.selectedTags.filter((t) => t !== tag)
                : [...state.selectedTags, tag],
            };
          },
          false,
          'browser/toggleTag',
        ),

      clearTags: () => set({ selectedTags: [] }, false, 'browser/clearTags'),

      setSortBy: (sortBy) => set({ sortBy }, false, 'browser/setSortBy'),

      // ---- Search ----

      search: async (token) => {
        const { query, selectedTags, sortBy } = get();
        set({ searchStatus: 'loading', searchError: null }, false, 'browser/search/start');

        try {
          const params: RegistrySearchParams = {
            q: query || undefined,
            tags: selectedTags.length ? selectedTags : undefined,
            sortBy,
            limit: 20,
          };

          const result = await pluginRegistryApi.search(token, params);

          // Collect unique tags from results to populate the tag sidebar
          const tagSet = new Set(get().availableTags);
          for (const plugin of result.plugins) {
            for (const tag of plugin.tags) {
              tagSet.add(tag);
            }
          }

          set(
            {
              plugins: result.plugins,
              total: result.total,
              cursor: result.cursor,
              searchStatus: 'success',
              availableTags: Array.from(tagSet).sort(),
            },
            false,
            'browser/search/success',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({ searchStatus: 'error', searchError: message }, false, 'browser/search/error');
        }
      },

      loadMore: async (token) => {
        const { cursor, searchStatus, query, selectedTags, sortBy, plugins } = get();
        if (!cursor || searchStatus === 'loading') return;

        set({ searchStatus: 'loading', searchError: null }, false, 'browser/loadMore/start');

        try {
          const result = await pluginRegistryApi.search(token, {
            q: query || undefined,
            tags: selectedTags.length ? selectedTags : undefined,
            sortBy,
            cursor,
            limit: 20,
          });

          const tagSet = new Set(get().availableTags);
          for (const plugin of result.plugins) {
            for (const tag of plugin.tags) {
              tagSet.add(tag);
            }
          }

          set(
            {
              plugins: [...plugins, ...result.plugins],
              total: result.total,
              cursor: result.cursor,
              searchStatus: 'success',
              availableTags: Array.from(tagSet).sort(),
            },
            false,
            'browser/loadMore/success',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({ searchStatus: 'error', searchError: message }, false, 'browser/loadMore/error');
        }
      },

      // ---- Detail modal ----

      openDetail: async (token, plugin) => {
        // Immediately open with known data; fetch full details in background
        set(
          {
            detailPlugin: plugin,
            detailStatus: 'loading',
            detailError: null,
          },
          false,
          'browser/openDetail/start',
        );

        try {
          const full = await pluginRegistryApi.getDetail(token, plugin.repository);
          set({ detailPlugin: full, detailStatus: 'success' }, false, 'browser/openDetail/success');
        } catch (err) {
          // Non-fatal: keep partial data, show error state
          const message = err instanceof Error ? err.message : String(err);
          set({ detailStatus: 'error', detailError: message }, false, 'browser/openDetail/error');
        }
      },

      closeDetail: () =>
        set(
          { detailPlugin: null, detailStatus: 'idle', detailError: null },
          false,
          'browser/closeDetail',
        ),

      // ---- Install / uninstall ----

      installPlugin: async (token, workspaceId, plugin) => {
        const key = plugin.id;
        set(
          (state) => ({
            operations: {
              ...state.operations,
              [key]: { status: 'loading' },
            },
          }),
          false,
          'browser/install/start',
        );

        try {
          await pluginRegistryApi.install(token, workspaceId, {
            repository: plugin.repository,
          });

          set(
            (state) => ({
              operations: {
                ...state.operations,
                [key]: { status: 'success' },
              },
              installedPluginIds: new Set([...state.installedPluginIds, key]),
            }),
            false,
            'browser/install/success',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set(
            (state) => ({
              operations: {
                ...state.operations,
                [key]: { status: 'error', error: message },
              },
            }),
            false,
            'browser/install/error',
          );
          throw err;
        }
      },

      uninstallPlugin: async (token, workspaceId, pluginId) => {
        set(
          (state) => ({
            operations: {
              ...state.operations,
              [pluginId]: { status: 'loading' },
            },
          }),
          false,
          'browser/uninstall/start',
        );

        try {
          await pluginRegistryApi.uninstall(token, workspaceId, pluginId);

          set(
            (state) => {
              const next = new Set(state.installedPluginIds);
              next.delete(pluginId);
              return {
                operations: {
                  ...state.operations,
                  [pluginId]: { status: 'success' },
                },
                installedPluginIds: next,
              };
            },
            false,
            'browser/uninstall/success',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set(
            (state) => ({
              operations: {
                ...state.operations,
                [pluginId]: { status: 'error', error: message },
              },
            }),
            false,
            'browser/uninstall/error',
          );
          throw err;
        }
      },

      // ---- Installed IDs sync ----

      setInstalledPluginIds: (ids) =>
        set({ installedPluginIds: ids }, false, 'browser/setInstalledIds'),
    }),
    { name: 'PluginBrowserStore' },
  ),
);

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/**
 * Return the operation state for a specific plugin, defaulting to idle.
 */
export function selectBrowserPluginOp(
  operations: Record<string, PluginBrowserOpState>,
  pluginId: string,
): PluginBrowserOpState {
  return operations[pluginId] ?? { status: 'idle' };
}
