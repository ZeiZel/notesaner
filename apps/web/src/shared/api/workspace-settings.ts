/**
 * workspace-settings.ts
 *
 * API client for workspace-level settings endpoints.
 *
 * All calls require a valid JWT access token with ADMIN or OWNER role.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceSettingsDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  ownerId: string;
  /** Whether the workspace's vault is publicly accessible. */
  isPublic: boolean;
  /** Public vault slug (used as subdomain). */
  publicSlug: string | null;
  /** Custom domain for the public vault, if any. */
  customDomain: string | null;
  /** Default theme identifier for the workspace. */
  defaultTheme: string;
  /** CSS snippets applied globally to the workspace. */
  cssSnippets: CssSnippet[];
  /** Sidebar layout defaults. */
  sidebarDefaults: SidebarDefaults;
  createdAt: string;
  updatedAt: string;
}

export interface CssSnippet {
  id: string;
  name: string;
  css: string;
  enabled: boolean;
}

export interface SidebarDefaults {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
}

export interface UpdateWorkspaceGeneralPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface UpdateWorkspaceAppearancePayload {
  defaultTheme?: string;
  cssSnippets?: CssSnippet[];
  sidebarDefaults?: SidebarDefaults;
}

export interface UpdateWorkspacePublishPayload {
  isPublic?: boolean;
  publicSlug?: string | null;
}

export interface TransferOwnershipPayload {
  newOwnerId: string;
}

export interface PublishedNoteDto {
  id: string;
  title: string;
  path: string;
  publishedAt: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const workspaceSettingsApi = {
  /**
   * GET /api/workspaces/:workspaceId/settings
   * Fetch the full workspace settings object.
   */
  getSettings: (token: string, workspaceId: string) =>
    apiClient.get<WorkspaceSettingsDto>(`/api/workspaces/${workspaceId}/settings`, { token }),

  /**
   * PATCH /api/workspaces/:workspaceId/settings/general
   * Update workspace name, slug, description, or icon.
   */
  updateGeneral: (token: string, workspaceId: string, payload: UpdateWorkspaceGeneralPayload) =>
    apiClient.patch<WorkspaceSettingsDto>(
      `/api/workspaces/${workspaceId}/settings/general`,
      payload,
      { token },
    ),

  /**
   * PATCH /api/workspaces/:workspaceId/settings/appearance
   * Update theme, CSS snippets, and sidebar defaults.
   */
  updateAppearance: (
    token: string,
    workspaceId: string,
    payload: UpdateWorkspaceAppearancePayload,
  ) =>
    apiClient.patch<WorkspaceSettingsDto>(
      `/api/workspaces/${workspaceId}/settings/appearance`,
      payload,
      { token },
    ),

  /**
   * PATCH /api/workspaces/:workspaceId/settings/publish
   * Update public vault toggle and public slug.
   */
  updatePublish: (token: string, workspaceId: string, payload: UpdateWorkspacePublishPayload) =>
    apiClient.patch<WorkspaceSettingsDto>(
      `/api/workspaces/${workspaceId}/settings/publish`,
      payload,
      { token },
    ),

  /**
   * GET /api/workspaces/:workspaceId/settings/published-notes
   * List all published notes for the workspace.
   */
  getPublishedNotes: (token: string, workspaceId: string) =>
    apiClient.get<PublishedNoteDto[]>(`/api/workspaces/${workspaceId}/settings/published-notes`, {
      token,
    }),

  /**
   * DELETE /api/workspaces/:workspaceId/settings/published-notes/:noteId
   * Unpublish a specific note.
   */
  unpublishNote: (token: string, workspaceId: string, noteId: string) =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}/settings/published-notes/${noteId}`, {
      token,
    }),

  /**
   * POST /api/workspaces/:workspaceId/transfer-ownership
   * Transfer workspace ownership to another admin member.
   */
  transferOwnership: (token: string, workspaceId: string, payload: TransferOwnershipPayload) =>
    apiClient.post<void>(`/api/workspaces/${workspaceId}/transfer-ownership`, payload, { token }),

  /**
   * DELETE /api/workspaces/:workspaceId
   * Permanently delete the workspace and all its data.
   */
  deleteWorkspace: (token: string, workspaceId: string) =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}`, { token }),
};
