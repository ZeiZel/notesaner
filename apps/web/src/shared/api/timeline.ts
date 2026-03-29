/**
 * timeline.ts
 *
 * API client for the notes timeline endpoint.
 *
 * The timeline returns notes grouped by date bucket with pagination.
 * Each page cursor is an ISO timestamp — the server returns notes
 * created/updated before that timestamp.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineNoteDto {
  id: string;
  title: string;
  /** Preview snippet — first ~120 chars of content, stripped of markdown. */
  preview: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  tags: string[];
}

export interface TimelinePageResponse {
  data: TimelineNoteDto[];
  pagination: {
    /** Cursor to pass as `before` for the next page. Null when no more pages. */
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export interface GetTimelineParams {
  /** Cursor from the previous page (ISO timestamp). */
  before?: string;
  /** Page size (default 20). */
  limit?: number;
  /** Filter: only notes from this author ID. */
  authorId?: string;
  /** Filter: only notes tagged with all of these tag IDs. */
  tagIds?: string[];
  /** Filter: only notes created/modified on or after this ISO timestamp. */
  dateFrom?: string;
  /** Filter: only notes created/modified on or before this ISO timestamp. */
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const timelineApi = {
  /**
   * GET /api/workspaces/:workspaceId/notes/timeline
   *
   * Returns a paginated timeline of notes sorted by updatedAt descending.
   */
  getTimeline: (
    workspaceId: string,
    params: GetTimelineParams = {},
  ): Promise<TimelinePageResponse> => {
    const search = new URLSearchParams();
    if (params.before) search.set('before', params.before);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.authorId) search.set('authorId', params.authorId);
    if (params.tagIds && params.tagIds.length > 0) {
      search.set('tagIds', params.tagIds.join(','));
    }
    if (params.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params.dateTo) search.set('dateTo', params.dateTo);

    const qs = search.toString();
    const url = `/api/workspaces/${workspaceId}/notes/timeline${qs ? `?${qs}` : ''}`;
    return apiClient.get<TimelinePageResponse>(url);
  },
};
