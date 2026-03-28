import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType =
  | 'NOTE_CREATED'
  | 'NOTE_EDITED'
  | 'NOTE_DELETED'
  | 'NOTE_RENAMED'
  | 'NOTE_MOVED'
  | 'NOTE_COMMENTED'
  | 'NOTE_SHARED';

export interface ActivityUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ActivityLogDto {
  id: string;
  workspaceId: string;
  userId: string;
  user: ActivityUserDto;
  noteId: string | null;
  type: ActivityType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityListResponse {
  data: ActivityLogDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface NoteFollowDto {
  noteId: string;
  userId: string;
  createdAt: string;
}

export interface FollowStatusResponse {
  following: boolean;
}

export interface GetActivityParams {
  page?: number;
  limit?: number;
  type?: ActivityType;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const activityApi = {
  /**
   * GET /workspaces/:workspaceId/activity
   *
   * Returns a paginated activity feed for a workspace.
   */
  getWorkspaceActivity: (
    workspaceId: string,
    params: GetActivityParams = {},
  ): Promise<ActivityListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.type) searchParams.set('type', params.type);
    if (params.userId) searchParams.set('userId', params.userId);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);

    const qs = searchParams.toString();
    const url = `/workspaces/${workspaceId}/activity${qs ? `?${qs}` : ''}`;

    return apiClient.get<ActivityListResponse>(url);
  },

  /**
   * GET /notes/:noteId/activity
   *
   * Returns activity history for a specific note.
   */
  getNoteActivity: (
    noteId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<ActivityListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const url = `/notes/${noteId}/activity${qs ? `?${qs}` : ''}`;

    return apiClient.get<ActivityListResponse>(url);
  },

  /**
   * POST /notes/:noteId/follow
   *
   * Follow a note to receive activity notifications.
   */
  followNote: (noteId: string): Promise<NoteFollowDto> =>
    apiClient.post<NoteFollowDto>(`/notes/${noteId}/follow`),

  /**
   * DELETE /notes/:noteId/follow
   *
   * Unfollow a note.
   */
  unfollowNote: (noteId: string): Promise<void> =>
    apiClient.delete<void>(`/notes/${noteId}/follow`),

  /**
   * GET /notes/:noteId/follow
   *
   * Check if the current user follows a note.
   */
  getFollowStatus: (noteId: string): Promise<FollowStatusResponse> =>
    apiClient.get<FollowStatusResponse>(`/notes/${noteId}/follow`),
};
