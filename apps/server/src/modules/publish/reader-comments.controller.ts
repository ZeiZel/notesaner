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
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReaderCommentsService } from './reader-comments.service';
import { CreateReaderCommentDto } from './dto/create-reader-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { UseGuards } from '@nestjs/common';

// ─── Public comment endpoints (no auth required) ──────────────────────────────

/**
 * Public reader comment endpoints mounted under the public vault namespace.
 *
 *   POST  /public/:slug/notes/*path/comments    — submit a comment
 *   GET   /public/:slug/notes/*path/comments    — list approved comments
 *   GET   /public/:slug/notes/*path/comments/count — get comment count
 *
 * These routes are unauthenticated. Rate limiting and honeypot spam protection
 * are enforced inside ReaderCommentsService.
 */
@Public()
@Controller()
export class PublicReaderCommentsController {
  constructor(private readonly commentsService: ReaderCommentsService) {}

  /**
   * POST /public/:slug/notes/*path/comments
   *
   * Submit a new reader comment.  Returns the created comment with
   * status=pending.  The comment is not publicly visible until a workspace
   * owner/admin approves it.
   */
  @Post('public/:slug/notes/*/comments')
  @HttpCode(HttpStatus.CREATED)
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

  /**
   * GET /public/:slug/notes/*path/comments
   *
   * Returns approved comments for a published note, paginated and threaded.
   * Query params:
   *   - page     (default 1)
   *   - pageSize (default 20, max 100)
   */
  @Get('public/:slug/notes/*/comments')
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

  /**
   * GET /public/:slug/notes/*path/comments/count
   *
   * Returns the count of approved comments for the note.
   * Lightweight endpoint used by public note pages.
   */
  @Get('public/:slug/notes/*/comments/count')
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

// ─── Authenticated moderation endpoints ───────────────────────────────────────

/**
 * Moderation endpoints for workspace owners and admins.
 *
 *   GET    /workspaces/:workspaceId/notes/:noteId/reader-comments  — moderation queue
 *   PUT    /reader-comments/:commentId/moderate                     — approve / reject
 *   DELETE /reader-comments/:commentId                              — GDPR hard delete
 *
 * All routes require a valid JWT and at least ADMIN role.
 */
@UseGuards(RolesGuard)
@Controller()
export class ReaderCommentsModerationController {
  constructor(private readonly commentsService: ReaderCommentsService) {}

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/reader-comments
   *
   * Returns all pending reader comments for moderation.
   * Minimum role: ADMIN.
   */
  @Roles('ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/notes/:noteId/reader-comments')
  async getModerationQueue(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.commentsService.getModerationQueue(workspaceId, noteId);
  }

  /**
   * PUT /reader-comments/:commentId/moderate
   *
   * Approve or reject a pending comment.
   * Minimum role: ADMIN.
   */
  @Roles('ADMIN', 'OWNER')
  @Put('reader-comments/:commentId/moderate')
  @HttpCode(HttpStatus.OK)
  async moderateComment(
    @Param('commentId') commentId: string,
    @Body() dto: ModerateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Extract workspaceId from the comment's note to authorise
    // The service re-validates workspace ownership internally
    return this.commentsService.moderateCommentByUser(commentId, user.sub, dto.action);
  }

  /**
   * DELETE /reader-comments/:commentId
   *
   * Permanently deletes a comment (and its replies if root).
   * For GDPR compliance — data is irrecoverably removed from ValKey.
   * Minimum role: ADMIN.
   */
  @Roles('ADMIN', 'OWNER')
  @Delete('reader-comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.commentsService.deleteCommentByUser(commentId, user.sub);
  }
}
