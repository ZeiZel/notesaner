/**
 * sharing.ts
 *
 * API client for note sharing endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SharePermission = 'VIEW' | 'COMMENT' | 'EDIT';

export interface NoteShareDto {
  id: string;
  noteId: string;
  sharedBy: string;
  sharedWith: string | null;
  sharedWithEmail: string | null;
  sharedWithName: string | null;
  permission: SharePermission;
  token: string;
  hasPassword: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

export interface CreateShareByEmailPayload {
  type: 'email';
  email: string;
  permission: SharePermission;
  expiresAt?: string | null;
}

export interface CreateShareByLinkPayload {
  type: 'link';
  permission: SharePermission;
  password?: string | null;
  expiresAt?: string | null;
}

export type CreateSharePayload = CreateShareByEmailPayload | CreateShareByLinkPayload;

export interface PublicShareInfoDto {
  noteId: string;
  noteTitle: string;
  permission: SharePermission;
  requiresPassword: boolean;
  isExpired: boolean;
  sharedByName: string;
}

export interface ShareAccessResult {
  noteId: string;
  permission: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const sharingApi = {
  /**
   * POST /api/workspaces/:workspaceId/notes/:noteId/shares
   * Create a new share (email or link).
   */
  createShare: (token: string, workspaceId: string, noteId: string, payload: CreateSharePayload) =>
    apiClient.post<NoteShareDto>(`/api/workspaces/${workspaceId}/notes/${noteId}/shares`, payload, {
      token,
    }),

  /**
   * GET /api/workspaces/:workspaceId/notes/:noteId/shares
   * List all shares for a note.
   */
  listShares: (token: string, workspaceId: string, noteId: string) =>
    apiClient.get<NoteShareDto[]>(`/api/workspaces/${workspaceId}/notes/${noteId}/shares`, {
      token,
    }),

  /**
   * DELETE /api/workspaces/:workspaceId/notes/:noteId/shares/:shareId
   * Revoke a share.
   */
  deleteShare: (token: string, workspaceId: string, noteId: string, shareId: string) =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}/notes/${noteId}/shares/${shareId}`, {
      token,
    }),

  /**
   * GET /api/share/:token
   * Get public share info (no auth required).
   */
  getShareInfo: (shareToken: string) =>
    apiClient.get<PublicShareInfoDto>(`/api/share/${shareToken}`),

  /**
   * POST /api/share/:token/verify
   * Verify share link password (no auth required).
   */
  verifySharePassword: (shareToken: string, password: string) =>
    apiClient.post<ShareAccessResult>(`/api/share/${shareToken}/verify`, {
      password,
    }),

  /**
   * POST /api/share/:token/access
   * Access a non-password-protected share (no auth required).
   */
  accessShare: (shareToken: string) =>
    apiClient.post<ShareAccessResult>(`/api/share/${shareToken}/access`),
};
