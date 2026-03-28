/**
 * preferences.ts
 *
 * API client for user preferences endpoints.
 *
 * Wraps the generic key-value preferences API (GET/PATCH/DELETE /users/me/preferences).
 * Used by favorites-store and other stores that persist per-user configuration.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreferenceResponse {
  key: string;
  value: unknown;
  updatedAt: string;
}

export type PreferencesMap = Record<string, unknown>;

export interface BulkPreferenceEntry {
  key: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const preferencesApi = {
  /**
   * GET /api/users/me/preferences
   * Returns all preferences as a key-value map, merged with server defaults.
   */
  async getAll(token: string): Promise<PreferencesMap> {
    return apiClient.get<PreferencesMap>('/api/users/me/preferences', { token });
  },

  /**
   * GET /api/users/me/preferences/:key
   * Returns a single preference by key.
   */
  async getByKey(token: string, key: string): Promise<PreferenceResponse> {
    return apiClient.get<PreferenceResponse>(
      `/api/users/me/preferences/${encodeURIComponent(key)}`,
      {
        token,
      },
    );
  },

  /**
   * PATCH /api/users/me/preferences/:key
   * Set (upsert) a single preference.
   */
  async set(token: string, key: string, value: unknown): Promise<PreferenceResponse> {
    return apiClient.patch<PreferenceResponse>(
      `/api/users/me/preferences/${encodeURIComponent(key)}`,
      { value },
      { token },
    );
  },

  /**
   * PATCH /api/users/me/preferences
   * Bulk upsert multiple preferences.
   */
  async bulkSet(token: string, preferences: BulkPreferenceEntry[]): Promise<PreferencesMap> {
    return apiClient.patch<PreferencesMap>('/api/users/me/preferences', { preferences }, { token });
  },

  /**
   * DELETE /api/users/me/preferences/:key
   * Delete a single preference.
   */
  async delete(token: string, key: string): Promise<void> {
    await apiClient.delete(`/api/users/me/preferences/${encodeURIComponent(key)}`, { token });
  },
};
