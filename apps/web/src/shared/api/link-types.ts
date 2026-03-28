/**
 * API client for Zettelkasten typed link relationships.
 *
 * Endpoints:
 *   GET    /api/workspaces/:wid/link-types
 *   POST   /api/workspaces/:wid/link-types
 *   DELETE /api/workspaces/:wid/link-types/:typeId
 *   PATCH  /api/workspaces/:wid/note-links/:noteLinkId/type
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkRelationshipTypeDto {
  id: string;
  workspaceId: string | null;
  slug: string;
  label: string;
  color: string;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLinkTypeDto {
  slug: string;
  label: string;
  color?: string;
  description?: string;
}

export interface SetLinkTypeDto {
  /** Pass null to clear the relationship type. */
  relationshipTypeId: string | null;
}

export interface SetLinkTypeResult {
  id: string;
  relationshipTypeId: string | null;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const linkTypeKeys = {
  all: ['link-types'] as const,
  workspace: (workspaceId: string) => [...linkTypeKeys.all, workspaceId] as const,
};

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const linkTypesApi = {
  /**
   * List all relationship types for a workspace.
   * Includes built-in types (visible to all workspaces) and custom types
   * scoped to this workspace. Built-in types appear first.
   */
  list: (token: string, workspaceId: string): Promise<LinkRelationshipTypeDto[]> =>
    apiClient.get<LinkRelationshipTypeDto[]>(`/api/workspaces/${workspaceId}/link-types`, {
      token,
    }),

  /**
   * Create a new custom relationship type for the workspace.
   * Fails with 409 if the slug is already in use.
   */
  create: (
    token: string,
    workspaceId: string,
    dto: CreateLinkTypeDto,
  ): Promise<LinkRelationshipTypeDto> =>
    apiClient.post<LinkRelationshipTypeDto>(`/api/workspaces/${workspaceId}/link-types`, dto, {
      token,
    }),

  /**
   * Delete a custom workspace relationship type.
   * Fails with 403 if the type is built-in.
   * All NoteLink rows using this type are cleared automatically.
   */
  delete: (token: string, workspaceId: string, typeId: string): Promise<void> =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}/link-types/${typeId}`, { token }),

  /**
   * Set or clear the relationship type on a specific NoteLink.
   * Pass { relationshipTypeId: null } to remove the annotation.
   */
  setLinkType: (
    token: string,
    workspaceId: string,
    noteLinkId: string,
    dto: SetLinkTypeDto,
  ): Promise<SetLinkTypeResult> =>
    apiClient.patch<SetLinkTypeResult>(
      `/api/workspaces/${workspaceId}/note-links/${noteLinkId}/type`,
      dto,
      { token },
    ),
};
