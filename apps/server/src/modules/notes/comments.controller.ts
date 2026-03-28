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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';

/**
 * Handles comment endpoints nested under a specific note and top-level
 * comment operations.
 */
@ApiTags('Comments')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // ---------------------------------------------------------------
  // Note-scoped endpoints
  // ---------------------------------------------------------------

  @Post('workspaces/:workspaceId/notes/:noteId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new comment on a note',
    description: 'Creates a root-level comment with an optional text position anchor.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Comment created successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async createComment(
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.createComment(noteId, user.sub, body);
  }

  @Get('workspaces/:workspaceId/notes/:noteId/comments')
  @ApiOperation({
    summary: 'List all comments for a note',
    description: 'Returns comments sorted by position with nested replies.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of comments with nested replies.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listComments(@Param('noteId') noteId: string) {
    return this.commentsService.listComments(noteId);
  }

  // ---------------------------------------------------------------
  // Comment-scoped endpoints
  // ---------------------------------------------------------------

  @Patch('comments/:id')
  @ApiOperation({
    summary: 'Edit an existing comment',
    description: 'Only the original author may edit.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Comment updated successfully.' })
  @ApiNotFoundResponse({ description: 'Comment not found.' })
  @ApiForbiddenResponse({ description: 'Not the comment author.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateComment(
    @Param('id') commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.updateComment(commentId, user.sub, body);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a comment',
    description: 'Deletes a comment and its replies. Only the author or an admin may delete.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Comment deleted.' })
  @ApiNotFoundResponse({ description: 'Comment not found.' })
  @ApiForbiddenResponse({ description: 'Not authorized to delete.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async deleteComment(@Param('id') commentId: string, @CurrentUser() user: JwtPayload) {
    await this.commentsService.deleteComment(commentId, user.sub, user.isSuperAdmin);
  }

  @Post('comments/:id/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reply to a comment' })
  @ApiParam({ name: 'id', description: 'Parent comment ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Reply created successfully.' })
  @ApiNotFoundResponse({ description: 'Parent comment not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async createReply(
    @Param('id') parentCommentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.commentsService.createReply(parentCommentId, user.sub, body);
  }

  @Patch('comments/:id/resolve')
  @ApiOperation({
    summary: 'Toggle comment resolved state',
    description: 'Resolves an open comment thread or reopens a resolved one.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Comment resolve state toggled.' })
  @ApiNotFoundResponse({ description: 'Comment not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async resolveComment(@Param('id') commentId: string, @CurrentUser() user: JwtPayload) {
    return this.commentsService.resolveComment(commentId, user.sub);
  }
}
