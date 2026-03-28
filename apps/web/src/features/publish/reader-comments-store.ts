import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicReaderComment {
  id: string;
  content: string;
  authorName: string | null;
  parentId: string | null;
  createdAt: string;
  replies: PublicReaderComment[];
}

export interface ReaderCommentAdminItem {
  id: string;
  noteId: string;
  content: string;
  authorName: string | null;
  authorEmail: string | null;
  parentId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export type CommentSubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
export type CommentsLoadStatus = 'idle' | 'loading' | 'success' | 'error';
export type ModerationStatus = 'idle' | 'loading' | 'success' | 'error';

// ─── Store state ──────────────────────────────────────────────────────────────

interface ReaderCommentsState {
  // Public comment list
  comments: PublicReaderComment[];
  total: number;
  page: number;
  loadStatus: CommentsLoadStatus;
  loadError: string | null;

  // Comment submission form
  submitStatus: CommentSubmitStatus;
  submitError: string | null;
  replyToId: string | null;

  // Moderation queue (admin)
  pendingComments: ReaderCommentAdminItem[];
  moderationLoadStatus: ModerationStatus;
  moderationError: string | null;

  // Actions — public
  setComments: (comments: PublicReaderComment[], total: number) => void;
  appendComments: (comments: PublicReaderComment[], total: number) => void;
  setLoadStatus: (status: CommentsLoadStatus, error?: string | null) => void;
  setPage: (page: number) => void;
  setReplyTo: (commentId: string | null) => void;
  setSubmitStatus: (status: CommentSubmitStatus, error?: string | null) => void;
  addOptimisticComment: (comment: PublicReaderComment) => void;
  reset: () => void;

  // Actions — moderation
  setPendingComments: (comments: ReaderCommentAdminItem[]) => void;
  setModerationStatus: (status: ModerationStatus, error?: string | null) => void;
  removePendingComment: (commentId: string) => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  comments: [] as PublicReaderComment[],
  total: 0,
  page: 1,
  loadStatus: 'idle' as CommentsLoadStatus,
  loadError: null,

  submitStatus: 'idle' as CommentSubmitStatus,
  submitError: null,
  replyToId: null,

  pendingComments: [] as ReaderCommentAdminItem[],
  moderationLoadStatus: 'idle' as ModerationStatus,
  moderationError: null,
};

/**
 * ReaderCommentsStore — manages public reader comment state for published notes.
 *
 * Scope:
 *   - Comment list (public view): loaded comments, pagination, load status
 *   - Submission form: reply context, submit status / error feedback
 *   - Moderation queue: pending comments for owner admin panel
 *
 * Not persisted — ephemeral per page visit.
 */
export const useReaderCommentsStore = create<ReaderCommentsState>()(
  devtools(
    (set) => ({
      ...INITIAL_STATE,

      // ── Public comment list ──────────────────────────────────────────────

      setComments: (comments, total) => set({ comments, total }, false, 'comments/setComments'),

      appendComments: (comments, total) =>
        set(
          (state) => ({
            comments: [...state.comments, ...comments],
            total,
          }),
          false,
          'comments/appendComments',
        ),

      setLoadStatus: (status, error = null) =>
        set({ loadStatus: status, loadError: error }, false, 'comments/setLoadStatus'),

      setPage: (page) => set({ page }, false, 'comments/setPage'),

      setReplyTo: (commentId) => set({ replyToId: commentId }, false, 'comments/setReplyTo'),

      setSubmitStatus: (status, error = null) =>
        set({ submitStatus: status, submitError: error }, false, 'comments/setSubmitStatus'),

      /**
       * Optimistically appends a submitted comment as a pending placeholder.
       * This gives instant visual feedback before the server confirms.
       * The comment list should be refetched after successful submission to
       * replace the optimistic entry with the approved one.
       */
      addOptimisticComment: (comment) =>
        set(
          (state) => ({
            comments: comment.parentId
              ? state.comments.map((c) =>
                  c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c,
                )
              : [...state.comments, comment],
          }),
          false,
          'comments/addOptimisticComment',
        ),

      reset: () => set(INITIAL_STATE, false, 'comments/reset'),

      // ── Moderation queue ─────────────────────────────────────────────────

      setPendingComments: (comments) =>
        set({ pendingComments: comments }, false, 'comments/setPendingComments'),

      setModerationStatus: (status, error = null) =>
        set(
          { moderationLoadStatus: status, moderationError: error },
          false,
          'comments/setModerationStatus',
        ),

      removePendingComment: (commentId) =>
        set(
          (state) => ({
            pendingComments: state.pendingComments.filter((c) => c.id !== commentId),
          }),
          false,
          'comments/removePendingComment',
        ),
    }),
    { name: 'ReaderCommentsStore' },
  ),
);
