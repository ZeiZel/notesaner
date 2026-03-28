/**
 * workspaces.ts
 *
 * API client for workspace listing and switching endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  role: string;
  memberCount: number;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSwitchResultDto {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
  };
  membership: {
    role: string;
    joinedAt: string;
  };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const workspacesApi = {
  /**
   * GET /api/workspaces
   * List all workspaces the current user is a member of.
   */
  listWorkspaces: (token: string) =>
    apiClient.get<WorkspaceSummaryDto[]>('/api/workspaces', { token }),

  /**
   * POST /api/workspaces/:workspaceId/switch
   * Switch to a workspace (validates membership and returns workspace details).
   */
  switchWorkspace: (token: string, workspaceId: string) =>
    apiClient.post<WorkspaceSwitchResultDto>(`/api/workspaces/${workspaceId}/switch`, undefined, {
      token,
    }),
};
