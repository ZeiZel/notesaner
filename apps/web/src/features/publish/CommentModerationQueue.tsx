'use client';

/**
 * CommentModerationQueue — admin panel for reviewing and moderating reader comments.
 *
 * Features:
 *   - Lists all pending comments for a specific note
 *   - Shows author name, email (for contact purposes), timestamp
 *   - Approve / Reject buttons per comment
 *   - Hard-delete (GDPR) button with confirmation
 *   - Empty state and loading skeleton
 *   - Error handling with retry
 *
 * Usage:
 *   <CommentModerationQueue
 *     workspaceId={workspaceId}
 *     noteId={noteId}
 *     noteTitle="My Note"
 *   />
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { readerCommentsApi } from '@/shared/api/reader-comments';
import type { ReaderCommentAdminDto, CommentModerationAction } from '@/shared/api/reader-comments';

// ─── Query key factory ─────────────────────────────────────────────────────────

const commentKeys = {
  queue: (workspaceId: string, noteId: string) =>
    ['reader-comments', 'moderation', workspaceId, noteId] as const,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CommentModerationQueueProps {
  workspaceId: string;
  noteId: string;
  noteTitle?: string;
}

// ─── CommentModerationQueue ───────────────────────────────────────────────────

export function CommentModerationQueue({
  workspaceId,
  noteId,
  noteTitle,
}: CommentModerationQueueProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  // ── Load moderation queue ─────────────────────────────────────────────────

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: commentKeys.queue(workspaceId, noteId),
    queryFn: () => readerCommentsApi.getModerationQueue(accessToken ?? '', workspaceId, noteId),
    enabled: !!accessToken,
    staleTime: 30_000,
  });

  const pendingComments = data?.pending ?? [];

  // ── Moderate mutation ─────────────────────────────────────────────────────

  const moderateMutation = useMutation({
    mutationFn: ({ commentId, action }: { commentId: string; action: CommentModerationAction }) =>
      readerCommentsApi.moderate(accessToken ?? '', commentId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentKeys.queue(workspaceId, noteId),
      });
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => readerCommentsApi.delete(accessToken ?? '', commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentKeys.queue(workspaceId, noteId),
      });
    },
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Comment moderation queue">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Comment moderation</h3>
          {noteTitle && <p className="mt-0.5 text-sm text-foreground-secondary">{noteTitle}</p>}
        </div>
        {data && data.total > 0 && (
          <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-medium text-warning">
            {data.total} pending
          </span>
        )}
      </div>

      {isLoading && <ModerationQueueSkeleton />}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">Failed to load comments.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-xs font-medium text-destructive underline-offset-2 hover:underline focus:outline-none"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && pendingComments.length === 0 && (
        <div className="rounded-lg border border-border bg-background-surface px-4 py-8 text-center">
          <p className="text-sm text-foreground-muted">No comments pending moderation.</p>
        </div>
      )}

      {!isLoading && !isError && pendingComments.length > 0 && (
        <ul className="space-y-3" role="list">
          {pendingComments.map((comment) => (
            <CommentModerationCard
              key={comment.id}
              comment={comment}
              onApprove={() =>
                moderateMutation.mutate({ commentId: comment.id, action: 'approve' })
              }
              onReject={() => moderateMutation.mutate({ commentId: comment.id, action: 'reject' })}
              onDelete={() => deleteMutation.mutate(comment.id)}
              isProcessing={moderateMutation.isPending || deleteMutation.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── CommentModerationCard ────────────────────────────────────────────────────

interface CommentModerationCardProps {
  comment: ReaderCommentAdminDto;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}

function CommentModerationCard({
  comment,
  onApprove,
  onReject,
  onDelete,
  isProcessing,
}: CommentModerationCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(comment.createdAt));

  const displayName = comment.authorName ?? 'Anonymous';

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      {/* Author + metadata */}
      <div className="mb-2 flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">{displayName}</span>
        {comment.authorEmail && (
          <a
            href={`mailto:${comment.authorEmail}`}
            className="text-xs text-foreground-muted hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            {comment.authorEmail}
          </a>
        )}
        <time dateTime={comment.createdAt} className="ml-auto text-xs text-foreground-muted">
          {formattedDate}
        </time>
      </div>

      {comment.parentId && (
        <p className="mb-1.5 text-xs text-foreground-muted italic">
          Reply to comment #{comment.parentId.slice(0, 8)}
        </p>
      )}

      {/* Comment content */}
      <p className="mb-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {comment.content}
      </p>

      {/* Action buttons */}
      {confirmingDelete ? (
        <div className="flex items-center gap-2">
          <p className="mr-auto text-xs text-destructive font-medium">
            Permanently delete this comment?
          </p>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={isProcessing}
            className="rounded px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:text-foreground focus:outline-none transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isProcessing}
            className="rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive/50 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? 'Deleting...' : 'Yes, delete'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isProcessing}
            className="rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 focus:outline-none focus:ring-2 focus:ring-success/50 disabled:opacity-50 transition-colors"
            aria-label={`Approve comment by ${displayName}`}
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isProcessing}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-background-hover focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            aria-label={`Reject comment by ${displayName}`}
          >
            {isProcessing ? 'Processing...' : 'Reject'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={isProcessing}
            className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 focus:outline-none focus:ring-2 focus:ring-destructive/50 disabled:opacity-50 transition-colors"
            aria-label={`Delete comment by ${displayName} (GDPR)`}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ModerationQueueSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading moderation queue">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-3 w-24 animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-32 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="mb-4 space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-16 animate-pulse rounded-md bg-foreground/10" />
            <div className="h-7 w-14 animate-pulse rounded-md bg-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
