import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicReaderCommentDto {
  id: string;
  content: string;
  authorName: string | null;
  parentId: string | null;
  createdAt: string;
  replies: PublicReaderCommentDto[];
}

export interface CommentListResponse {
  comments: PublicReaderCommentDto[];
  total: number;
}

export interface CommentCountResponse {
  count: number;
}

export interface ReaderCommentAdminDto {
  id: string;
  noteId: string;
  content: string;
  authorName: string | null;
  authorEmail: string | null;
  parentId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ModerationQueueResponse {
  pending: ReaderCommentAdminDto[];
  total: number;
}

export interface CreateReaderCommentRequest {
  content: string;
  authorName?: string;
  authorEmail?: string;
  parentId?: string;
  honeypot?: string;
}

export type CommentModerationAction = 'approve' | 'reject';

// ─── API ──────────────────────────────────────────────────────────────────────

export const readerCommentsApi = {
  /**
   * POST /public/:slug/notes/*path/comments
   *
   * Submit a new comment on a published note. No auth required.
   * Returns the created comment (status=pending until moderated).
   */
  create: (publicSlug: string, notePath: string, dto: CreateReaderCommentRequest) =>
    apiClient.post<ReaderCommentAdminDto>(
      `/api/public/${publicSlug}/notes/${notePath}/comments`,
      dto,
    ),

  /**
   * GET /public/:slug/notes/*path/comments
   *
   * Returns approved comments threaded by parentId.
   */
  list: (publicSlug: string, notePath: string, page = 1, pageSize = 20) =>
    apiClient.get<CommentListResponse>(
      `/api/public/${publicSlug}/notes/${notePath}/comments?page=${page}&pageSize=${pageSize}`,
    ),

  /**
   * GET /public/:slug/notes/*path/comments/count
   *
   * Returns the approved comment count for display on public pages.
   */
  getCount: (publicSlug: string, notePath: string) =>
    apiClient.get<CommentCountResponse>(
      `/api/public/${publicSlug}/notes/${notePath}/comments/count`,
    ),

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/reader-comments
   *
   * Returns the moderation queue (pending comments) for a note.
   * Requires auth token and ADMIN or OWNER role.
   */
  getModerationQueue: (token: string, workspaceId: string, noteId: string) =>
    apiClient.get<ModerationQueueResponse>(
      `/api/workspaces/${workspaceId}/notes/${noteId}/reader-comments`,
      { token },
    ),

  /**
   * PUT /reader-comments/:commentId/moderate
   *
   * Approve or reject a comment.
   * Requires auth token and ADMIN or OWNER role.
   */
  moderate: (token: string, commentId: string, action: CommentModerationAction) =>
    apiClient.put<ReaderCommentAdminDto>(
      `/api/reader-comments/${commentId}/moderate`,
      { action },
      { token },
    ),

  /**
   * DELETE /reader-comments/:commentId
   *
   * Permanently delete a comment (GDPR).
   * Requires auth token and ADMIN or OWNER role.
   */
  delete: (token: string, commentId: string) =>
    apiClient.delete<void>(`/api/reader-comments/${commentId}`, { token }),
};
