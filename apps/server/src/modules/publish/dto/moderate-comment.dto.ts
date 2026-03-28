import { IsEnum } from 'class-validator';

export type CommentModerationAction = 'approve' | 'reject';

/**
 * DTO for moderating a reader comment — approve or reject it.
 * Sent by the note owner (authenticated) to the moderation endpoint.
 */
export class ModerateCommentDto {
  /**
   * Moderation decision.
   *   - `approve`  — comment becomes publicly visible
   *   - `reject`   — comment is soft-deleted (stored internally, not shown)
   */
  @IsEnum(['approve', 'reject'], {
    message: 'action must be "approve" or "reject"',
  })
  action!: CommentModerationAction;
}
