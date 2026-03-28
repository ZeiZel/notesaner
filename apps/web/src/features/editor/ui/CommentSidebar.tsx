'use client';

/**
 * CommentSidebar — panel showing all comment threads for the current note.
 *
 * Displays a filterable list of comment threads with:
 *   - Filter tabs: All / Unresolved / Resolved
 *   - Thread summary cards with quoted text, author, reply count
 *   - Click-to-expand into full CommentThread view
 *   - Unresolved count badge on the tab
 *
 * Design decisions:
 *   - No useEffect — all data is derived from the comment store.
 *   - Filter mode is stored in the comment store for persistence across
 *     sidebar open/close cycles.
 *   - Thread cards are sorted by creation date (newest first).
 *   - Active thread is highlighted and scrolled into view via ref callback.
 */

import { useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime, getPresenceColor } from '@/shared/lib/utils';
import {
  useCommentStore,
  selectFilteredThreads,
  selectUnresolvedCount,
  selectTotalCommentCount,
  type CommentFilterMode,
  type CommentThread as CommentThreadType,
} from '@/shared/stores/comment-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentSidebarProps {
  /** Current user ID for identifying own comments. */
  currentUserId: string;
  /** Current user display name for new comments. */
  currentUserName: string;
  /** Current user avatar URL. */
  currentUserAvatarUrl: string | null;
  /** Callback when the sidebar should be closed. */
  onClose?: () => void;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Filter Tab Button
// ---------------------------------------------------------------------------

function FilterTab({
  label,
  mode,
  activeMode,
  badge,
  onClick,
}: {
  label: string;
  mode: CommentFilterMode;
  activeMode: CommentFilterMode;
  badge?: number;
  onClick: (mode: CommentFilterMode) => void;
}) {
  const isActive = mode === activeMode;

  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={cn(
        'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-foreground-muted hover:text-foreground hover:bg-secondary',
      )}
      aria-pressed={isActive}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
            isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground-muted',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Thread Summary Card
// ---------------------------------------------------------------------------

function ThreadCard({
  thread,
  isActive,
  onClick,
}: {
  thread: CommentThreadType;
  isActive: boolean;
  onClick: (threadId: string) => void;
}) {
  const firstComment = thread.comments[0];
  const visibleCommentCount = thread.comments.filter((c) => !c.isDeleted).length;
  const replyCount = Math.max(0, visibleCommentCount - 1);

  // Ref callback to scroll active thread into view (no useEffect needed)
  const cardRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node && isActive) {
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
    [isActive],
  );

  if (!firstComment) return null;

  const authorColor = getPresenceColor(firstComment.authorId);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onClick(thread.id)}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        isActive
          ? 'border-primary/40 bg-primary/5'
          : 'border-border hover:border-border-hover hover:bg-secondary/30',
        thread.isResolved && 'opacity-60',
      )}
      aria-label={`Thread by ${firstComment.authorName}: ${thread.range.text.slice(0, 40)}`}
    >
      {/* Quoted text */}
      <blockquote className="text-[11px] text-foreground-muted italic border-l-2 border-primary/30 pl-2 mb-2 line-clamp-1">
        {thread.range.text}
      </blockquote>

      {/* First comment preview */}
      <div className="flex items-start gap-2">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: authorColor }}
          aria-hidden="true"
        >
          {firstComment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-medium text-foreground truncate">
              {firstComment.authorName}
            </span>
            <span className="text-[10px] text-foreground-muted shrink-0">
              {formatRelativeTime(firstComment.createdAt)}
            </span>
          </div>
          <p className="text-xs text-foreground-muted line-clamp-2 mt-0.5">
            {firstComment.isDeleted ? 'This comment has been deleted.' : firstComment.content}
          </p>
        </div>
      </div>

      {/* Footer: reply count + resolved badge */}
      <div className="flex items-center justify-between mt-2">
        {replyCount > 0 && (
          <span className="text-[10px] text-foreground-muted">
            {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
          </span>
        )}
        {thread.isResolved && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600">
            <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
            </svg>
            Resolved
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommentSidebar({
  currentUserId: _currentUserId,
  currentUserName: _currentUserName,
  currentUserAvatarUrl: _currentUserAvatarUrl,
  onClose,
  className,
}: CommentSidebarProps) {
  const threads = useCommentStore((s) => s.threads);
  const activeThreadId = useCommentStore((s) => s.activeThreadId);
  const filterMode = useCommentStore((s) => s.filterMode);
  const setFilterMode = useCommentStore((s) => s.setFilterMode);
  const setActiveThread = useCommentStore((s) => s.setActiveThread);
  const startComposing = useCommentStore((s) => s.startComposing);

  // Derived values — computed at render time, no effects
  const filteredThreads = selectFilteredThreads(threads, filterMode);
  const unresolvedCount = selectUnresolvedCount(threads);
  const totalCommentCount = selectTotalCommentCount(threads);
  const totalThreadCount = threads.size;

  function handleThreadClick(threadId: string) {
    setActiveThread(activeThreadId === threadId ? null : threadId);
  }

  function handleNewComment() {
    // Signal to the editor that we want to enter comment-selection mode.
    // The editor will listen for a text selection and call startComposing
    // with the selected range.
    startComposing({ from: 0, to: 0, text: '' });
  }

  return (
    <div
      className={cn('flex h-full flex-col bg-background-surface', className)}
      role="complementary"
      aria-label="Comments sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Comments</h2>
          {totalCommentCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[10px] font-bold text-foreground-muted">
              {totalCommentCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* New comment button */}
          <button
            type="button"
            onClick={handleNewComment}
            className="rounded p-1 text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Add new comment"
            title="Select text in the editor, then add a comment"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
          </button>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close comments sidebar"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <FilterTab
          label="All"
          mode="all"
          activeMode={filterMode}
          badge={totalThreadCount}
          onClick={setFilterMode}
        />
        <FilterTab
          label="Open"
          mode="unresolved"
          activeMode={filterMode}
          badge={unresolvedCount}
          onClick={setFilterMode}
        />
        <FilterTab
          label="Resolved"
          mode="resolved"
          activeMode={filterMode}
          onClick={setFilterMode}
        />
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              viewBox="0 0 16 16"
              className="h-8 w-8 text-foreground-muted/30 mb-3"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5z" />
            </svg>
            <p className="text-xs text-foreground-muted">
              {filterMode === 'resolved'
                ? 'No resolved comments'
                : filterMode === 'unresolved'
                  ? 'No open comments'
                  : 'No comments yet'}
            </p>
            <p className="text-[10px] text-foreground-muted/60 mt-1">
              Select text in the editor to add a comment
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isActive={activeThreadId === thread.id}
                onClick={handleThreadClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with summary */}
      {totalThreadCount > 0 && (
        <div className="border-t border-border px-4 py-2">
          <span className="text-[10px] text-foreground-muted">
            {totalThreadCount} thread{totalThreadCount !== 1 ? 's' : ''} &middot;{' '}
            {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''} &middot;{' '}
            {unresolvedCount} open
          </span>
        </div>
      )}
    </div>
  );
}

CommentSidebar.displayName = 'CommentSidebar';
