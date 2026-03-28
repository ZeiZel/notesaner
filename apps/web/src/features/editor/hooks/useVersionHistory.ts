/**
 * useVersionHistory — TanStack Query hook for fetching note version history.
 *
 * Provides:
 * - versions: paginated list of NoteVersionDto
 * - isLoading / isError / error states
 * - refetch: manual re-fetch trigger
 * - restoreVersion: mutation to restore a specific version
 *
 * Query key: ['notes', noteId, 'versions']
 *
 * The hook does NOT use useEffect for data fetching — TanStack Query handles
 * the lifecycle. State derivation (selected version, diff computation) is left
 * to the consuming component.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NoteVersionDto } from '@notesaner/contracts';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const versionKeys = {
  all: ['versions'] as const,
  lists: () => [...versionKeys.all, 'list'] as const,
  list: (noteId: string) => [...versionKeys.lists(), noteId] as const,
  detail: (noteId: string, versionId: string) => [...versionKeys.list(noteId), versionId] as const,
};

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

interface VersionListResponse {
  versions: NoteVersionDto[];
  total: number;
}

async function fetchVersions(
  token: string,
  workspaceId: string,
  noteId: string,
): Promise<VersionListResponse> {
  return apiClient.get<VersionListResponse>(
    `/api/workspaces/${workspaceId}/notes/${noteId}/versions`,
    { token },
  );
}

async function fetchVersionContent(
  token: string,
  workspaceId: string,
  noteId: string,
  versionId: string,
): Promise<NoteVersionDto> {
  return apiClient.get<NoteVersionDto>(
    `/api/workspaces/${workspaceId}/notes/${noteId}/versions/${versionId}`,
    { token },
  );
}

async function restoreVersionApi(
  token: string,
  workspaceId: string,
  noteId: string,
  versionId: string,
): Promise<void> {
  await apiClient.post(
    `/api/workspaces/${workspaceId}/notes/${noteId}/versions/${versionId}/restore`,
    { token },
  );
}

// ---------------------------------------------------------------------------
// Hook: useVersionHistory
// ---------------------------------------------------------------------------

export function useVersionHistory(noteId: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const enabled = Boolean(noteId && token && workspaceId);

  const versionsQuery = useQuery({
    queryKey: versionKeys.list(noteId ?? ''),
    queryFn: () => fetchVersions(token ?? '', workspaceId ?? '', noteId ?? ''),
    enabled,
    staleTime: 60 * 1000,
  });

  return {
    versions: versionsQuery.data?.versions ?? [],
    total: versionsQuery.data?.total ?? 0,
    isLoading: versionsQuery.isLoading,
    isError: versionsQuery.isError,
    error: versionsQuery.error,
    refetch: versionsQuery.refetch,
  };
}

// ---------------------------------------------------------------------------
// Hook: useVersionContent
// ---------------------------------------------------------------------------

export function useVersionContent(noteId: string | null, versionId: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const enabled = Boolean(noteId && versionId && token && workspaceId);

  return useQuery({
    queryKey: versionKeys.detail(noteId ?? '', versionId ?? ''),
    queryFn: () =>
      fetchVersionContent(token ?? '', workspaceId ?? '', noteId ?? '', versionId ?? ''),
    enabled,
    staleTime: 5 * 60 * 1000, // Versions are immutable — cache longer
  });
}

// ---------------------------------------------------------------------------
// Hook: useRestoreVersion
// ---------------------------------------------------------------------------

export function useRestoreVersion(noteId: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      restoreVersionApi(token ?? '', workspaceId ?? '', noteId ?? '', versionId),
    onSuccess: () => {
      // Invalidate both the version list and any note content queries
      if (noteId) {
        void queryClient.invalidateQueries({ queryKey: versionKeys.list(noteId) });
        void queryClient.invalidateQueries({ queryKey: ['notes', noteId] });
      }
    },
  });
}
