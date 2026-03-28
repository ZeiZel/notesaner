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
 * Usage in a TipTap editor:
 *   import { CommentMark } from '@/features/editor/lib/comment-mark';
 *   const editor = useEditor({ extensions: [CommentMark, ...] });
 *
 * Applying the mark:
 *   editor.chain().focus().setMark('comment', { threadId: 'abc-123' }).run();
 *
 * Removing the mark:
 *   editor.chain().focus().unsetMark('comment').run();
 *
 * Design decisions:
 *   - Mark-based (not Decoration-based) so it persists in the document model.
 *   - The threadId links to the comment store and backend Comment.id.
 *   - Inclusive: false — typing at mark boundaries does not extend the comment.
 *   - Rendered as <mark> for semantic meaning and accessibility.
 *   - CSS classes are applied for styling (no inline styles).
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkAttributes {
  /** The ID of the comment thread this mark belongs to. */
  threadId: string;
  /** Whether the thread is resolved (affects highlight color). */
  resolved: boolean;
}

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
    };
  }
}

export const CommentMark = Mark.create({
  name: 'comment',

  // Multiple comment marks can overlap (a range can have multiple threads).
  excludes: '',

  // Typing at the edge of a comment mark does not extend the mark.
  inclusive: false,

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
      mergeAttributes(HTMLAttributes, {
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
    };
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
