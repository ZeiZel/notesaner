'use client';

/**
 * ReaderComments — public-facing comment section for published notes.
 *
 * Features:
 *   - Displays approved threaded comments (1 level deep)
 *   - Submit form with optional name/email and honeypot field
 *   - Reply form triggered from root comments
 *   - Load more pagination
 *   - Comment count badge
 *   - Rate-limit and error feedback
 *
 * Usage:
 *   <ReaderComments publicSlug="my-vault" notePath="folder/note.md" />
 */

import { useState, useCallback, useEffect, useId } from 'react';
import { useReaderCommentsStore } from './reader-comments-store';
import type { PublicReaderComment } from './reader-comments-store';
import { readerCommentsApi } from '@/shared/api/reader-comments';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReaderCommentsProps {
  publicSlug: string;
  notePath: string;
}

interface CommentFormValues {
  content: string;
  authorName: string;
  authorEmail: string;
  honeypot: string;
}

const EMPTY_FORM: CommentFormValues = {
  content: '',
  authorName: '',
  authorEmail: '',
  honeypot: '',
};

// ─── ReaderComments ───────────────────────────────────────────────────────────

export function ReaderComments({ publicSlug, notePath }: ReaderCommentsProps) {
  const {
    comments,
    total,
    page,
    loadStatus,
    loadError,
    replyToId,
    setComments,
    appendComments,
    setLoadStatus,
    setPage,
    setReplyTo,
    reset,
  } = useReaderCommentsStore();

  // Load comments on mount
  useEffect(() => {
    reset();
    void loadComments(1);
  }, [publicSlug, notePath]);

  const loadComments = useCallback(
    async (targetPage: number) => {
      setLoadStatus('loading');
      try {
        const data = await readerCommentsApi.list(publicSlug, notePath, targetPage);
        if (targetPage === 1) {
          setComments(data.comments, data.total);
        } else {
          appendComments(data.comments, data.total);
        }
        setPage(targetPage);
        setLoadStatus('success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load comments';
        setLoadStatus('error', message);
      }
    },
    [publicSlug, notePath, setComments, appendComments, setPage, setLoadStatus],
  );

  const handleLoadMore = useCallback(() => {
    void loadComments(page + 1);
  }, [page, loadComments]);

  const handleCommentSubmitted = useCallback(() => {
    // Refresh from page 1 after a successful submission
    void loadComments(1);
  }, [loadComments]);

  const hasMore = comments.length < total;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Reader comments" className="mt-12 border-t border-border pt-8">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">Comments</h2>
        {total > 0 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
            {total}
          </span>
        )}
      </div>

      {/* Comment submission form */}
      <CommentForm
        publicSlug={publicSlug}
        notePath={notePath}
        parentId={null}
        onSuccess={handleCommentSubmitted}
      />

      {/* Comment list */}
      <div className="mt-8 space-y-6">
        {loadStatus === 'loading' && comments.length === 0 && <CommentListSkeleton />}

        {loadStatus === 'error' && loadError && (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        )}

        {loadStatus !== 'loading' && comments.length === 0 && (
          <p className="text-sm text-foreground-muted">
            No comments yet. Be the first to leave one.
          </p>
        )}

        {comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            publicSlug={publicSlug}
            notePath={notePath}
            replyToId={replyToId}
            onReplyToggle={(id) => setReplyTo(replyToId === id ? null : id)}
            onReplySuccess={handleCommentSubmitted}
          />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadStatus === 'loading'}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-background-hover focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
          >
            {loadStatus === 'loading' ? 'Loading...' : 'Load more comments'}
          </button>
        )}
      </div>
    </section>
  );
}

// ─── CommentThread ─────────────────────────────────────────────────────────────

interface CommentThreadProps {
  comment: PublicReaderComment;
  publicSlug: string;
  notePath: string;
  replyToId: string | null;
  onReplyToggle: (commentId: string) => void;
  onReplySuccess: () => void;
}

