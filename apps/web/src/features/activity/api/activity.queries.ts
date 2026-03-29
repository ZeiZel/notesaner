/**
 * activity.queries.ts
 *
 * TanStack Query hooks for activity feed and note follow operations.
 *
 * Uses query-key factory pattern consistent with the rest of the codebase.
 * Mutations invalidate relevant queries on success.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import {
  activityApi,
  type ActivityListResponse,
  type ActivityLogDto,
  type GetActivityParams,
  type FollowStatusResponse,
  type NoteFollowDto,
  type ActivityType,
} from '@/shared/api/activity';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const activityKeys = {
  all: ['activity'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (workspaceId: string, filters?: GetActivityParams) =>
    [...activityKeys.lists(), workspaceId, filters ?? {}] as const,
  noteActivity: (noteId: string) => [...activityKeys.all, 'note', noteId] as const,
  follows: () => [...activityKeys.all, 'follow'] as const,
  followStatus: (noteId: string) => [...activityKeys.follows(), noteId] as const,
};

// ---------------------------------------------------------------------------
// Workspace activity feed (infinite scroll)
// ---------------------------------------------------------------------------

/**
 * Fetches workspace activity feed with infinite scroll pagination.
 * Each page returns 20 items.
 */
export function useWorkspaceActivity(filters?: {
  type?: ActivityType;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useInfiniteQuery<ActivityListResponse, Error>({
    queryKey: activityKeys.list(workspaceId ?? '', filters),
    queryFn: ({ pageParam }) => {
      if (!workspaceId) {
        return Promise.reject(new Error('Missing workspace context'));
      }
      return activityApi.getWorkspaceActivity(workspaceId, {
        page: pageParam as number,
        limit: 20,
        ...filters,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Per-note activity
// ---------------------------------------------------------------------------

/**
 * Fetches activity history for a specific note.
 */
export function useNoteActivity(noteId: string | null) {
  return useQuery<ActivityListResponse>({
    queryKey: activityKeys.noteActivity(noteId ?? ''),
    queryFn: () => {
      if (!noteId) {
        return Promise.reject(new Error('Missing note ID'));
      }
      return activityApi.getNoteActivity(noteId, { limit: 50 });
    },
    enabled: Boolean(noteId),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Follow / unfollow
// ---------------------------------------------------------------------------

/**
 * Check if the current user is following a note.
 */
export function useFollowStatus(noteId: string | null) {
  return useQuery<FollowStatusResponse>({
    queryKey: activityKeys.followStatus(noteId ?? ''),
    queryFn: () => {
      if (!noteId) {
        return Promise.reject(new Error('Missing note ID'));
      }
      return activityApi.getFollowStatus(noteId);
    },
    enabled: Boolean(noteId),
    staleTime: 60_000,
  });
}

/**
 * Follow a note. Invalidates the follow status query on success.
 */
export function useFollowNote() {
  const queryClient = useQueryClient();

  return useMutation<NoteFollowDto, Error, string>({
    mutationFn: (noteId) => activityApi.followNote(noteId),
    onSuccess: (_data, noteId) => {
      // Optimistically set follow status
      queryClient.setQueryData<FollowStatusResponse>(activityKeys.followStatus(noteId), {
        following: true,
      });
    },
  });
}

/**
 * Unfollow a note. Invalidates the follow status query on success.
 */
export function useUnfollowNote() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (noteId) => activityApi.unfollowNote(noteId),
    onSuccess: (_data, noteId) => {
      queryClient.setQueryData<FollowStatusResponse>(activityKeys.followStatus(noteId), {
        following: false,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Selectors for flat activity list from infinite query
// ---------------------------------------------------------------------------

/**
 * Flatten all pages of the infinite activity query into a single array.
 */
export function selectFlatActivities(
  data: InfiniteData<ActivityListResponse> | undefined,
): ActivityLogDto[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.data);
}

/**
 * Get total activity count from the infinite query data.
 */
export function selectActivityTotal(data: InfiniteData<ActivityListResponse> | undefined): number {
  if (!data || data.pages.length === 0) return 0;
  return data.pages[0].pagination.total;
}
