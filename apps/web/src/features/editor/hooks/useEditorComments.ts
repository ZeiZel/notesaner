/**
 * useEditorComments — Hook that integrates the TipTap CommentMark extension
 * with the Zustand comment store and TanStack Query mutations.
 *
 * This hook is responsible for:
 *   1. Syncing comment threads from the store to editor marks on load
 *   2. Handling click events on comment marks (opening popover)
 *   3. Creating new comment threads when users select text and trigger Mod+Shift+M
 *   4. Updating mark resolved state when threads are resolved/re-opened
 *   5. Removing marks when threads are deleted
 *
 * No useEffect for data fetching — TanStack Query handles the fetch lifecycle.
 * The hook subscribes to the Zustand comment store for reactive updates.
 *
 * Design decisions:
 *   - Hook returns callbacks to pass to the CommentMark extension config.
 *   - Active thread ID is tracked in useState (UI state, not business state).
 *   - New thread creation uses optimistic updates.
 */

import { useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { useCommentStore, type CommentThread } from '@/shared/stores/comment-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useCreateComment } from '@/features/comments';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseEditorCommentsOptions {
  /** The TipTap editor instance. */
  editor: Editor | null;
  /** The current note ID. */
  noteId: string;
}

export interface UseEditorCommentsReturn {
  /** The currently active (clicked) thread ID, or null. */
  activeThreadId: string | null;
  /** Close the active thread popover. */
  closeThread: () => void;
  /** Callback for CommentMark onCommentClick option. */
  handleCommentMarkClick: (threadId: string) => void;
  /** Sync all threads from the store to editor marks. Call after loading comments. */
  syncMarksFromStore: () => void;
  /** Whether comment mode is active (user is creating a new comment). */
  isCommentMode: boolean;
  /** Toggle comment mode. */
  setCommentMode: (mode: boolean) => void;
  /** Popover position for the active thread (relative to the editor). */
  popoverPosition: { top: number; left: number } | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorComments({
  editor,
  noteId,
}: UseEditorCommentsOptions): UseEditorCommentsReturn {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isCommentMode, setCommentMode] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  const threads = useCommentStore((s) => s.threads);
  const addThread = useCommentStore((s) => s.addThread);
  const user = useAuthStore((s) => s.user);
  const createCommentMutation = useCreateComment(noteId);

  // Ref to avoid stale closures in the ProseMirror plugin callbacks
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  /**
   * Handle click on a comment mark in the editor.
   * If the threadId starts with "new:", it means the user triggered Mod+Shift+M
   * and we need to create a new comment thread.
   */
  const handleCommentMarkClick = useCallback(
    (threadId: string) => {
      if (!editor) return;

      if (threadId.startsWith('new:')) {
        // Parse the position data from the signal: "new:from:to:text"
        const parts = threadId.split(':');
        const from = parseInt(parts[1] ?? '0', 10);
        const to = parseInt(parts[2] ?? '0', 10);
        const text = parts.slice(3).join(':');

        if (from === to || !text || !user) return;

        // Generate a temporary thread ID
        const tempThreadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Apply the comment mark to the selection
        editor.chain().focus().setComment({ threadId: tempThreadId }).run();

        // Create the thread in the store optimistically
        const newThread: CommentThread = {
          id: tempThreadId,
          noteId,
          range: { from, to, text },
          comments: [],
          isResolved: false,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        };
        addThread(newThread);

        // Set as active to open the popover for the user to type their comment
        setActiveThreadId(tempThreadId);
        updatePopoverPosition(editor, from);

        // Create the comment on the server (position only has from/to per DTO)
        createCommentMutation.mutate({
          content: '', // Initial empty — user will type in the popover
          position: { from, to },
        });

        setCommentMode(false);
        return;
      }

      // Regular click on an existing thread mark
      setActiveThreadId(threadId);

      // Find the mark position for popover placement
      const { doc } = editor.state;
      let markPos: number | null = null;
      doc.descendants((node, pos) => {
        if (markPos !== null) return false;
        for (const mark of node.marks) {
          if (mark.type.name === 'comment' && mark.attrs['threadId'] === threadId) {
            markPos = pos;
            return false;
          }
        }
        return true;
      });

      if (markPos !== null) {
        updatePopoverPosition(editor, markPos);
      }
    },
    [editor, noteId, user, addThread, createCommentMutation],
  );

  /**
   * Update the popover position based on a document position.
   */
  function updatePopoverPosition(editorInstance: Editor, pos: number) {
    try {
      const coords = editorInstance.view.coordsAtPos(pos);
      const editorRect = editorInstance.view.dom.getBoundingClientRect();
      setPopoverPosition({
        top: coords.top - editorRect.top + coords.bottom - coords.top + 4,
        left: coords.left - editorRect.left,
      });
    } catch {
      setPopoverPosition(null);
    }
  }

  /**
   * Close the active thread popover.
   */
  const closeThread = useCallback(() => {
    setActiveThreadId(null);
    setPopoverPosition(null);
  }, []);

  /**
   * Sync all comment threads from the store to editor marks.
   * Call this after the initial comment data is loaded from the server.
   *
   * This scans all threads and ensures the editor has corresponding marks.
   * It also updates resolved state on existing marks.
   */
  const syncMarksFromStore = useCallback(() => {
    if (!editor) return;

    const currentThreads = threadsRef.current;

    currentThreads.forEach((thread) => {
      const { from, to } = thread.range;

      // Validate positions are within document bounds
      const docSize = editor.state.doc.content.size;
      if (from < 0 || to > docSize || from >= to) return;

      // Check if mark already exists for this thread
      let markExists = false;
      editor.state.doc.nodesBetween(from, to, (node) => {
        for (const mark of node.marks) {
          if (mark.type.name === 'comment' && mark.attrs['threadId'] === thread.id) {
            markExists = true;
            // Update resolved state if it changed
            if (mark.attrs['resolved'] !== thread.isResolved) {
              editor.commands.updateCommentResolved(thread.id, thread.isResolved);
            }
          }
        }
      });

      // If no mark exists, create one
      if (!markExists) {
        const markType = editor.state.schema.marks['comment'];
        if (!markType) return;

        const { tr } = editor.state;
        tr.addMark(from, to, markType.create({ threadId: thread.id, resolved: thread.isResolved }));
        editor.view.dispatch(tr);
      }
    });
  }, [editor]);

  return {
    activeThreadId,
    closeThread,
    handleCommentMarkClick,
    syncMarksFromStore,
    isCommentMode,
    setCommentMode,
    popoverPosition,
  };
}
