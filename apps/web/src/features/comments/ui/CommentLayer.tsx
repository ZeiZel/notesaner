'use client';

/**
 * CommentLayer -- integration component that connects comment UI to the
 * comment store and TanStack Query mutations.
 *
 * This component is the single integration point for the comments feature.
 * It reads data from the comment store and dispatches API mutations.
 *
 * Responsibilities:
 *   - Syncs server data with the comment store when comments are loaded
 *   - Delegates reply/resolve/delete actions to TanStack Query mutations
 *   - Renders the CommentPanel sidebar when open
 *   - Provides the CommentBadge and CommentModeToggle for toolbar integration
 *
 * No useEffect for data loading -- TanStack Query handles the fetch lifecycle.
 * The store sync is performed by the parent page component that calls
 * `useNoteComments()` and feeds results into `loadThreads()`.
 *
 * Design decisions:
 *   - This component does NOT own data loading -- the page component does.
 *   - It only provides the event handler bridge between UI and mutations.
 *   - This keeps the component pure and testable.
 */

import { useCommentStore } from '@/shared/stores/comment-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  useReplyToComment,
  useResolveComment,
  useDeleteComment,
  useUpdateComment,
} from '../api/comments.queries';
import { CommentPanel } from './CommentPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentLayerProps {
  /** Note ID for the current note. */
  noteId: string;
  /** Called when a thread card is clicked (to scroll editor). */
  onThreadClick?: (threadId: string) => void;
  /** Called to initiate new comment mode in the editor. */
  onNewComment?: () => void;
  /** Additional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentLayer({
  noteId,
  onThreadClick,
  onNewComment,
  className,
}: CommentLayerProps) {
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useCommentStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCommentStore((s) => s.setSidebarOpen);
  const addReply = useCommentStore((s) => s.addReply);
  const resolveThread = useCommentStore((s) => s.resolveThread);
  const unresolveThread = useCommentStore((s) => s.unresolveThread);
  const deleteThread = useCommentStore((s) => s.deleteThread);
  const updateComment = useCommentStore((s) => s.updateComment);
  const deleteComment = useCommentStore((s) => s.deleteComment);
  const threads = useCommentStore((s) => s.threads);

  const replyMutation = useReplyToComment(noteId);
  const resolveMutation = useResolveComment(noteId);
  const deleteMutation = useDeleteComment(noteId);
  const updateMutation = useUpdateComment(noteId);

  if (!user || !sidebarOpen) return null;

  function handleReply(threadId: string, content: string) {
    if (!user) return;

    const thread = threads.get(threadId);
    if (!thread) return;

    // Find the root comment ID (first comment in the thread)
    const rootComment = thread.comments[0];
    if (!rootComment) return;

    // Optimistic update: add reply to store immediately
    const optimisticReply = {
      id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      threadId,
      authorId: user.id,
      authorName: user.displayName,
      authorAvatarUrl: user.avatarUrl,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isDeleted: false,
    };

    addReply(threadId, optimisticReply);

    // Fire API mutation (TanStack Query will invalidate on success)
    replyMutation.mutate({
      commentId: rootComment.id,
      payload: { content },
    });
  }

  function handleResolve(threadId: string) {
    if (!user) return;

    const thread = threads.get(threadId);
    if (!thread) return;

    const rootComment = thread.comments[0];
    if (!rootComment) return;

    // Optimistic toggle
    if (thread.isResolved) {
      unresolveThread(threadId);
    } else {
      resolveThread(threadId, user.id);
    }

    // Fire API mutation
    resolveMutation.mutate(rootComment.id);
  }

  function handleDeleteThread(threadId: string) {
    const thread = threads.get(threadId);
    if (!thread) return;

    const rootComment = thread.comments[0];
    if (!rootComment) return;

    // Optimistic delete
    deleteThread(threadId);

    // Fire API mutation
    deleteMutation.mutate(rootComment.id);
  }

  // Per-comment edit/delete handlers. Prepared for CommentPopover integration
  // when the TipTap WYSIWYG editor is fully wired with click-on-mark events.
  // Exported for external use if needed.
  void _handleEditComment;
  void _handleDeleteComment;

  function _handleEditComment(threadId: string, commentId: string, content: string) {
    // Optimistic update
    updateComment(threadId, commentId, content);

    // Fire API mutation
    updateMutation.mutate({
      commentId,
      payload: { content },
    });
  }

  function _handleDeleteComment(_threadId: string, commentId: string) {
    // Optimistic delete
    deleteComment(_threadId, commentId);

    // Fire API mutation
    deleteMutation.mutate(commentId);
  }

  return (
    <CommentPanel
      currentUserId={user.id}
      currentUserName={user.displayName}
      onClose={() => setSidebarOpen(false)}
      onThreadClick={onThreadClick}
      onReply={handleReply}
      onResolve={handleResolve}
      onDeleteThread={handleDeleteThread}
      onNewComment={onNewComment}
      className={className}
    />
  );
}

CommentLayer.displayName = 'CommentLayer';
