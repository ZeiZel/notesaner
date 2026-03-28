import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { FreshnessService } from './freshness.service';
import { FreshnessConfigDto } from './dto/freshness-config.dto';
import { FreshnessQueueQueryDto } from './dto/freshness-query.dto';

/**
 * Freshness REST API.
 *
 * Routes are workspace-scoped:
 *
 *   GET  /workspaces/:workspaceId/freshness/queue           — admin needs-review queue
 *   GET  /workspaces/:workspaceId/freshness/config          — get freshness config
 *   PUT  /workspaces/:workspaceId/freshness/config          — update freshness config
 *   GET  /workspaces/:workspaceId/notes/:noteId/freshness   — single note freshness status
 *   POST /workspaces/:workspaceId/notes/:noteId/review      — mark note as reviewed
 */
@UseGuards(RolesGuard)
@Controller()
export class FreshnessController {
  constructor(private readonly freshnessService: FreshnessService) {}

  // ─── Queue endpoint ─────────────────────────────────────────────────────────

  /**
   * GET /workspaces/:workspaceId/freshness/queue
   *
   * Returns the paginated needs-review queue for a workspace.
   * Sorted by ageInDays descending — most stale documents first.
   *
   * Minimum role: ADMIN
   */
  @Roles('ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/freshness/queue')
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

  // ─── Config endpoints ────────────────────────────────────────────────────────

  /**
   * GET /workspaces/:workspaceId/freshness/config
   *
   * Returns the current freshness threshold configuration for the workspace.
   *
   * Minimum role: VIEWER
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/freshness/config')
  async getConfig(@Param('workspaceId') workspaceId: string) {
    return this.freshnessService.resolveThresholds(workspaceId);
  }

  /**
   * PUT /workspaces/:workspaceId/freshness/config
   *
   * Updates the freshness threshold configuration for the workspace.
   * Both `freshnessThreshold` (aging) and `warningThreshold` (stale) may be provided.
   * `warningThreshold` must be greater than `freshnessThreshold`.
   *
   * Minimum role: ADMIN
   */
  @Roles('ADMIN', 'OWNER')
  @Put('workspaces/:workspaceId/freshness/config')
  async updateConfig(@Param('workspaceId') workspaceId: string, @Body() dto: FreshnessConfigDto) {
    const { agingThresholdDays, staleThresholdDays } =
      await this.freshnessService.resolveThresholds(workspaceId);

    const newAging = dto.freshnessThreshold ?? agingThresholdDays;
    const newStale = dto.warningThreshold ?? staleThresholdDays;

    return this.freshnessService.updateWorkspaceThresholds(workspaceId, newAging, newStale);
  }

  // ─── Single-note freshness ───────────────────────────────────────────────────

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/freshness
   *
   * Returns the freshness status for a single note.
   * Includes ageInDays, status (fresh/aging/stale), anchorDate, and thresholds.
   *
   * Minimum role: VIEWER
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('workspaces/:workspaceId/notes/:noteId/freshness')
  async getNoteFreshness(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.freshnessService.calculateFreshness(workspaceId, noteId);
  }

  // ─── Mark as reviewed ────────────────────────────────────────────────────────

  /**
   * POST /workspaces/:workspaceId/notes/:noteId/review
   *
   * Marks a note as reviewed, resetting its freshness clock.
   * Stores lastVerifiedAt in the note's frontmatter.
   * Creates a version history audit entry.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('workspaces/:workspaceId/notes/:noteId/review')
  @HttpCode(HttpStatus.OK)
  async markAsReviewed(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.freshnessService.markAsReviewed(workspaceId, noteId, user.sub);
  }
}
