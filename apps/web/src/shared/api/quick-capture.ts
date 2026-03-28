/**
 * quick-capture.ts
 *
 * API client for quick capture and tag autocomplete endpoints.
 */

import { apiClient } from './client';
import type { NoteDto, TagDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Request/Response types
// ---------------------------------------------------------------------------

export interface QuickCapturePayload {
  title: string;
  content: string;
  folderId?: string;
  tags?: string[];
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  children: FolderTreeNode[];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const quickCaptureApi = {
  /**
   * POST /api/workspaces/:workspaceId/notes/quick-capture
   * Create a new note via the quick capture flow.
   */
  async capture(
    token: string,
    workspaceId: string,
    payload: QuickCapturePayload,
  ): Promise<NoteDto> {
    return apiClient.post<NoteDto>(`/api/workspaces/${workspaceId}/notes/quick-capture`, payload, {
      token,
    });
  },

  /**
   * GET /api/workspaces/:workspaceId/tags
   * List all tags in the workspace for autocomplete.
   */
  async listTags(token: string, workspaceId: string): Promise<TagDto[]> {
    return apiClient.get<TagDto[]>(`/api/workspaces/${workspaceId}/tags`, { token });
  },

  /**
   * GET /api/workspaces/:workspaceId/folders
   * List the folder tree for the destination picker.
   */
  async listFolders(token: string, workspaceId: string): Promise<FolderTreeNode[]> {
    return apiClient.get<FolderTreeNode[]>(`/api/workspaces/${workspaceId}/folders`, { token });
  },

  /**
   * Attempt to extract a title from a pasted URL by fetching metadata.
   * Falls back gracefully if the endpoint is not available.
   *
   * POST /api/workspaces/:workspaceId/link-preview
   */
  async extractUrlTitle(
    token: string,
    workspaceId: string,
    url: string,
  ): Promise<{ title: string; description?: string } | null> {
    try {
      return await apiClient.post<{ title: string; description?: string }>(
        `/api/workspaces/${workspaceId}/link-preview`,
        { url },
        { token },
      );
    } catch {
      // Link preview is optional -- never block the capture flow
      return null;
    }
  },
};
