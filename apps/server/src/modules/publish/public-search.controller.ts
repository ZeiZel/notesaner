import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicSearchService } from './public-search.service';
import { PublicSearchQueryDto } from './dto';

@ApiTags('Public Vault')
@Controller()
export class PublicSearchController {
  constructor(private readonly publicSearchService: PublicSearchService) {}

  @Public()
  @Get('public/:publicSlug/search')
  @ApiOperation({
    summary: 'Search published notes in a public vault',
    description:
      'Full-text search over published notes. No authentication required. ' +
      'Results are cached in ValKey for 5 minutes. Only published, non-trashed notes are returned.',
  })
  @ApiParam({ name: 'publicSlug', description: 'Public vault slug', type: String })
  @ApiOkResponse({
    description: 'Paginated search results with total, limit, page, and hasMore.',
  })
  @ApiNotFoundResponse({ description: 'Public vault not found.' })
  async searchPublicVault(
    @Param('publicSlug') publicSlug: string,
    @Query() query: PublicSearchQueryDto,
  ) {
    return this.publicSearchService.searchPublishedNotes(publicSlug, query);
  }
}
