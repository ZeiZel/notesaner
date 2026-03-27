import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';

/**
 * Handles comment endpoints nested under a specific note:
 *   POST   /workspaces/:workspaceId/notes/:noteId/comments
 *   GET    /workspaces/:workspaceId/notes/:noteId/comments
 *
 * Plus top-level comment operations (no workspaceId needed once we have the commentId):
 *   PATCH  /comments/:id
 *   DELETE /comments/:id
 *   POST   /comments/:id/replies
 *   PATCH  /comments/:id/resolve
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // ---------------------------------------------------------------
  // Note-scoped endpoints
  // ---------------------------------------------------------------

  /**
   * POST /workspaces/:workspaceId/notes/:noteId/comments
   *
   * Create a new root comment on a note with an optional text position anchor.
   */
  @Post('workspaces/:workspaceId/notes/:noteId/comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.createComment(noteId, user.sub, body);
  }

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/comments
   *
   * Lists all comments for a note, sorted by position (top → bottom),
   * with replies nested inside each root comment.
   */
  @Get('workspaces/:workspaceId/notes/:noteId/comments')
  async listComments(@Param('noteId') noteId: string) {
    return this.commentsService.listComments(noteId);
  }

  // ---------------------------------------------------------------
  // Comment-scoped endpoints
  // ---------------------------------------------------------------

  /**
   * PATCH /comments/:id
   *
   * Edit the content of an existing comment.
   * Only the original author may edit.
   */
  @Patch('comments/:id')
  async updateComment(
    @Param('id') commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.updateComment(commentId, user.sub, body);
  }

  /**
   * DELETE /comments/:id
   *
   * Delete a comment (and its replies by cascade).
   * Only the author or an admin may delete.
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.commentsService.deleteComment(
      commentId,
      user.sub,
      user.isSuperAdmin,
    );
  }

  /**
   * POST /comments/:id/replies
   *
   * Add a reply to a root-level comment thread.
   */
  @Post('comments/:id/replies')
  @HttpCode(HttpStatus.CREATED)
  async createReply(
    @Param('id') parentCommentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.createReply(parentCommentId, user.sub, body);
  }

  /**
   * PATCH /comments/:id/resolve
   *
   * Toggle the resolved state of a root-level comment thread.
   * Resolves if open; reopens if already resolved.
   */
  @Patch('comments/:id/resolve')
  async resolveComment(
    @Param('id') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.resolveComment(commentId, user.sub);
  }
}
