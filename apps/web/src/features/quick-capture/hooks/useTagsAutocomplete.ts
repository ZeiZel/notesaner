'use client';

/**
 * useTagsAutocomplete -- TanStack Query hook for fetching workspace tags.
 *
 * Used by the quick capture modal tag selector for autocomplete suggestions.
 * Data is cached and stale-while-revalidate to ensure instant UI.
 */

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { quickCaptureApi } from '@/shared/api/quick-capture';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const tagKeys = {
  all: ['tags'] as const,
  list: (workspaceId: string) => [...tagKeys.all, 'list', workspaceId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTagsAutocomplete() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: tagKeys.list(workspaceId ?? ''),
    queryFn: () => {
      if (!workspaceId || !accessToken) {
        return [];
      }
      return quickCaptureApi.listTags(accessToken, workspaceId);
    },
    enabled: Boolean(workspaceId && accessToken),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
