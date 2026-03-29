/**
 * CommentMark — TipTap Mark extension for inline comment annotations.
 *
 * Features:
 * - Mark-based extension that wraps selected text with a comment thread reference
 * - `threadId` attribute links the marked text to a CommentThread in the store
 * - Visual: yellow semi-transparent background on commented text ranges
 * - Resolved threads use a lighter, desaturated background
 * - Click on a comment mark emits a `commentMarkClicked` event via the editor
 * - Commands: setCommentMark(threadId), unsetCommentMark, toggleCommentMark(threadId)
 * - Keyboard shortcut: Mod+Shift+M to toggle comment mode (creates new thread)
 * - CSS class output: `ns-comment-mark` with active/resolved variants
 *
 * Usage:
 * ```ts
 * import { CommentMark } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   CommentMark,
 * ];
 *
 * // Apply comment mark to selection:
 * editor.commands.setCommentMark('thread-uuid');
 *
 * // Remove comment mark:
 * editor.commands.unsetCommentMark();
 * ```
 *
 * Architecture notes:
 * - This is a TipTap Mark (inline formatting) that pairs with the comment-store.
 * - The `threadId` attribute is stored as `data-thread-id` on the rendered HTML.
 * - The `resolved` attribute controls visual styling (lighter background).
 * - Click detection uses ProseMirror plugin with handleClick.
 * - Multiple overlapping comment marks are supported (exclusive: false).
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Attributes stored on the comment mark. */
export interface CommentMarkAttrs {
  /** The thread ID this mark is associated with. */
  threadId: string;
  /** Whether the thread is resolved (changes visual style). */
  resolved: boolean;
}

/** Options for the CommentMark extension. */
export interface CommentMarkOptions {
  /** HTML attributes merged onto every comment mark `<span>` element. */
  HTMLAttributes: Record<string, string>;
  /** Callback fired when a comment mark is clicked. */
  onCommentClick?: (threadId: string) => void;
}

// ---------------------------------------------------------------------------
// Plugin key for the click-handler plugin
// ---------------------------------------------------------------------------

export const COMMENT_MARK_PLUGIN_KEY = new PluginKey('commentMarkClick');

// ---------------------------------------------------------------------------
// CSS constants
// ---------------------------------------------------------------------------

/** Default background color for active (unresolved) comment marks. */
export const COMMENT_MARK_ACTIVE_BG = 'rgba(250, 204, 21, 0.25)';

/** Default background color for resolved comment marks. */
export const COMMENT_MARK_RESOLVED_BG = 'rgba(156, 163, 175, 0.15)';

/** Default border-bottom for active comment marks. */
export const COMMENT_MARK_ACTIVE_BORDER = '2px solid rgba(250, 204, 21, 0.6)';

/** Default border-bottom for resolved comment marks. */
export const COMMENT_MARK_RESOLVED_BORDER = '2px solid rgba(156, 163, 175, 0.3)';

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /**
       * Apply a comment mark to the current selection, linking it to a thread.
       * @param threadId - The UUID of the comment thread.
       */
      setCommentMark: (threadId: string) => ReturnType;

      /**
       * Remove the comment mark from the current selection.
       */
      unsetCommentMark: () => ReturnType;

      /**
       * Toggle the comment mark on the current selection.
       * @param threadId - The UUID of the comment thread.
       */
      toggleCommentMark: (threadId: string) => ReturnType;

      /**
       * Update the resolved state of all comment marks with a given thread ID.
       * @param threadId - The UUID of the comment thread.
       * @param resolved - Whether the thread is resolved.
       */
      updateCommentMarkResolved: (threadId: string, resolved: boolean) => ReturnType;

      /**
       * Remove all comment marks for a given thread ID.
       * @param threadId - The UUID of the comment thread to remove marks for.
       */
      removeCommentMarkByThread: (threadId: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a mark is a comment mark with a specific thread ID.
 */
function isCommentMarkWithThread(
  mark: { type: { name: string }; attrs: Record<string, unknown> },
  threadId: string,
): boolean {
  return mark.type.name === 'commentMark' && mark.attrs['threadId'] === threadId;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'commentMark',

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  // Allow multiple comment marks on the same text range
  excludes: '',

  // Do not merge adjacent comment marks with different thread IDs
  spanning: false,

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-thread-id'),
        renderHTML: (attrs) => ({
          'data-thread-id': attrs['threadId'] as string,
        }),
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-resolved') === 'true',
        renderHTML: (attrs) => ({
          'data-resolved': String(attrs['resolved'] ?? false),
        }),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'span[data-thread-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const resolved = HTMLAttributes['data-resolved'] === 'true';
    const bg = resolved
      ? `var(--ns-comment-resolved-bg, ${COMMENT_MARK_RESOLVED_BG})`
      : `var(--ns-comment-active-bg, ${COMMENT_MARK_ACTIVE_BG})`;
    const borderBottom = resolved
      ? `var(--ns-comment-resolved-border, ${COMMENT_MARK_RESOLVED_BORDER})`
      : `var(--ns-comment-active-border, ${COMMENT_MARK_ACTIVE_BORDER})`;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `ns-comment-mark ${resolved ? 'ns-comment-mark--resolved' : 'ns-comment-mark--active'}`,
        style: `background-color: ${bg}; border-bottom: ${borderBottom}; cursor: pointer;`,
      }),
      0, // Content hole
    ];
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      setCommentMark:
        (threadId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { threadId, resolved: false });
        },

      unsetCommentMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      toggleCommentMark:
        (threadId: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { threadId, resolved: false });
        },

      updateCommentMarkResolved:
        (threadId: string, resolved: boolean) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let updated = false;

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (isCommentMarkWithThread(mark, threadId)) {
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

      removeCommentMarkByThread:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          let removed = false;

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (isCommentMarkWithThread(mark, threadId)) {
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
      // Mod+Shift+M: trigger comment mode (create new comment on selection).
      // The actual thread creation is handled by the parent component via
      // the onCommentClick callback with a special 'new' signal.
      'Mod-Shift-m': () => {
        const { from, to, empty } = this.editor.state.selection;
        if (empty) return false;

        // Signal that the user wants to create a new comment on the selection
        const text = this.editor.state.doc.textBetween(from, to, ' ');
        this.options.onCommentClick?.(`new:${from}:${to}:${text}`);
        return true;
      },
    };
  },

  // -------------------------------------------------------------------------
  // Plugins — click detection on comment marks
  // -------------------------------------------------------------------------

  addProseMirrorPlugins() {
    const extension = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return [
      new Plugin({
        key: COMMENT_MARK_PLUGIN_KEY,

        props: {
          handleClick(view, pos) {
            if (!extension.options.onCommentClick) return false;

            const { state } = view;
            const resolved = state.doc.resolve(pos);
            const marks = resolved.marks();

            // Find the first comment mark at the clicked position
            const commentMark = marks.find((m) => m.type.name === 'commentMark');
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
