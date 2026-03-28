/**
 * comments.ts
 *
 * API client for inline comment CRUD endpoints.
 *
 * Backend endpoints:
 *   POST   /workspaces/:wid/notes/:nid/comments       - create root comment
 *   GET    /workspaces/:wid/notes/:nid/comments        - list note comments
 *   PATCH  /comments/:id                                - edit comment
 *   DELETE /comments/:id                                - delete comment
 *   POST   /comments/:id/replies                        - reply to comment
 *   PATCH  /comments/:id/resolve                        - toggle resolve
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Position anchor stored as JSON in the Comment model. */
export interface CommentPositionDto {
  from: number;
  to: number;
}

/** User info embedded in comment responses. */
export interface CommentUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/** A single comment as returned by the server. */
export interface CommentDto {
  id: string;
  noteId: string;
  userId: string;
  content: string;
  position: CommentPositionDto | null;
  isResolved: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: CommentUserDto;
  replies: CommentDto[];
  mentionedUsers: string[];
}

/** Payload to create a root comment. */
export interface CreateCommentPayload {
  content: string;
  position?: CommentPositionDto | null;
}

/** Payload to create a reply. */
export interface CreateReplyPayload {
  content: string;
}

/** Payload to update a comment. */
export interface UpdateCommentPayload {
  content: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const commentsApi = {
  /**
   * GET /api/workspaces/:workspaceId/notes/:noteId/comments
   *
   * Returns root-level comments with nested replies, sorted by position.
   */
  list: (token: string, workspaceId: string, noteId: string) =>
    apiClient.get<CommentDto[]>(`/api/workspaces/${workspaceId}/notes/${noteId}/comments`, {
      token,
    }),

  /**
   * POST /api/workspaces/:workspaceId/notes/:noteId/comments
   *
   * Create a root-level comment anchored to a text position.
   */
  create: (token: string, workspaceId: string, noteId: string, payload: CreateCommentPayload) =>
    apiClient.post<CommentDto>(`/api/workspaces/${workspaceId}/notes/${noteId}/comments`, payload, {
      token,
    }),

  /**
   * POST /api/comments/:commentId/replies
   *
   * Reply to an existing root comment.
   */
  reply: (token: string, commentId: string, payload: CreateReplyPayload) =>
    apiClient.post<CommentDto>(`/api/comments/${commentId}/replies`, payload, { token }),

  /**
   * PATCH /api/comments/:commentId
   *
   * Edit comment content. Only the original author may edit.
   */
  update: (token: string, commentId: string, payload: UpdateCommentPayload) =>
    apiClient.patch<CommentDto>(`/api/comments/${commentId}`, payload, { token }),

  /**
   * DELETE /api/comments/:commentId
   *
   * Delete a comment. Only the author or admin may delete.
   */
  delete: (token: string, commentId: string) =>
    apiClient.delete<void>(`/api/comments/${commentId}`, { token }),

  /**
   * PATCH /api/comments/:commentId/resolve
   *
   * Toggle the resolved state of a root comment thread.
   */
  resolve: (token: string, commentId: string) =>
    apiClient.patch<CommentDto>(`/api/comments/${commentId}/resolve`, undefined, {
      token,
    }),
};
