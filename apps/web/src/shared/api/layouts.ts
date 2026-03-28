/**
 * layouts.ts
 *
 * API client for workspace layout CRUD operations.
 *
 * Layouts are stored server-side and associated with a workspace.
 * The layout config includes panel arrangement, open tabs, sidebar widths,
 * split configuration, and other workspace presentation state.
 */

import { apiClient } from './client';
import type { LayoutConfig } from '@/shared/stores/layout-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutDto {
  id: string;
  name: string;
  config: LayoutConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLayoutDto {
  name: string;
  config: LayoutConfig;
  isDefault?: boolean;
}

export interface UpdateLayoutDto {
  name?: string;
  config?: LayoutConfig;
  isDefault?: boolean;
}

export interface LayoutListResponse {
  data: LayoutDto[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const layoutsApi = {
  /**
   * GET /workspaces/:workspaceId/layouts
   *
   * Returns all saved layout presets for the workspace.
   */
  list: (token: string, workspaceId: string): Promise<LayoutListResponse> =>
    apiClient.get<LayoutListResponse>(`/api/workspaces/${workspaceId}/layouts`, { token }),

  /**
   * GET /workspaces/:workspaceId/layouts/:layoutId
   *
   * Returns a single layout by ID.
   */
  get: (token: string, workspaceId: string, layoutId: string): Promise<LayoutDto> =>
    apiClient.get<LayoutDto>(`/api/workspaces/${workspaceId}/layouts/${layoutId}`, { token }),

  /**
   * POST /workspaces/:workspaceId/layouts
   *
   * Creates a new layout preset.
   */
  create: (token: string, workspaceId: string, dto: CreateLayoutDto): Promise<LayoutDto> =>
    apiClient.post<LayoutDto>(`/api/workspaces/${workspaceId}/layouts`, dto, { token }),

  /**
   * PUT /workspaces/:workspaceId/layouts/:layoutId
   *
   * Updates an existing layout preset.
   */
  update: (
    token: string,
    workspaceId: string,
    layoutId: string,
    dto: UpdateLayoutDto,
  ): Promise<LayoutDto> =>
    apiClient.put<LayoutDto>(`/api/workspaces/${workspaceId}/layouts/${layoutId}`, dto, { token }),

  /**
   * DELETE /workspaces/:workspaceId/layouts/:layoutId
   *
   * Deletes a layout preset.
   */
  delete: (token: string, workspaceId: string, layoutId: string): Promise<void> =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}/layouts/${layoutId}`, { token }),

  /**
   * GET /workspaces/:workspaceId/layouts/default
   *
   * Returns the default layout for the current user in this workspace.
   * Returns 404 if no default is set.
   */
  getDefault: (token: string, workspaceId: string): Promise<LayoutDto> =>
    apiClient.get<LayoutDto>(`/api/workspaces/${workspaceId}/layouts/default`, { token }),

  /**
   * PUT /workspaces/:workspaceId/layouts/current
   *
   * Persists the current layout state (auto-save).
   * This is a special endpoint that upserts the user's "current" layout
   * without requiring a named preset.
   */
  saveCurrent: (token: string, workspaceId: string, config: LayoutConfig): Promise<LayoutDto> =>
    apiClient.put<LayoutDto>(
      `/api/workspaces/${workspaceId}/layouts/current`,
      { config },
      { token },
    ),
};
