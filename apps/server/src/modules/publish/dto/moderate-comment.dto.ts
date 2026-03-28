import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type CommentModerationAction = 'approve' | 'reject';

/**
 * DTO for moderating a reader comment -- approve or reject it.
 */
export class ModerateCommentDto {
  @ApiProperty({
    description: 'Moderation decision: approve makes the comment public, reject hides it',
    enum: ['approve', 'reject'],
    example: 'approve',
  })
  @IsEnum(['approve', 'reject'], {
    message: 'action must be "approve" or "reject"',
  })
  action!: CommentModerationAction;
}
