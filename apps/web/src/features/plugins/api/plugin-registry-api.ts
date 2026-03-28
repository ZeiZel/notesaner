/**
 * plugin-registry-api.ts
 *
 * API client for the Notesaner plugin registry.
 *
 * The registry is backed by the NestJS backend which proxies
 * GitHub repository search (topic: notesaner-plugin).
 *
 * Endpoints:
 *   GET  /api/plugins/registry?q=...&cursor=...&limit=...   — search
 *   GET  /api/plugins/registry/:owner/:repo                 — plugin detail
 *   GET  /api/workspaces/:id/plugins                        — installed list
 *   POST /api/workspaces/:id/plugins/install                — install
 *   DELETE /api/workspaces/:id/plugins/:pluginId            — uninstall
 *   PATCH  /api/workspaces/:id/plugins/:pluginId/toggle     — enable/disable
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

/** A plugin entry as returned by the registry search. */
export interface RegistryPlugin {
  /** GitHub full name "owner/repo" used as a stable identifier. */
  id: string;
  /** Display name derived from the repository name. */
  name: string;
  /** Short description from GitHub repo or manifest. */
  description: string;
  /** Repository owner / organisation name. */
  author: string;
  /** Full GitHub repository URL. */
  repository: string;
  /** Searchable tags (GitHub topics minus "notesaner-plugin"). */
  tags: string[];
  /** Latest published release version. */
  latestVersion: string;
  /** GitHub stargazers count (used for popularity sorting). */
  stars: number;
  /** ISO timestamp of the last push to the repository. */
  updatedAt: string;
  /** Optional: full README content (only present in detail response). */
  readme?: string;
  /** Optional: changelog text (only present in detail response). */
  changelog?: string;
  /** Optional: screenshot URLs (only present in detail response). */
  screenshots?: string[];
}

/** Paginated result from the registry search endpoint. */
export interface RegistrySearchResult {
  plugins: RegistryPlugin[];
  total: number;
  /** Opaque cursor for the next page, or null when exhausted. */
  cursor: string | null;
}

/** Sort options available in the registry browser. */
export type RegistrySortBy = 'stars' | 'updated' | 'name';

/** Parameters for searching the plugin registry. */
export interface RegistrySearchParams {
  /** Free-text search query (name, description, author). */
  q?: string;
  /** Comma-separated tag filter. */
  tags?: string[];
  /** Sort field. */
  sortBy?: RegistrySortBy;
  /** Pagination cursor from a previous response. */
  cursor?: string;
  /** Page size (max 50). */
  limit?: number;
}

/** Payload for the install endpoint. */
export interface InstallPluginPayload {
  repository: string;
  version?: string;
}

/** Result from the install endpoint — reflects the DB record. */
export interface InstalledPluginResponse {
  id: string;
  workspaceId: string;
  pluginId: string;
  name: string;
  version: string;
  repository: string;
  isEnabled: boolean;
  installedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

/**
 * Registry API client.
 *
 * All methods accept an `accessToken` so they can be called from both
 * RSC (server components passing a session token) and client components.
 */
export const pluginRegistryApi = {
  /**
   * Search the plugin registry.
   *
   * @example
   *   const { plugins } = await pluginRegistryApi.search(token, { q: 'calendar', sortBy: 'stars' });
   */
  search: (token: string, params: RegistrySearchParams = {}): Promise<RegistrySearchResult> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));
    if (params.sortBy) searchParams.set('sort', params.sortBy);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit != null) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return apiClient.get<RegistrySearchResult>(`/api/plugins/registry${qs ? `?${qs}` : ''}`, {
      token,
    });
  },

  /**
   * Fetch full details (README, changelog, screenshots) for a single plugin.
   *
   * @param repository  "owner/repo" or full GitHub URL.
   */
  getDetail: (token: string, repository: string): Promise<RegistryPlugin> => {
    const encoded = encodeURIComponent(repository);
    return apiClient.get<RegistryPlugin>(`/api/plugins/registry/${encoded}`, { token });
  },

  /**
   * List all plugins installed in a workspace.
   */
  listInstalled: (token: string, workspaceId: string): Promise<InstalledPluginResponse[]> =>
    apiClient.get<InstalledPluginResponse[]>(`/api/workspaces/${workspaceId}/plugins`, { token }),

  /**
   * Install a plugin into a workspace.
   */
  install: (
    token: string,
    workspaceId: string,
    payload: InstallPluginPayload,
  ): Promise<InstalledPluginResponse> =>
    apiClient.post<InstalledPluginResponse>(
      `/api/workspaces/${workspaceId}/plugins/install`,
      payload,
      { token },
    ),

  /**
   * Uninstall a plugin from a workspace.
   */
  uninstall: (token: string, workspaceId: string, pluginId: string): Promise<void> =>
    apiClient.delete<void>(
      `/api/workspaces/${workspaceId}/plugins/${encodeURIComponent(pluginId)}`,
      { token },
    ),

  /**
   * Enable or disable a plugin in a workspace.
   */
  toggle: (
    token: string,
    workspaceId: string,
    pluginId: string,
    enabled: boolean,
  ): Promise<InstalledPluginResponse> =>
    apiClient.patch<InstalledPluginResponse>(
      `/api/workspaces/${workspaceId}/plugins/${encodeURIComponent(pluginId)}/toggle`,
      { enabled },
      { token },
    ),
};
