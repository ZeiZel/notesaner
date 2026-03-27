import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchService } from './search.service';
import { FuzzyQueryDto, SearchQueryDto, SuggestQueryDto } from './dto';

/**
 * Search REST API.
 *
 * All routes are workspace-scoped: /workspaces/:workspaceId/search/...
 *
 * Minimum role required for all endpoints: VIEWER.
 */
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /workspaces/:workspaceId/search
   *
   * Full-text search with optional filters and sorting.
   *
   * Query params:
   *   q          — search query (required, min 2 chars)
   *   tagIds     — array of tag UUIDs (repeat param for multiple)
   *   tagMode    — AND | OR (default OR)
   *   folder     — folder path prefix filter
   *   createdAfter / createdBefore — ISO 8601 date range on createdAt
   *   updatedAfter / updatedBefore — ISO 8601 date range on updatedAt
   *   authorId   — UUID of the note creator
   *   isPublished — boolean filter
   *   isTrashed  — boolean filter (default false)
   *   sortBy     — relevance | createdAt | updatedAt | title (default relevance)
   *   sortOrder  — asc | desc (default desc)
   *   limit      — max results per page (1–100, default 20)
   *   cursor     — opaque pagination cursor
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  async search(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.search(workspaceId, query, user.sub);
  }

  /**
   * GET /workspaces/:workspaceId/search/suggest
   *
   * Typeahead suggestions from note titles using pg_trgm similarity.
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('suggest')
  async suggest(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SuggestQueryDto,
  ) {
    return this.searchService.suggest(workspaceId, query.prefix);
  }

  /**
   * GET /workspaces/:workspaceId/search/fuzzy
   *
   * Standalone fuzzy search using pg_trgm trigram similarity on note titles.
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('fuzzy')
  async fuzzy(
    @Param('workspaceId') workspaceId: string,
    @Query() query: FuzzyQueryDto,
  ) {
    return this.searchService.fuzzySearch(workspaceId, query.q, {
      threshold: query.threshold,
      limit: query.limit,
    });
  }

  /**
   * GET /workspaces/:workspaceId/search/recent
   *
   * Returns the last 20 search queries performed by the authenticated user
   * in this workspace, in most-recent-first order.
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('recent')
  async getRecentSearches(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: string[] }> {
    const searches = await this.searchService.getRecentSearches(user.sub, workspaceId);
    return { data: searches };
  }

  /**
   * DELETE /workspaces/:workspaceId/search/recent
   *
   * Clears the authenticated user's recent search history for this workspace.
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Delete('recent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearRecentSearches(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.searchService.clearRecentSearches(user.sub, workspaceId);
  }
}
