import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReaderCommentsService } from './reader-comments.service';
import { CreateReaderCommentDto } from './dto/create-reader-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { UseGuards } from '@nestjs/common';

// ---- Public comment endpoints (no auth required) ----

@ApiTags('Public Vault - Reader Comments')
@Public()
@Controller()
export class PublicReaderCommentsController {
  constructor(private readonly commentsService: ReaderCommentsService) {}

  @Post('public/:slug/notes/*/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a reader comment',
    description:
      'Submit a new reader comment on a published note. Comments start as pending and require moderation. ' +
      'No authentication required. Anti-spam honeypot field must be empty.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiBody({ type: CreateReaderCommentDto })
  @ApiCreatedResponse({ description: 'Comment created with status=pending.' })
  @ApiNotFoundResponse({ description: 'Note or vault not found.' })
  async createComment(
    @Param('slug') slug: string,
    @Param() params: Record<string, string>,
    @Body() dto: CreateReaderCommentDto,
    @Req() req: Request,
  ) {
    const notePath = params['0'] ?? '';
    const clientIp = this.extractClientIp(req);
    return this.commentsService.createComment(slug, notePath, dto, clientIp);
  }

  @Get('public/:slug/notes/*/comments')
  @ApiOperation({
    summary: 'List approved comments for a published note',
    description: 'Returns approved comments, paginated and threaded. No authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Results per page (default 20, max 100)',
  })
  @ApiOkResponse({ description: 'Paginated list of approved comments.' })
  async listComments(
    @Param('slug') slug: string,
    @Param() params: Record<string, string>,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const notePath = params['0'] ?? '';
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr ?? '20', 10) || 20));
    return this.commentsService.listApprovedComments(slug, notePath, page, pageSize);
  }

  @Get('public/:slug/notes/*/comments/count')
  @ApiOperation({
    summary: 'Get comment count for a published note',
    description: 'Returns the count of approved comments. Lightweight endpoint for public pages.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Comment count.' })
  async getCommentCount(@Param('slug') slug: string, @Param() params: Record<string, string>) {
    const notePath = params['0'] ?? '';
    return this.commentsService.getCommentCount(slug, notePath);
  }

  private extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? 'unknown';
  }
}

// ---- Authenticated moderation endpoints ----

@ApiTags('Publish - Comment Moderation')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller()
export class ReaderCommentsModerationController {
  constructor(private readonly commentsService: ReaderCommentsService) {}

  @Roles('ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/notes/:noteId/reader-comments')
  @ApiOperation({
    summary: 'Get reader comment moderation queue',
    description: 'Returns all pending reader comments for moderation. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of pending comments.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getModerationQueue(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.commentsService.getModerationQueue(workspaceId, noteId);
  }

  @Roles('ADMIN', 'OWNER')
  @Put('reader-comments/:commentId/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or reject a reader comment',
    description: 'Moderates a pending comment. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'commentId', description: 'Comment ID (UUID)', type: String })
  @ApiBody({ type: ModerateCommentDto })
  @ApiOkResponse({ description: 'Comment moderated.' })
  @ApiNotFoundResponse({ description: 'Comment not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async moderateComment(
    @Param('commentId') commentId: string,
    @Body() dto: ModerateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.moderateCommentByUser(commentId, user.sub, dto.action);
  }

  @Roles('ADMIN', 'OWNER')
  @Delete('reader-comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete a reader comment (GDPR)',
    description:
      'Irrecoverably removes a comment and its replies from ValKey. For GDPR compliance. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'commentId', description: 'Comment ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Comment permanently deleted.' })
  @ApiNotFoundResponse({ description: 'Comment not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.commentsService.deleteCommentByUser(commentId, user.sub);
  }
}
