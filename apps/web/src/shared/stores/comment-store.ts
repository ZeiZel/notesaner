/**
 * comment-store.ts
 *
 * Zustand store for inline comments attached to text ranges in the editor.
 *
 * Comments are linked to specific text ranges via TipTap marks/decorations.
 * Each comment belongs to a thread, which can have replies. Threads can be
 * resolved (hidden from the editor gutter but still accessible in the sidebar).
 *
 * Design decisions:
 *   - Store is NOT persisted — comments are loaded from the server API on
 *     each note open, and mutations are sent to the server optimistically.
 *   - Thread IDs are used as TipTap mark attributes to link comments to text.
 *   - Resolved threads are kept in state for the sidebar "resolved" filter.
 *   - All computed values (thread counts, unresolved count) are derived at
 *     render time via exported selector functions — no effects needed.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Text range within the document that a comment thread is attached to. */
export interface CommentTextRange {
  /** Starting character offset from the beginning of the document. */
  from: number;
  /** Ending character offset from the beginning of the document. */
  to: number;
  /** The selected text at the time the comment was created (for reference). */
  text: string;
}

/** A single comment (either the root of a thread or a reply). */
export interface Comment {
  /** Unique comment ID. */
  id: string;
  /** ID of the thread this comment belongs to. */
  threadId: string;
  /** Author user ID. */
  authorId: string;
  /** Author display name. */
  authorName: string;
  /** Author avatar URL. */
  authorAvatarUrl: string | null;
  /** Comment body text (plain text or markdown). */
  content: string;
  /** ISO timestamp of when the comment was created. */
  createdAt: string;
  /** ISO timestamp of the last edit, or null if never edited. */
  updatedAt: string | null;
  /** Whether this comment has been soft-deleted. */
  isDeleted: boolean;
}

/** A comment thread attached to a text range. */
export interface CommentThread {
  /** Unique thread ID (used as TipTap mark attribute). */
  id: string;
  /** Note ID this thread belongs to. */
  noteId: string;
  /** Text range the thread is attached to. */
  range: CommentTextRange;
  /** All comments in the thread, ordered by creation time. */
  comments: Comment[];
  /** Whether the thread has been resolved. */
  isResolved: boolean;
  /** User ID of who resolved the thread, if resolved. */
  resolvedBy: string | null;
  /** ISO timestamp of when the thread was resolved. */
  resolvedAt: string | null;
  /** ISO timestamp of the thread creation. */
  createdAt: string;
}

/** Filter mode for the comment sidebar. */
export type CommentFilterMode = 'all' | 'unresolved' | 'resolved';

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

interface CommentStoreState {
  /** All comment threads for the current note, keyed by thread ID. */
  threads: Map<string, CommentThread>;

  /** ID of the currently active (focused) thread, or null. */
  activeThreadId: string | null;

  /** Note ID the comments are loaded for. */
  noteId: string | null;

  /** Filter mode for the sidebar. */
  filterMode: CommentFilterMode;

  /** Whether the comment sidebar is open. */
  sidebarOpen: boolean;

  /** Whether a new comment is being composed (selection mode). */
  isComposing: boolean;

  /** Text range currently selected for a new comment. */
  composingRange: CommentTextRange | null;

  /** Loading state for async operations. */
  isLoading: boolean;

  // ---- Actions ----

  /** Load threads for a note (replaces all existing threads). */
  loadThreads: (noteId: string, threads: CommentThread[]) => void;

  /** Add a new comment thread. */
  addThread: (thread: CommentThread) => void;

  /** Add a reply to an existing thread. */
  addReply: (threadId: string, comment: Comment) => void;

  /** Update a comment's content. */
  updateComment: (threadId: string, commentId: string, content: string) => void;

  /** Soft-delete a comment. */
  deleteComment: (threadId: string, commentId: string) => void;

  /** Resolve a thread. */
  resolveThread: (threadId: string, resolvedBy: string) => void;

  /** Unresolve a thread. */
  unresolveThread: (threadId: string) => void;

  /** Delete an entire thread. */
  deleteThread: (threadId: string) => void;

  /** Set the active (focused) thread. */
  setActiveThread: (threadId: string | null) => void;

  /** Set the sidebar filter mode. */
  setFilterMode: (mode: CommentFilterMode) => void;

  /** Toggle the sidebar open/closed. */
  toggleSidebar: () => void;

  /** Set sidebar open state explicitly. */
  setSidebarOpen: (open: boolean) => void;

  /** Enter composing mode with a text range. */
  startComposing: (range: CommentTextRange) => void;

  /** Cancel composing mode. */
  cancelComposing: () => void;

  /** Set loading state. */
  setLoading: (loading: boolean) => void;

