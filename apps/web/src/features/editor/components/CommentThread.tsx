'use client';

/**
 * CommentThread — thread view with the original comment and replies.
 *
 * Displays the full conversation for a comment thread, including:
 *   - The quoted text range the thread is attached to
 *   - All comments (original + replies) in chronological order
 *   - A reply input field
 *   - Actions: resolve, unresolve, delete thread
 *
 * Design decisions:
 *   - No useEffect for data loading — thread data is read from the store.
 *   - Reply submission uses an event handler, not an effect.
 *   - Auto-focus on the reply input uses a ref callback, not an effect.
 *   - Deleted comments show "[deleted]" placeholder text.
 *   - Timestamps are formatted at render time (pure function).
 */

import { useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime } from '@/shared/lib/utils';
import { getPresenceColor } from '@/shared/lib/utils';
import {
  useCommentStore,
  selectThreadById,
  type Comment,
  type CommentThread as CommentThreadType,
} from '@/shared/stores/comment-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentThreadProps {
  /** The thread ID to display. */
  threadId: string;
  /** Current user ID (for showing edit/delete on own comments). */
  currentUserId: string;
  /** Current user display name (for new replies). */
  currentUserName: string;
  /** Current user avatar URL. */
  currentUserAvatarUrl: string | null;
  /** Callback when the thread should be closed. */
  onClose?: () => void;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommentBubble({
  comment,
  isOwn,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  isOwn: boolean;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const initial = comment.authorName.charAt(0).toUpperCase();
  const authorColor = getPresenceColor(comment.authorId);

  if (comment.isDeleted) {
    return (
      <div className="flex gap-2 px-3 py-2 opacity-50">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: authorColor }}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="text-xs italic text-foreground-muted">This comment has been deleted.</div>
      </div>
    );
  }

  function handleSaveEdit() {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      setEditContent(comment.content);
      setIsEditing(false);
    }
  }

  return (
    <div className="group flex gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors">
      {/* Author avatar */}
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: authorColor }}
        title={comment.authorName}
        aria-hidden="true"
      >
        {initial}
      </div>

      {/* Comment body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
          <span className="text-[10px] text-foreground-muted">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.updatedAt && <span className="text-[10px] text-foreground-muted">(edited)</span>}
        </div>

        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
              autoFocus
            />
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded px-2 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditContent(comment.content);
                  setIsEditing(false);
                }}
                className="rounded px-2 py-0.5 text-[10px] text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {/* Edit/Delete actions (only visible for own comments, on hover) */}
        {isOwn && !isEditing && (
          <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-foreground-muted hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="text-[10px] text-foreground-muted hover:text-destructive"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommentThread({
  threadId,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl: _currentUserAvatarUrl,
  onClose,
  className,
}: CommentThreadProps) {
  const threads = useCommentStore((s) => s.threads);
  const addReply = useCommentStore((s) => s.addReply);
  const updateComment = useCommentStore((s) => s.updateComment);
  const deleteComment = useCommentStore((s) => s.deleteComment);
  const resolveThread = useCommentStore((s) => s.resolveThread);
  const unresolveThread = useCommentStore((s) => s.unresolveThread);
  const deleteThread = useCommentStore((s) => s.deleteThread);
  const setActiveThread = useCommentStore((s) => s.setActiveThread);

  const [replyContent, setReplyContent] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const thread: CommentThreadType | undefined = selectThreadById(threads, threadId);

  if (!thread) return null;

  const visibleComments = thread.comments.filter(
    (c) => !c.isDeleted || c.id === thread.comments[0]?.id,
  );

  function handleReply() {
    const content = replyContent.trim();
    if (!content) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      threadId,
      authorId: currentUserId,
      authorName: currentUserName,
      authorAvatarUrl: null,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isDeleted: false,
    };

    addReply(threadId, newComment);
    setReplyContent('');
    replyInputRef.current?.focus();
  }

  function handleReplyKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  }

  function handleResolve() {
    if (!thread) return;
    if (thread.isResolved) {
      unresolveThread(threadId);
    } else {
      resolveThread(threadId, currentUserId);
    }
  }

  function handleDelete() {
    deleteThread(threadId);
    setActiveThread(null);
    onClose?.();
  }

  function handleEdit(commentId: string, content: string) {
    updateComment(threadId, commentId, content);
  }

  function handleDeleteComment(commentId: string) {
    deleteComment(threadId, commentId);
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-background-surface shadow-lg overflow-hidden',
        className,
      )}
      role="region"
      aria-label={`Comment thread: ${thread.range.text.slice(0, 50)}`}
    >
      {/* Header: quoted text + close button */}
      <div className="flex items-start justify-between border-b border-border px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase font-semibold text-foreground-muted tracking-wider mb-1">
            Comment on
          </div>
          <blockquote className="text-xs text-foreground italic border-l-2 border-primary/40 pl-2 line-clamp-2">
            {thread.range.text}
          </blockquote>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveThread(null);
            onClose?.();
          }}
          className="ml-2 shrink-0 rounded p-0.5 text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Close comment thread"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* Resolved badge */}
      {thread.isResolved && (
        <div className="flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 text-xs text-green-600">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
          <span className="font-medium">Resolved</span>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-border/50">
        {visibleComments.map((comment) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            isOwn={comment.authorId === currentUserId}
            onEdit={handleEdit}
            onDelete={handleDeleteComment}
          />
        ))}
      </div>

      {/* Reply input */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex gap-2">
          <textarea
            ref={replyInputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder="Reply... (Enter to send)"
            className="flex-1 resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1}
          />
          <button
            type="button"
            onClick={handleReply}
            disabled={!replyContent.trim()}
            className="shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Thread actions */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <button
          type="button"
          onClick={handleResolve}
          className={cn(
            'flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
            thread.isResolved
              ? 'text-yellow-600 hover:bg-yellow-500/10'
              : 'text-green-600 hover:bg-green-500/10',
          )}
        >
          {thread.isResolved ? (
            <>
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
              </svg>
              Re-open
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
              Resolve
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-foreground-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM11 3V1.75A1.75 1.75 0 009.25 0h-2.5A1.75 1.75 0 005 1.75V3H2.75a.75.75 0 000 1.5h.68l.71 7.44A1.75 1.75 0 005.88 13.5h4.24a1.75 1.75 0 001.74-1.56l.71-7.44h.68a.75.75 0 000-1.5H11z" />
          </svg>
          Delete thread
        </button>
      </div>
    </div>
  );
}

CommentThread.displayName = 'CommentThread';
