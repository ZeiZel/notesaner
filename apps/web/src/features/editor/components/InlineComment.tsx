'use client';

/**
 * InlineComment — comment bubble attached to a text range in the editor.
 *
 * Rendered as a small icon/badge in the editor gutter or inline with the text.
 * Clicking the bubble expands the CommentThread popover for that thread.
 *
 * Integration with TipTap:
 *   - In the full implementation, this component is rendered via a TipTap
 *     NodeView or Decoration plugin, positioned alongside the marked text.
 *   - The thread ID is stored as a mark attribute on the annotated text.
 *   - For now, this component can be used standalone with explicit positioning.
 *
 * Design decisions:
 *   - No useEffect — active state is read from the comment store.
 *   - Click handler sets the active thread in the store; the CommentThread
 *     component reacts to that change.
 *   - Visual distinction between resolved and unresolved threads.
 */

import { cn } from '@/shared/lib/utils';
import {
  useCommentStore,
  selectThreadById,
  type CommentThread as CommentThreadType,
} from '@/shared/stores/comment-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InlineCommentProps {
  /** The thread ID this inline comment represents. */
  threadId: string;
  /** Additional CSS class names. */
  className?: string;
  /** Inline style for absolute positioning (set by TipTap decoration). */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineComment({ threadId, className, style }: InlineCommentProps) {
  const threads = useCommentStore((s) => s.threads);
  const activeThreadId = useCommentStore((s) => s.activeThreadId);
  const setActiveThread = useCommentStore((s) => s.setActiveThread);

  const thread: CommentThreadType | undefined = selectThreadById(threads, threadId);

  if (!thread) return null;

  const isActive = activeThreadId === threadId;
  const replyCount = thread.comments.filter((c) => !c.isDeleted).length;
  const isResolved = thread.isResolved;

  function handleClick() {
    setActiveThread(isActive ? null : threadId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isResolved
          ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
          : isActive
            ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
            : 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20',
        className,
      )}
      style={style}
      aria-label={`Comment thread${isResolved ? ' (resolved)' : ''}: ${replyCount} comment${replyCount !== 1 ? 's' : ''}`}
      aria-expanded={isActive}
    >
      {/* Comment icon */}
      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        {isResolved ? (
          // Checkmark icon for resolved
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        ) : (
          // Speech bubble icon for unresolved
          <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5z" />
        )}
      </svg>

      {/* Reply count (only show if more than 1 comment) */}
      {replyCount > 1 && <span>{replyCount}</span>}
    </button>
  );
}

InlineComment.displayName = 'InlineComment';
