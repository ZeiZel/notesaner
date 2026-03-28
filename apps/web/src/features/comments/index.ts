/**
 * features/comments -- public API barrel export.
 *
 * This is the only import path that pages/widgets should use for comment
 * components. Internal implementation details are encapsulated.
 *
 * FSD rule: only import from this index.ts in higher layers.
 */

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

export { CommentPopover } from './ui/CommentPopover';
export type { CommentPopoverProps } from './ui/CommentPopover';

export { CommentPanel } from './ui/CommentPanel';
export type { CommentPanelProps } from './ui/CommentPanel';

export { CommentLayer } from './ui/CommentLayer';
export type { CommentLayerProps } from './ui/CommentLayer';

export { CommentModeToggle } from './ui/CommentModeToggle';
export type { CommentModeToggleProps } from './ui/CommentModeToggle';

export { CommentBadge } from './ui/CommentBadge';
export type { CommentBadgeProps } from './ui/CommentBadge';

export { MentionInput } from './ui/MentionInput';
export type { MentionInputProps } from './ui/MentionInput';

// ---------------------------------------------------------------------------
// API (queries and mutations)
// ---------------------------------------------------------------------------

export {
  commentKeys,
  useNoteComments,
  useCreateComment,
  useReplyToComment,
  useUpdateComment,
  useDeleteComment,
  useResolveComment,
} from './api/comments.queries';

export { commentsApi } from './api/comments';
export type {
  CommentDto,
  CommentPositionDto,
  CommentUserDto,
  CreateCommentPayload,
  CreateReplyPayload,
  UpdateCommentPayload,
} from './api/comments';
