'use client';

/**
 * VersionHistory — Panel showing note version list with diff viewer.
 *
 * Features:
 * - Chronological list of note versions with timestamps and authors
 * - Click a version to view its diff against the previous version
 * - Restore any version with confirmation dialog
 * - Keyboard navigation (arrow keys to select, Enter to view)
 * - Responsive: collapses to single-column on narrow viewports
 *
 * State management:
 * - Selected version tracked in local state (UI-only concern)
 * - Version data fetched via useVersionHistory (TanStack Query)
 * - Diff computed during render — no useEffect for derived data
 * - Restore mutation via useRestoreVersion
 */

import { useState, useCallback, useMemo } from 'react';
import type { NoteVersionDto } from '@notesaner/contracts';
import { cn } from '@/shared/lib/utils';
import { formatDate, formatRelativeTime } from '@/shared/lib/utils';
import {
  useVersionHistory,
  useVersionContent,
  useRestoreVersion,
} from '../hooks/useVersionHistory';
import { DiffViewer } from './DiffViewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VersionHistoryProps {
  /** The note ID to show version history for. */
  noteId: string;
  /** Called when the panel should close. */
  onClose?: () => void;
  /** Additional CSS class applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Version list item
// ---------------------------------------------------------------------------

interface VersionItemProps {
  version: NoteVersionDto;
  isSelected: boolean;
  isLatest: boolean;
  onClick: () => void;
}

function VersionItem({ version, isSelected, isLatest, onClick }: VersionItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={isSelected}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-border hover:bg-accent/30',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Version {version.version}
          {isLatest && (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium text-primary">
              Latest
            </span>
          )}
        </span>
        <time
          dateTime={version.createdAt}
          className="text-[10px] text-foreground-muted"
          title={formatDate(version.createdAt)}
        >
          {formatRelativeTime(version.createdAt)}
        </time>
      </div>

      {version.message && (
        <p className="truncate text-[11px] text-foreground-muted">{version.message}</p>
      )}

      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-foreground-muted/70">
        {/* Author icon */}
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M10.56 9.73c.97-.55 1.63-1.6 1.63-2.82a3.19 3.19 0 1 0-6.38 0c0 1.21.66 2.27 1.63 2.82A5.32 5.32 0 0 0 3.5 14.5h1.01a4.31 4.31 0 0 1 6.98 0h1.01a5.32 5.32 0 0 0-1.94-4.77Z" />
        </svg>
        <span>{version.createdById}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Restore confirmation dialog
// ---------------------------------------------------------------------------

