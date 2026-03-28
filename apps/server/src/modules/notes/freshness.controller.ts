import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { FreshnessService } from './freshness.service';
import { FreshnessConfigDto } from './dto/freshness-config.dto';
import { FreshnessQueueQueryDto } from './dto/freshness-query.dto';
import { StaleNotesQueryDto } from './dto/stale-notes-query.dto';

/**
 * Freshness REST API.
 *
 * Routes are workspace-scoped for managing document freshness/staleness.
 */
@ApiTags('Freshness')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller()
export class FreshnessController {
  constructor(private readonly freshnessService: FreshnessService) {}

  // ---- Queue endpoint ----

  @Roles('ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/freshness/queue')
  @ApiOperation({
    summary: 'Get the needs-review queue',
    description:
      'Returns a paginated list of notes sorted by staleness (most stale first). Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated needs-review queue.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getQueue(
    @Param('workspaceId') workspaceId: string,
    @Query() query: FreshnessQueueQueryDto,
  ) {
    return this.freshnessService.getNeedsReviewQueue(workspaceId, {
      cursor: query.cursor,
      limit: query.limit,
      status: query.status,
      ownerId: query.ownerId,
      folder: query.folder,
    });
  }

  // ---- Config endpoints ----

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/freshness/config')
  @ApiOperation({
    summary: 'Get freshness configuration',
    description:
      'Returns the freshness threshold configuration for the workspace. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Freshness thresholds (agingThresholdDays, staleThresholdDays).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getConfig(@Param('workspaceId') workspaceId: string) {
    return this.freshnessService.resolveThresholds(workspaceId);
  }

  @Roles('ADMIN', 'OWNER')
  @Put('workspaces/:workspaceId/freshness/config')
  @ApiOperation({
    summary: 'Update freshness configuration',
    description:
      'Sets the aging and stale thresholds in days. warningThreshold must be > freshnessThreshold. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: FreshnessConfigDto })
  @ApiOkResponse({ description: 'Updated freshness configuration.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateConfig(@Param('workspaceId') workspaceId: string, @Body() dto: FreshnessConfigDto) {
    const { agingThresholdDays, staleThresholdDays } =
      await this.freshnessService.resolveThresholds(workspaceId);

    const newAging = dto.freshnessThreshold ?? agingThresholdDays;
    const newStale = dto.warningThreshold ?? staleThresholdDays;

    return this.freshnessService.updateWorkspaceThresholds(workspaceId, newAging, newStale);
  }

  // ---- Single-note freshness ----

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/notes/:noteId/freshness')
  @ApiOperation({
    summary: 'Get freshness status for a single note',
    description:
      'Returns ageInDays, status (fresh/aging/stale), anchorDate, and thresholds. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Note freshness status.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getNoteFreshness(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.freshnessService.calculateFreshness(workspaceId, noteId);
  }

  // ---- Mark as reviewed ----

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('workspaces/:workspaceId/notes/:noteId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a note as reviewed',
    description:
      'Resets the freshness clock by setting lastVerifiedAt in frontmatter. Creates a version history entry. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Note marked as reviewed.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async markAsReviewed(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.freshnessService.markAsReviewed(workspaceId, noteId, user.sub);
  }

  // ---- PATCH verify (alias for mark as reviewed) ----

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Patch('workspaces/:workspaceId/notes/:noteId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a note (alias for mark as reviewed)',
    description: 'Resets the freshness clock. Alias for POST .../review. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Note verified.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async verifyNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.freshnessService.markAsReviewed(workspaceId, noteId, user.sub);
  }

  // ---- Stale notes listing ----

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/stale-notes')
  @ApiOperation({
    summary: 'List stale notes',
    description:
      'Returns notes that have passed the stale threshold. Supports filtering by status, folder prefix, and owner. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of stale notes.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getStaleNotes(
    @Param('workspaceId') workspaceId: string,
    @Query() query: StaleNotesQueryDto,
  ) {
    return this.freshnessService.getStaleNotes(workspaceId, query.status ?? 'stale', query.folder);
  }
}
