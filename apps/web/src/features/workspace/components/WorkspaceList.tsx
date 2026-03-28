'use client';

/**
 * WorkspaceList — list/grid view of all workspaces the user belongs to.
 *
 * Features:
 *   - Card-based grid layout (responsive: 1-3 columns)
 *   - Shows workspace name, description, role badge, member/note counts
 *   - Click to switch workspace
 *   - Active workspace highlighted
 *   - Empty state when no workspaces exist
 *
 * Usage:
 *   <WorkspaceList />
 */

import { useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { WorkspaceSummaryDto } from '@/shared/api/workspaces';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 100-6 3 3 0 000 6z" />
      <path
        fillRule="evenodd"
        d="M5.216 14A2.238 2.238 0 015 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 005 9c-4 0-5 3-5 4s1 1 1 1h4.216z"
      />
      <path d="M4.5 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    </svg>
  );
}

function NotesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5 0h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V2a2 2 0 012-2zm0 1a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1H5z" />
      <path d="M5 4h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 005.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 01.64-1.539 6.7 6.7 0 01.597-.933A7.025 7.025 0 002.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 00-.656 2.5h2.49zM4.847 5a12.5 12.5 0 00-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 00-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 00.337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 01-.597-.933A9.268 9.268 0 014.09 12H2.255a7.024 7.024 0 003.072 2.472zM3.82 11a13.652 13.652 0 01-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0013.745 12H11.91a9.27 9.27 0 01-.64 1.539 6.688 6.688 0 01-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 01-.312 2.5zm2.802-3.5a6.959 6.959 0 00-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 00-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 00-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Role badge colors
// ---------------------------------------------------------------------------

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'ADMIN':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'EDITOR':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'VIEWER':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceList() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaceSummaries = useWorkspaceStore((s) => s.workspaceSummaries);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const isSwitching = useWorkspaceStore((s) => s.isSwitching);
  const error = useWorkspaceStore((s) => s.error);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  // Fetch workspaces on mount
  useEffect(() => {
    if (accessToken) {
      void fetchWorkspaces(accessToken);
    }
  }, [accessToken, fetchWorkspaces]);

  const handleSwitch = useCallback(
    async (workspaceId: string) => {
      if (!accessToken || workspaceId === activeWorkspaceId || isSwitching) return;
      try {
        await switchWorkspace(accessToken, workspaceId);
      } catch {
        // Error is set in store
      }
    },
    [accessToken, activeWorkspaceId, isSwitching, switchWorkspace],
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-background p-5">
            <div className="h-5 w-2/3 rounded bg-foreground-muted/20" />
            <div className="mt-3 h-3 w-full rounded bg-foreground-muted/10" />
            <div className="mt-2 h-3 w-1/2 rounded bg-foreground-muted/10" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (workspaceSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <NotesIcon className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No workspaces yet</h3>
        <p className="mt-1 text-sm text-foreground-muted max-w-sm">
          Create your first workspace to start organizing your notes.
        </p>
        <button
          type="button"
          className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Create workspace
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Workspaces">
      {workspaceSummaries.map((workspace) => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          isActive={workspace.id === activeWorkspaceId}
          isSwitching={isSwitching}
          onSwitch={() => void handleSwitch(workspace.id)}
        />
      ))}
    </div>
  );
}

WorkspaceList.displayName = 'WorkspaceList';

// ---------------------------------------------------------------------------
// WorkspaceCard
// ---------------------------------------------------------------------------

function WorkspaceCard({
  workspace,
  isActive,
  isSwitching,
  onSwitch,
}: {
  workspace: WorkspaceSummaryDto;
  isActive: boolean;
  isSwitching: boolean;
  onSwitch: () => void;
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onSwitch}
      disabled={isSwitching && !isActive}
      aria-current={isActive ? 'true' : undefined}
      className={`group flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
        isActive
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-background hover:border-primary/30 hover:shadow-md'
      } disabled:opacity-60`}
    >
      {/* Header: icon + name + role badge */}
      <div className="flex w-full items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold select-none ${
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/15 text-primary group-hover:bg-primary/20'
          }`}
        >
          {workspace.name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{workspace.name}</h3>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getRoleBadgeClass(workspace.role)}`}
            >
              {workspace.role.toLowerCase()}
            </span>
          </div>
          {workspace.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">
              {workspace.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 flex w-full items-center gap-4 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <UsersIcon className="h-3.5 w-3.5" />
          <span>
            {workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <NotesIcon className="h-3.5 w-3.5" />
          <span>
            {workspace.noteCount} note{workspace.noteCount !== 1 ? 's' : ''}
          </span>
        </div>
        {workspace.isPublic && (
          <div
            className="flex items-center gap-1.5 text-xs text-foreground-muted"
            title="Public workspace"
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            <span>Public</span>
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="mt-3 w-full">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Current workspace
          </span>
        </div>
      )}
    </button>
  );
}