  /** Clear all comment state (e.g., when navigating away from a note). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCommentStore = create<CommentStoreState>()(
  devtools(
    (set) => ({
      // Initial state
      threads: new Map(),
      activeThreadId: null,
      noteId: null,
      filterMode: 'unresolved',
      sidebarOpen: false,
      isComposing: false,
      composingRange: null,
      isLoading: false,

      // Actions
      loadThreads: (noteId, threads) => {
        const threadMap = new Map<string, CommentThread>();
        for (const thread of threads) {
          threadMap.set(thread.id, thread);
        }
        set(
          { noteId, threads: threadMap, activeThreadId: null, isLoading: false },
          false,
          'comments/loadThreads',
        );
      },

      addThread: (thread) =>
        set(
          (state) => {
            const newThreads = new Map(state.threads);
            newThreads.set(thread.id, thread);
            return {
              threads: newThreads,
              activeThreadId: thread.id,
              isComposing: false,
              composingRange: null,
            };
          },
          false,
          'comments/addThread',
        ),

      addReply: (threadId, comment) =>
        set(
          (state) => {
            const thread = state.threads.get(threadId);
            if (!thread) return state;

            const newThreads = new Map(state.threads);
            newThreads.set(threadId, {
              ...thread,
              comments: [...thread.comments, comment],
            });
            return { threads: newThreads };
          },
          false,
          'comments/addReply',
        ),

      updateComment: (threadId, commentId, content) =>
        set(
          (state) => {
            const thread = state.threads.get(threadId);
            if (!thread) return state;

            const newThreads = new Map(state.threads);
            newThreads.set(threadId, {
              ...thread,
              comments: thread.comments.map((c) =>
                c.id === commentId ? { ...c, content, updatedAt: new Date().toISOString() } : c,
              ),
            });
            return { threads: newThreads };
          },
          false,
          'comments/updateComment',
        ),

      deleteComment: (threadId, commentId) =>
        set(
          (state) => {
            const thread = state.threads.get(threadId);
            if (!thread) return state;

            const newThreads = new Map(state.threads);
            newThreads.set(threadId, {
              ...thread,
              comments: thread.comments.map((c) =>
                c.id === commentId ? { ...c, isDeleted: true } : c,
              ),
            });
            return { threads: newThreads };
          },
          false,
          'comments/deleteComment',
        ),

      resolveThread: (threadId, resolvedBy) =>
        set(
          (state) => {
            const thread = state.threads.get(threadId);
            if (!thread) return state;

            const newThreads = new Map(state.threads);
            newThreads.set(threadId, {
              ...thread,
              isResolved: true,
              resolvedBy,
              resolvedAt: new Date().toISOString(),
            });
            return { threads: newThreads };
          },
          false,
          'comments/resolveThread',
        ),

      unresolveThread: (threadId) =>
        set(
          (state) => {
            const thread = state.threads.get(threadId);
            if (!thread) return state;

            const newThreads = new Map(state.threads);
            newThreads.set(threadId, {
              ...thread,
              isResolved: false,
              resolvedBy: null,
              resolvedAt: null,
            });
            return { threads: newThreads };
          },
          false,
          'comments/unresolveThread',
        ),

      deleteThread: (threadId) =>
        set(
          (state) => {
            const newThreads = new Map(state.threads);
            newThreads.delete(threadId);
            const activeThreadId = state.activeThreadId === threadId ? null : state.activeThreadId;
            return { threads: newThreads, activeThreadId };
          },
          false,
          'comments/deleteThread',
        ),

      setActiveThread: (threadId) =>
        set({ activeThreadId: threadId }, false, 'comments/setActiveThread'),

      setFilterMode: (filterMode) => set({ filterMode }, false, 'comments/setFilterMode'),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'comments/toggleSidebar'),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }, false, 'comments/setSidebarOpen'),

      startComposing: (range) =>
        set({ isComposing: true, composingRange: range }, false, 'comments/startComposing'),

      cancelComposing: () =>
        set({ isComposing: false, composingRange: null }, false, 'comments/cancelComposing'),

      setLoading: (isLoading) => set({ isLoading }, false, 'comments/setLoading'),

      reset: () =>
        set(
          {
            threads: new Map(),
            activeThreadId: null,
            noteId: null,
            filterMode: 'unresolved',
            sidebarOpen: false,
            isComposing: false,
            composingRange: null,
            isLoading: false,
          },
          false,
          'comments/reset',
        ),
    }),
    { name: 'CommentStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors (pure functions — no effects)
// ---------------------------------------------------------------------------

/** Get all threads as a sorted array (newest first). */
export function selectThreadsArray(threads: Map<string, CommentThread>): CommentThread[] {
  return Array.from(threads.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Get threads filtered by mode. */
export function selectFilteredThreads(
  threads: Map<string, CommentThread>,
  filterMode: CommentFilterMode,
): CommentThread[] {
  const all = selectThreadsArray(threads);
  switch (filterMode) {
    case 'all':
      return all;
    case 'unresolved':
      return all.filter((t) => !t.isResolved);
    case 'resolved':
      return all.filter((t) => t.isResolved);
  }
}

/** Count of unresolved threads. */
export function selectUnresolvedCount(threads: Map<string, CommentThread>): number {
  let count = 0;
  for (const thread of threads.values()) {
    if (!thread.isResolved) count++;
  }
  return count;
}

/** Total comment count (excluding deleted). */
export function selectTotalCommentCount(threads: Map<string, CommentThread>): number {
  let count = 0;
  for (const thread of threads.values()) {
    count += thread.comments.filter((c) => !c.isDeleted).length;
  }
  return count;
}

/** Get a thread by its ID. */
export function selectThreadById(
  threads: Map<string, CommentThread>,
  threadId: string,
): CommentThread | undefined {
  return threads.get(threadId);
}