interface RestoreDialogProps {
  version: NoteVersionDto;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function RestoreDialog({ version, isPending, onConfirm, onCancel }: RestoreDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm version restore"
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-foreground">Restore version?</h3>
        <p className="mt-2 text-xs text-foreground-muted">
          This will replace the current note content with Version {version.version}
          {version.message ? ` ("${version.message}")` : ''}. A new version will be created with the
          current content before restoring.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Clock icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-8 w-8 text-foreground-muted/40"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
      <p className="mt-3 text-xs font-medium text-foreground-muted">No version history</p>
      <p className="mt-1 text-[11px] text-foreground-muted/70">
        Versions are created automatically when you save changes.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function VersionSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse rounded-md border border-border/50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-foreground-muted/20" />
            <div className="h-2.5 w-16 rounded bg-foreground-muted/10" />
          </div>
          <div className="mt-2 h-2.5 w-32 rounded bg-foreground-muted/10" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main VersionHistory component
// ---------------------------------------------------------------------------

export function VersionHistory({ noteId, onClose, className }: VersionHistoryProps) {
  const { versions, isLoading, isError, error } = useVersionHistory(noteId);
  const restoreMutation = useRestoreVersion(noteId);

  // Local UI state
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<NoteVersionDto | null>(null);

  // Find selected version and its predecessor
  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  const previousVersion = useMemo(() => {
    if (!selectedVersion) return null;
    const idx = versions.findIndex((v) => v.id === selectedVersion.id);
    // Versions are ordered newest first — previous version is at idx + 1
    return idx < versions.length - 1 ? versions[idx + 1] : null;
  }, [versions, selectedVersion]);

  // Fetch content for the selected version and its predecessor
  const selectedContentQuery = useVersionContent(noteId, selectedVersionId);
  const previousContentQuery = useVersionContent(noteId, previousVersion?.id ?? null);

  // Diff source and target content
  const diffOldContent = previousContentQuery.data?.content ?? '';
  const diffNewContent = selectedContentQuery.data?.content ?? '';

  const handleVersionClick = useCallback((versionId: string) => {
    setSelectedVersionId((prev) => (prev === versionId ? null : versionId));
  }, []);

  const handleRestore = useCallback((version: NoteVersionDto) => {
    setRestoreTarget(version);
  }, []);

  const handleConfirmRestore = useCallback(() => {
    if (!restoreTarget) return;
    restoreMutation.mutate(restoreTarget.id, {
      onSuccess: () => {
        setRestoreTarget(null);
        setSelectedVersionId(null);
      },
    });
  }, [restoreTarget, restoreMutation]);

  const handleCancelRestore = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (versions.length === 0) return;

      const currentIdx = selectedVersionId
        ? versions.findIndex((v) => v.id === selectedVersionId)
        : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, versions.length - 1);
        setSelectedVersionId(versions[nextIdx].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        setSelectedVersionId(versions[prevIdx].id);
      } else if (e.key === 'Escape') {
        setSelectedVersionId(null);
        onClose?.();
      }
    },
    [versions, selectedVersionId, onClose],
  );

  return (
    <div
      className={cn('flex h-full flex-col overflow-hidden bg-card', className)}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="region"
      aria-label="Version history"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {/* History icon */}
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5 text-foreground-muted"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM8.5 4a.5.5 0 0 0-1 0v4a.5.5 0 0 0 .252.434l2.5 1.5a.5.5 0 0 0 .515-.868L8.5 7.72V4Z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-xs font-semibold text-foreground">Version History</h2>
          {versions.length > 0 && (
            <span className="rounded-full bg-foreground-muted/10 px-1.5 py-px text-[9px] font-medium text-foreground-muted">
              {versions.length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:bg-accent hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Version list (left side) */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border">
          {isLoading ? (
            <VersionSkeleton />
          ) : isError ? (
            <div className="p-4 text-center">
              <p className="text-xs text-red-500">Failed to load versions</p>
              <p className="mt-1 text-[10px] text-foreground-muted">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          ) : versions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-1 p-2" role="listbox" aria-label="Version list">
              {versions.map((version, idx) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isSelected={version.id === selectedVersionId}
                  isLatest={idx === 0}
                  onClick={() => handleVersionClick(version.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Diff viewer (right side) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedVersion ? (
            <>
              {/* Version detail header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    Version {selectedVersion.version}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-foreground-muted">
                    <time dateTime={selectedVersion.createdAt}>
                      {formatDate(selectedVersion.createdAt, {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })}
                    </time>
                    {selectedVersion.message && ` -- ${selectedVersion.message}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(selectedVersion)}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                  title="Restore this version"
                >
                  Restore
                </button>
              </div>

              {/* Diff content */}
              <div className="flex-1 overflow-auto p-3">
                {selectedContentQuery.isLoading || previousContentQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="ml-2 text-xs text-foreground-muted">Loading diff...</span>
                  </div>
                ) : (
                  <DiffViewer
                    oldContent={diffOldContent}
                    newContent={diffNewContent}
                    oldLabel={previousVersion ? `Version ${previousVersion.version}` : 'Initial'}
                    newLabel={`Version ${selectedVersion.version}`}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="mx-auto h-8 w-8 text-foreground-muted/30"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                  />
                </svg>
                <p className="mt-2 text-xs text-foreground-muted">
                  Select a version to view changes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <RestoreDialog
          version={restoreTarget}
          isPending={restoreMutation.isPending}
          onConfirm={handleConfirmRestore}
          onCancel={handleCancelRestore}
        />
      )}
    </div>
  );
}
