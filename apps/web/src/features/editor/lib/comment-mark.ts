/**
 * comment-mark.ts
 *
 * TipTap Mark extension for inline comment highlights.
 *
 * Renders commented text with a yellow background. The mark stores
 * the thread ID as an attribute so the UI can correlate highlighted
 * text with comment threads.
 *
 * The mark also supports a `resolved` attribute that switches the
 * highlight to a subtle green background for resolved threads.
 *
 * Features:
 *   - Mark-based extension (persists in document model)
 *   - Click detection on comment marks via ProseMirror plugin
 *   - Keyboard shortcut: Mod+Shift+M to create new comment on selection
 *   - Commands: setComment, unsetComment, toggleComment,
 *              updateCommentResolved, removeCommentByThread
 *
 * Usage in a TipTap editor:
 *   import { CommentMark } from '@/features/editor/lib/comment-mark';
 *   const editor = useEditor({
 *     extensions: [
 *       CommentMark.configure({
 *         onCommentClick: (threadId) => openPopover(threadId),
 *       }),
 *       ...
 *     ],
 *   });
 *
 * Applying the mark:
 *   editor.chain().focus().setComment({ threadId: 'abc-123' }).run();
 *
 * Removing the mark:
 *   editor.chain().focus().unsetComment().run();
 *
 * Design decisions:
 *   - Mark-based (not Decoration-based) so it persists in the document model.
 *   - The threadId links to the comment store and backend Comment.id.
 *   - Inclusive: false -- typing at mark boundaries does not extend the comment.
 *   - Rendered as <mark> for semantic meaning and accessibility.
 *   - CSS classes are applied for styling (no inline styles in mark output).
 *   - Click handling uses ProseMirror plugin (handleClick).
 *   - Multiple overlapping comment marks are supported (excludes: '').
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentMarkAttributes {
  /** The ID of the comment thread this mark belongs to. */
  threadId: string;
  /** Whether the thread is resolved (affects highlight color). */
  resolved: boolean;
}

export interface CommentMarkOptions {
  /** HTML attributes merged onto every comment mark element. */
  HTMLAttributes: Record<string, string>;
  /** Callback fired when a comment mark is clicked in the editor. */
  onCommentClick?: (threadId: string) => void;
}

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

export const COMMENT_MARK_CLICK_KEY = new PluginKey('commentMarkClick');

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment mark on the current selection.
       */
      setComment: (attrs: { threadId: string; resolved?: boolean }) => ReturnType;
      /**
       * Remove the comment mark from the current selection.
       */
      unsetComment: () => ReturnType;
      /**
       * Toggle the comment mark on the current selection.
       */
      toggleComment: (attrs: { threadId: string; resolved?: boolean }) => ReturnType;
      /**
       * Update the resolved state of all marks for a specific thread ID.
       */
      updateCommentResolved: (threadId: string, resolved: boolean) => ReturnType;
      /**
       * Remove all comment marks for a specific thread ID from the entire document.
       */
      removeCommentByThread: (threadId: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCommentWithThread(
  mark: { type: { name: string }; attrs: Record<string, unknown> },
  threadId: string,
): boolean {
  return mark.type.name === 'comment' && mark.attrs['threadId'] === threadId;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'comment',

  // Multiple comment marks can overlap (a range can have multiple threads).
  excludes: '',

  // Typing at the edge of a comment mark does not extend the mark.
  inclusive: false,

  // Do not merge adjacent comment marks with different thread IDs.
  spanning: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-thread-id'),
        renderHTML: (attributes) => ({
          'data-thread-id': attributes.threadId as string,
        }),
      },
      resolved: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-resolved') === 'true',
        renderHTML: (attributes) => ({
          'data-resolved': String(attributes.resolved),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-thread-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const resolved = HTMLAttributes['data-resolved'] === 'true';

    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: resolved ? 'ns-comment-mark ns-comment-mark--resolved' : 'ns-comment-mark',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, {
            threadId: attrs.threadId,
            resolved: attrs.resolved ?? false,
          });
        },
      unsetComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleComment:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, {
            threadId: attrs.threadId,
            resolved: attrs.resolved ?? false,
          });
        },
      updateCommentResolved:
        (threadId: string, resolved: boolean) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let updated = false;

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (isCommentWithThread(mark, threadId)) {
                const from = pos;
                const to = pos + node.nodeSize;
                tr.removeMark(from, to, mark);
                tr.addMark(from, to, markType.create({ threadId, resolved }));
                updated = true;
              }
            });
          });

          return updated;
        },
      removeCommentByThread:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          let removed = false;

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (isCommentWithThread(mark, threadId)) {
                const from = pos;
                const to = pos + node.nodeSize;
                tr.removeMark(from, to, mark);
                removed = true;
              }
            });
          });

          return removed;
        },
    };
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Mod+Shift+M: initiate new comment on current selection
      'Mod-Shift-m': () => {
        const { from, to, empty } = this.editor.state.selection;
        if (empty) return false;

        // Signal through the callback that the user wants to create a new comment
        const text = this.editor.state.doc.textBetween(from, to, ' ');
        this.options.onCommentClick?.(`new:${from}:${to}:${text}`);
        return true;
      },
    };
  },

  // -------------------------------------------------------------------------
  // ProseMirror plugins -- click detection
  // -------------------------------------------------------------------------

  addProseMirrorPlugins() {
    const extension = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return [
      new Plugin({
        key: COMMENT_MARK_CLICK_KEY,

        props: {
          handleClick(view, pos) {
            if (!extension.options.onCommentClick) return false;

            const { state } = view;
            const resolved = state.doc.resolve(pos);
            const marks = resolved.marks();

            // Find the first comment mark at the clicked position
            const commentMark = marks.find((m) => m.type.name === 'comment');
            if (!commentMark) return false;

            const threadId = commentMark.attrs['threadId'] as string;
            if (threadId) {
              extension.options.onCommentClick(threadId);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

/**
 * CSS for comment mark highlights.
 *
 * Import this in your global styles or inject via a style tag alongside the editor.
 *
 * The `--ns-comment-highlight` custom property can be set to override the default
 * yellow highlight color.
 */
export const COMMENT_MARK_CSS = `
.ns-comment-mark {
  background-color: var(--ns-comment-highlight, rgba(250, 204, 21, 0.25));
  border-bottom: 2px solid var(--ns-comment-highlight-border, rgba(250, 204, 21, 0.6));
  cursor: pointer;
  transition: background-color 150ms ease;
  border-radius: 2px;
  padding: 1px 0;
}

.ns-comment-mark:hover {
  background-color: var(--ns-comment-highlight-hover, rgba(250, 204, 21, 0.4));
}

.ns-comment-mark--resolved {
  background-color: var(--ns-comment-resolved, rgba(74, 222, 128, 0.15));
  border-bottom-color: var(--ns-comment-resolved-border, rgba(74, 222, 128, 0.4));
}

.ns-comment-mark--resolved:hover {
  background-color: var(--ns-comment-resolved-hover, rgba(74, 222, 128, 0.25));
}

.ns-comment-mark--hidden {
  background-color: transparent !important;
  border-bottom-color: transparent !important;
}
`;
