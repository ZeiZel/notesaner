'use client';

/**
 * use-timeline-query.ts
 *
 * TanStack Query hook for fetching paginated timeline data.
 *
 * Uses useInfiniteQuery so the consumer can call fetchNextPage() to load
 * more entries (infinite scroll). Each page fetches PAGE_SIZE notes sorted
 * by updatedAt descending.
 *
 * Pattern: query-key factory + useInfiniteQuery, consistent with
 * comments.queries.ts and the rest of the codebase.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { timelineApi, type GetTimelineParams } from '@/shared/api/timeline';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const timelineKeys = {
  all: ['timeline'] as const,
  lists: () => [...timelineKeys.all, 'list'] as const,
  list: (workspaceId: string, filters: TimelineFilters) =>
    [...timelineKeys.lists(), workspaceId, filters] as const,
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface TimelineFilters {
  authorId?: string | null;
  tagIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Paginated timeline query.
 *
 * Returns TanStack Query's infinite query result. The consumer calls
 * `fetchNextPage()` when the scroll sentinel enters the viewport.
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *   useTimelineQuery({ authorId: null, tagIds: [], dateFrom: null, dateTo: null });
 *
 * const notes = data?.pages.flatMap((p) => p.data) ?? [];
 * ```
 */
export function useTimelineQuery(filters: TimelineFilters = {}) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const params: GetTimelineParams = {
    limit: PAGE_SIZE,
    ...(filters.authorId ? { authorId: filters.authorId } : {}),
    ...(filters.tagIds && filters.tagIds.length > 0 ? { tagIds: filters.tagIds } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
  };

  return useInfiniteQuery({
    queryKey: timelineKeys.list(workspaceId ?? '', filters),
    queryFn: ({ pageParam }) => {
      if (!workspaceId) {
        return Promise.reject(new Error('No active workspace'));
      }
      const pageParams: GetTimelineParams = {
        ...params,
        ...(pageParam ? { before: pageParam as string } : {}),
      };
      return timelineApi.getTimeline(workspaceId, pageParams);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: Boolean(token && workspaceId),
    staleTime: 30_000,
  });
}
