'use client';

/**
 * WorkspaceSwitcher — dropdown for switching between workspaces.
 *
 * Displays the current workspace name and a dropdown list of all
 * workspaces the user belongs to. Clicking a workspace triggers
 * the switch flow which validates membership and updates global state.
 *
 * Designed for the sidebar header or top navigation bar.
 *
 * Usage:
 *   <WorkspaceSwitcher />
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronIcon({ className, up }: { className?: string; up?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`${className ?? ''} transition-transform ${up ? 'rotate-180' : ''}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
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

export function WorkspaceSwitcher() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaceSummaries = useWorkspaceStore((s) => s.workspaceSummaries);
  const isSwitching = useWorkspaceStore((s) => s.isSwitching);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentWorkspace = workspaceSummaries.find((w) => w.id === activeWorkspaceId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Effect: data loading on mount via Zustand store action.
  // TODO: migrate to TanStack Query for workspace list fetching.
  useEffect(() => {
    if (accessToken && workspaceSummaries.length === 0) {
      void fetchWorkspaces(accessToken);
    }
  }, [accessToken, workspaceSummaries.length, fetchWorkspaces]);

  const handleSwitch = useCallback(
    async (workspaceId: string) => {
      if (!accessToken || workspaceId === activeWorkspaceId) {
        setIsOpen(false);
        return;
      }

      try {
        await switchWorkspace(accessToken, workspaceId);
      } catch {
        // Error is set in store
      }
      setIsOpen(false);
    },
    [accessToken, activeWorkspaceId, switchWorkspace],
  );

  const handleCreateWorkspace = useCallback(() => {
    setIsOpen(false);
    // Navigate to the workspaces page where the create modal lives
    router.push('/workspaces');
  }, [router]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch workspace"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-background-hover disabled:opacity-60"
      >
        {/* Workspace initial avatar */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary select-none">
          {currentWorkspace?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {currentWorkspace?.name ?? 'Select workspace'}
          </p>
          {currentWorkspace && (
            <p className="text-xs text-foreground-muted">
              {currentWorkspace.noteCount} note{currentWorkspace.noteCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {isSwitching ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
        ) : (
          <ChevronIcon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" up={isOpen} />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-background shadow-xl"
          role="listbox"
          aria-label="Workspaces"
        >
          {workspaceSummaries.length === 0 ? (
            <div className="px-4 py-3 text-sm text-foreground-muted">No workspaces found.</div>
          ) : (
            workspaceSummaries.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => void handleSwitch(workspace.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-primary/5' : 'hover:bg-background-hover'
                  }`}
                >
                  {/* Workspace avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold select-none ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {workspace.name}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getRoleBadgeClass(workspace.role)}`}
                      >
                        {workspace.role.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <span>
                        {workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}
                      </span>
                      <span aria-hidden="true">-</span>
                      <span>
                        {workspace.noteCount} note{workspace.noteCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {isActive && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}

          {/* Divider and create workspace button */}
          <div className="border-t border-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground-muted hover:bg-background-hover hover:text-foreground transition-colors"
              onClick={handleCreateWorkspace}
            >
              <PlusIcon className="h-4 w-4" />
              Create new workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

WorkspaceSwitcher.displayName = 'WorkspaceSwitcher';
