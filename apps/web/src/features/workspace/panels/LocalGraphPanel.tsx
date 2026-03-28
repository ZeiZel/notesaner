'use client';

/**
 * LocalGraphPanel — right sidebar panel displaying the local graph for the
 * currently open note.
 *
 * Data flow:
 * 1. Reads activeNote + activeWorkspaceId from NoteStateStore (set by NotePageClient).
 * 2. Fetches full workspace graph data via TanStack Query (shared/cached).
 * 3. Passes noteId + graphData to LocalGraphView which BFS-filters the neighborhood.
 * 4. Node click navigates to the clicked note via Next.js router.
 *
 * The graph data query uses a 2-minute stale time to avoid hammering the API
 * while still refreshing when collaborators add/remove links.
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { LocalGraphView, fetchGraphData } from '@notesaner/plugin-graph';
import type { D3GraphData } from '@notesaner/plugin-graph';
import { useNoteStateStore } from '@/shared/stores/note-state-store';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LocalGraphSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-sidebar-muted border-t-primary" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function LocalGraphError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-4">
      <p className="text-xs text-destructive">Failed to load graph</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-sidebar-accent px-2 py-1 text-2xs font-medium text-sidebar-foreground hover:bg-sidebar-border transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / no-note state
// ---------------------------------------------------------------------------

function NoNoteState() {
  return (
    <div className="flex h-full items-center justify-center py-8">
      <p className="text-xs text-sidebar-muted">Open a note to see its graph</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

export function LocalGraphPanel() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeNote = useNoteStateStore((s) => s.activeNote);
  const activeWorkspaceId = useNoteStateStore((s) => s.activeWorkspaceId);

  const noteId = activeNote?.id ?? null;
  const workspaceId = activeWorkspaceId;

  const enabled = !!accessToken && !!workspaceId;

  const {
    data: graphData,
    isLoading,
    isError,
    refetch,
  } = useQuery<D3GraphData>({
    queryKey: ['graph', workspaceId],
    queryFn: () => fetchGraphData(accessToken ?? '', workspaceId ?? ''),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — links change infrequently
    refetchInterval: 5 * 60 * 1000, // background refresh every 5 minutes
    refetchIntervalInBackground: false,
  });

  const handleNodeClick = useCallback(
    (clickedNoteId: string) => {
      if (!workspaceId) return;
      router.push(`/workspaces/${workspaceId}/notes/${clickedNoteId}`);
    },
    [router, workspaceId],
  );

  // No active note — panel is inactive
  if (!noteId || !workspaceId) {
    return <NoNoteState />;
  }

  if (isLoading) {
    return <LocalGraphSkeleton />;
  }

  if (isError || !graphData) {
    return <LocalGraphError onRetry={() => void refetch()} />;
  }

  return (
    <LocalGraphView
      noteId={noteId}
      graphData={graphData}
      onNodeClick={handleNodeClick}
      className="h-full w-full"
    />
  );
}
