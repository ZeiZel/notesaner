import { z } from 'zod';

// -----------------------------------------------
// Position schema — text anchor for a comment
// -----------------------------------------------
export const CommentPositionSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  })
  .nullable()
  .optional();

export type CommentPosition = z.infer<typeof CommentPositionSchema>;

// -----------------------------------------------
// Create root comment
// -----------------------------------------------
export const CreateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10_000, 'Content is too long'),
  position: CommentPositionSchema,
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

// -----------------------------------------------
// Add a reply to an existing comment
// -----------------------------------------------
export const CreateReplySchema = z.object({
  content: z.string().min(1, 'Content is required').max(10_000, 'Content is too long'),
});

export type CreateReplyDto = z.infer<typeof CreateReplySchema>;

// -----------------------------------------------
// Edit comment content
// -----------------------------------------------
export const UpdateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10_000, 'Content is too long'),
});

export type UpdateCommentDto = z.infer<typeof UpdateCommentSchema>;
