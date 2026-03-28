import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActivityService } from './activity.service';
import { GetActivityDto } from './dto';

/**
 * ActivityController - REST endpoints for the workspace activity feed.
 *
 * Provides:
 *   - GET /workspaces/:id/activity — paginated workspace activity feed
 *   - GET /notes/:id/activity — per-note activity history
 *   - POST /notes/:id/follow — follow a note
 *   - DELETE /notes/:id/follow — unfollow a note
 *   - GET /notes/:id/follow — check if following a note
 */
@ApiTags('Activity')
@ApiBearerAuth('bearer')
@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  // ---- Workspace Activity Feed ----

  @Get('workspaces/:workspaceId/activity')
  @UseGuards(RolesGuard)
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @ApiOperation({
    summary: 'Get workspace activity feed',
    description:
      'Returns a paginated list of activity for the workspace. Supports filtering by type, user, and date range.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated activity list.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getWorkspaceActivity(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: GetActivityDto,
  ) {
    return this.activityService.findAllForWorkspace(workspaceId, {
      page: query.page,
      limit: query.limit,
      type: query.type,
      userId: query.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  // ---- Per-Note Activity ----

  @Get('notes/:noteId/activity')
  @ApiOperation({
    summary: 'Get activity history for a note',
    description: 'Returns a paginated list of activity for a specific note.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated note activity list.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getNoteActivity(
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Query() query: GetActivityDto,
  ) {
    return this.activityService.findAllForNote(noteId, {
      page: query.page,
      limit: query.limit,
    });
  }

  // ---- Note Follow ----

  @Post('notes/:noteId/follow')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Follow a note',
    description: 'Subscribe to activity notifications for a note.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Now following the note.' })
  @ApiConflictResponse({ description: 'Already following this note.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async followNote(
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.activityService.followNote(noteId, user.sub);
  }

  @Delete('notes/:noteId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unfollow a note',
    description: 'Unsubscribe from activity notifications for a note.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Unfollowed the note.' })
  @ApiNotFoundResponse({ description: 'Not following this note.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async unfollowNote(
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.activityService.unfollowNote(noteId, user.sub);
  }

  @Get('notes/:noteId/follow')
  @ApiOperation({
    summary: 'Check if following a note',
    description: 'Returns whether the current user follows the specified note.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Follow status.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async isFollowing(
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const following = await this.activityService.isFollowing(noteId, user.sub);
    return { following };
  }
}
