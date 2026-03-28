import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FreshnessStatus = 'fresh' | 'aging' | 'stale';
export type FreshnessStatusFilter = 'fresh' | 'aging' | 'stale' | 'all';

export interface FreshnessResult {
  noteId: string;
  status: FreshnessStatus;
  /** Days elapsed since the freshness anchor date. */
  ageInDays: number;
  /** ISO 8601 date used as the freshness anchor. */
  anchorDate: string;
  /** True if a manual review set the anchor. */
  isVerified: boolean;
  agingThresholdDays: number;
  staleThresholdDays: number;
}

export interface ReviewQueueItem {
  noteId: string;
  workspaceId: string;
  title: string;
  path: string;
  status: FreshnessStatus;
  ageInDays: number;
  anchorDate: string;
  isVerified: boolean;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueResponse {
  data: ReviewQueueItem[];
  pagination: {
    total: number;
    limit: number;
    cursor: string | undefined;
    hasMore: boolean;
  };
  thresholds: {
    agingThresholdDays: number;
    staleThresholdDays: number;
  };
}

export interface FreshnessConfig {
  agingThresholdDays: number;
  staleThresholdDays: number;
}

export interface UpdateFreshnessConfigDto {
  freshnessThreshold?: number;
  warningThreshold?: number;
}

export interface MarkReviewedResult {
  noteId: string;
  lastVerifiedAt: string;
  reviewedById: string;
  status: FreshnessStatus;
}

export interface ReviewQueueParams {
  cursor?: string;
  limit?: number;
  status?: FreshnessStatusFilter;
  ownerId?: string;
  folder?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const freshnessApi = {
  /**
   * GET /workspaces/:workspaceId/freshness/queue
   *
   * Returns the paginated needs-review queue for admin users.
   * Sorted by ageInDays descending.
   */
  getQueue: (
    token: string,
    workspaceId: string,
    params: ReviewQueueParams = {},
  ): Promise<ReviewQueueResponse> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.ownerId) searchParams.set('ownerId', params.ownerId);
    if (params.folder) searchParams.set('folder', params.folder);

    const qs = searchParams.toString();
    const url = `/api/workspaces/${workspaceId}/freshness/queue${qs ? `?${qs}` : ''}`;

    return apiClient.get<ReviewQueueResponse>(url, { token });
  },

  /**
   * GET /workspaces/:workspaceId/freshness/config
   *
   * Returns the current freshness threshold config for the workspace.
   */
  getConfig: (token: string, workspaceId: string): Promise<FreshnessConfig> =>
    apiClient.get<FreshnessConfig>(`/api/workspaces/${workspaceId}/freshness/config`, { token }),

  /**
   * PUT /workspaces/:workspaceId/freshness/config
   *
   * Updates the freshness thresholds for the workspace.
   */
  updateConfig: (
    token: string,
    workspaceId: string,
    dto: UpdateFreshnessConfigDto,
  ): Promise<FreshnessConfig> =>
    apiClient.put<FreshnessConfig>(`/api/workspaces/${workspaceId}/freshness/config`, dto, {
      token,
    }),

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/freshness
   *
   * Returns the freshness status for a single note.
   */
  getNoteFreshness: (
    token: string,
    workspaceId: string,
    noteId: string,
  ): Promise<FreshnessResult> =>
    apiClient.get<FreshnessResult>(`/api/workspaces/${workspaceId}/notes/${noteId}/freshness`, {
      token,
    }),

  /**
   * POST /workspaces/:workspaceId/notes/:noteId/review
   *
   * Marks a note as reviewed, resetting its freshness clock.
   */
  markAsReviewed: (
    token: string,
    workspaceId: string,
    noteId: string,
  ): Promise<MarkReviewedResult> =>
    apiClient.post<MarkReviewedResult>(
      `/api/workspaces/${workspaceId}/notes/${noteId}/review`,
      {},
      { token },
    ),
};
