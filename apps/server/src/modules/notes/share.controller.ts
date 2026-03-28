import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShareService } from './share.service';

// ── Authenticated Share Management ─────────────────────────────────────────

/**
 * ShareController — authenticated endpoints for managing note shares.
 *
 * Routes:
 *   POST   /workspaces/:workspaceId/notes/:noteId/shares   — Create a share
 *   GET    /workspaces/:workspaceId/notes/:noteId/shares   — List shares
 *   DELETE /workspaces/:workspaceId/notes/:noteId/shares/:shareId — Revoke a share
 */
@ApiTags('Note Sharing')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/notes/:noteId/shares')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Share a note with a user or create a share link',
    description:
      'Creates a share by email (type: "email") or a public link (type: "link"). ' +
      'Link shares support optional password protection and expiration.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Share created successfully.' })
  @ApiNotFoundResponse({ description: 'Note or user not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions to share.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async createShare(
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.shareService.createShare(noteId, user.sub, body);
  }

  @Get()
  @ApiOperation({
    summary: 'List all shares for a note',
    description: 'Returns all active shares (both email and link-based) for the given note.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of shares.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listShares(@Param('noteId') noteId: string) {
    return this.shareService.listShares(noteId);
  }

  @Delete(':shareId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a specific share',
    description: 'Removes the share. Only the share creator or a workspace admin can revoke.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiParam({ name: 'shareId', description: 'Share ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Share revoked successfully.' })
  @ApiNotFoundResponse({ description: 'Share not found.' })
  @ApiForbiddenResponse({ description: 'Not authorized to revoke.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async deleteShare(
    @Param('noteId') noteId: string,
    @Param('shareId') shareId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.shareService.deleteShare(noteId, shareId, user.sub);
  }
}

// ── Public Share Access (no auth required) ─────────────────────────────────

/**
 * PublicShareController — unauthenticated endpoints for accessing shared notes.
 *
 * Routes:
 *   GET  /share/:token          — Get share metadata (title, permissions, password-required)
 *   POST /share/:token/verify   — Verify password and gain access
 *   POST /share/:token/access   — Access a non-password-protected share
 */
@ApiTags('Public Sharing')
@Controller('share')
export class PublicShareController {
  constructor(private readonly shareService: ShareService) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: 'Get public share metadata',
    description:
      'Returns share info including whether a password is required. Does not grant access.',
  })
  @ApiParam({ name: 'token', description: 'Share token', type: String })
  @ApiOkResponse({ description: 'Share metadata.' })
  @ApiNotFoundResponse({ description: 'Share not found or revoked.' })
  async getShareInfo(@Param('token') token: string) {
    return this.shareService.getShareByToken(token);
  }

  @Public()
  @Post(':token/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify share link password',
    description: 'Verifies the password for a protected share link and records access.',
  })
  @ApiParam({ name: 'token', description: 'Share token', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { password: { type: 'string' } },
      required: ['password'],
    },
  })
  @ApiOkResponse({ description: 'Password verified, access granted.' })
  @ApiUnauthorizedResponse({ description: 'Incorrect password.' })
  @ApiNotFoundResponse({ description: 'Share not found or revoked.' })
  async verifyPassword(@Param('token') token: string, @Body() body: { password: string }) {
    return this.shareService.verifySharePassword(token, body.password);
  }

  @Public()
  @Post(':token/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access a share link (no password)',
    description: 'Grants access to a non-password-protected share and records the access.',
  })
  @ApiParam({ name: 'token', description: 'Share token', type: String })
  @ApiOkResponse({ description: 'Access granted.' })
  @ApiNotFoundResponse({ description: 'Share not found or revoked.' })
  async accessShare(@Param('token') token: string) {
    return this.shareService.accessShareLink(token);
  }
}