function CommentThread({
  comment,
  publicSlug,
  notePath,
  replyToId,
  onReplyToggle,
  onReplySuccess,
}: CommentThreadProps) {
  const isReplying = replyToId === comment.id;

  return (
    <div className="group">
      <CommentCard comment={comment}>
        <button
          type="button"
          onClick={() => onReplyToggle(comment.id)}
          className="mt-2 text-xs font-medium text-foreground-muted hover:text-foreground focus:outline-none transition-colors"
          aria-expanded={isReplying}
        >
          {isReplying ? 'Cancel reply' : 'Reply'}
        </button>
      </CommentCard>

      {/* Inline reply form */}
      {isReplying && (
        <div className="ml-8 mt-3">
          <CommentForm
            publicSlug={publicSlug}
            notePath={notePath}
            parentId={comment.id}
            onSuccess={() => {
              onReplyToggle(comment.id); // collapse form
              onReplySuccess();
            }}
            compact
          />
        </div>
      )}

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 border-border pl-4">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CommentCard ──────────────────────────────────────────────────────────────

interface CommentCardProps {
  comment: PublicReaderComment;
  children?: React.ReactNode;
}

function CommentCard({ comment, children }: CommentCardProps) {
  const displayName = comment.authorName ?? 'Anonymous';
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(comment.createdAt));

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        {/* Avatar placeholder */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          aria-hidden="true"
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground leading-none">{displayName}</span>
          <time dateTime={comment.createdAt} className="text-xs text-foreground-muted">
            {formattedDate}
          </time>
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {comment.content}
      </p>

      {children}
    </article>
  );
}

// ─── CommentForm ──────────────────────────────────────────────────────────────

interface CommentFormProps {
  publicSlug: string;
  notePath: string;
  parentId: string | null;
  onSuccess: () => void;
  compact?: boolean;
}

function CommentForm({
  publicSlug,
  notePath,
  parentId,
  onSuccess,
  compact = false,
}: CommentFormProps) {
  const [form, setForm] = useState<CommentFormValues>(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  const handleChange = useCallback(
    (field: keyof CommentFormValues) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.content.trim()) return;

      setStatus('submitting');
      setError(null);

      try {
        await readerCommentsApi.create(publicSlug, notePath, {
          content: form.content.trim(),
          authorName: form.authorName.trim() || undefined,
          authorEmail: form.authorEmail.trim() || undefined,
          parentId: parentId ?? undefined,
          honeypot: form.honeypot,
        });
        setForm(EMPTY_FORM);
        setStatus('success');
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit comment';
        setError(message);
        setStatus('error');
      }
    },
    [form, publicSlug, notePath, parentId, onSuccess],
  );

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-card p-4 text-sm text-foreground-secondary"
      >
        Your comment has been submitted and is awaiting moderation.
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="space-y-3">
        {/* Content */}
        <div>
          <label
            htmlFor={`${formId}-content`}
            className="mb-1.5 block text-xs font-medium text-foreground-secondary"
          >
            {compact ? 'Your reply' : 'Leave a comment'}
          </label>
          <textarea
            id={`${formId}-content`}
            value={form.content}
            onChange={handleChange('content')}
            rows={compact ? 3 : 4}
            maxLength={2000}
            required
            placeholder={compact ? 'Write a reply...' : 'Share your thoughts...'}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
            aria-describedby={error ? `${formId}-error` : undefined}
          />
          <p className="mt-0.5 text-right text-xs text-foreground-muted" aria-live="polite">
            {form.content.length}/2000
          </p>
        </div>

        {/* Name + Email row */}
        {!compact && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor={`${formId}-name`}
                className="mb-1 block text-xs font-medium text-foreground-secondary"
              >
                Name <span className="font-normal text-foreground-muted">(optional)</span>
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                value={form.authorName}
                onChange={handleChange('authorName')}
                maxLength={100}
                placeholder="Anonymous"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="name"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor={`${formId}-email`}
                className="mb-1 block text-xs font-medium text-foreground-secondary"
              >
                Email{' '}
                <span className="font-normal text-foreground-muted">(optional, not shown)</span>
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                value={form.authorEmail}
                onChange={handleChange('authorEmail')}
                maxLength={255}
                placeholder="your@email.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="email"
              />
            </div>
          </div>
        )}

        {/*
         * Honeypot field — hidden from real users via CSS.
         * Bots that fill in all visible fields will trigger this, causing
         * the backend to silently reject the submission.
         * tabIndex=-1 and aria-hidden prevent keyboard/screen-reader access.
         */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          <label htmlFor={`${formId}-hp`}>Website</label>
          <input
            id={`${formId}-hp`}
            type="text"
            name="website"
            value={form.honeypot}
            onChange={handleChange('honeypot')}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Error */}
        {status === 'error' && error && (
          <p id={`${formId}-error`} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'submitting' || !form.content.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
        >
          {status === 'submitting' ? 'Submitting...' : compact ? 'Post reply' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CommentListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading comments">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-full bg-foreground/10" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-foreground/10" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-foreground/10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
