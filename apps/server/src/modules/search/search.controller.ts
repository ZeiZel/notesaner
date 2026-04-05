// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — SearchService methods (fuzzySearch, getRecentSearches, clearRecentSearches) not yet implemented
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
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchRateLimit } from '../../common/decorators/throttle.decorator';
import { SearchService } from './search.service';
import { SemanticSearchService } from './semantic-search.service';
import { FuzzyQueryDto, SearchQueryDto, SemanticQueryDto, SuggestQueryDto } from './dto';

/**
 * Search REST API.
 *
 * All routes are workspace-scoped: /workspaces/:workspaceId/search/...
 */
@ApiTags('Search')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@SearchRateLimit()
@Controller('workspaces/:workspaceId/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly semanticSearchService: SemanticSearchService,
  ) {}

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  @ApiOperation({
    summary: 'Full-text search notes',
    description:
      'Full-text search with optional filters (tags, folder, dates, author, published status) and sorting. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated search results with relevance scores.' })
  @ApiForbiddenResponse({ description: 'Insufficient role.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async search(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.search(workspaceId, query, user.sub);
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('suggest')
  @ApiOperation({
    summary: 'Typeahead suggestions',
    description: 'Returns note title suggestions using pg_trgm similarity. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Array of title suggestions.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async suggest(@Param('workspaceId') workspaceId: string, @Query() query: SuggestQueryDto) {
    return this.searchService.suggest(workspaceId, query.prefix);
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('fuzzy')
  @ApiOperation({
    summary: 'Fuzzy search by note title',
    description:
      'Standalone fuzzy search using pg_trgm trigram similarity. Configurable threshold. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Fuzzy search results with similarity scores.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async fuzzy(@Param('workspaceId') workspaceId: string, @Query() query: FuzzyQueryDto) {
    return this.searchService.fuzzySearch(workspaceId, query.q, {
      threshold: query.threshold,
      limit: query.limit,
    });
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('recent')
  @ApiOperation({
    summary: 'Get recent search queries',
    description:
      'Returns the last 20 search queries performed by the authenticated user in this workspace.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Array of recent search strings.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getRecentSearches(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: string[] }> {
    const searches = await this.searchService.getRecentSearches(user.sub, workspaceId);
    return { data: searches };
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Delete('recent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Clear recent search history',
    description: "Clears the authenticated user's recent search history for this workspace.",
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Recent search history cleared.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async clearRecentSearches(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.searchService.clearRecentSearches(user.sub, workspaceId);
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('semantic')
  @ApiOperation({
    summary: 'Semantic search using embedding vectors',
    description:
      'Natural language search using OpenAI embedding vectors and pgvector cosine similarity. ' +
      'Automatically falls back to full-text search when embeddings are not configured. ' +
      'Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Ranked results with similarity scores. isFallback=true indicates FTS was used.',
  })
  @ApiForbiddenResponse({ description: 'Insufficient role.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async semanticSearch(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SemanticQueryDto,
  ) {
    return this.semanticSearchService.semanticSearch(workspaceId, {
      q: query.q,
      limit: query.limit,
    });
  }
}
