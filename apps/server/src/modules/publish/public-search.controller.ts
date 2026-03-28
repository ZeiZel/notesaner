import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicSearchService } from './public-search.service';
import { PublicSearchQueryDto } from './dto';

@Controller()
export class PublicSearchController {
  constructor(private readonly publicSearchService: PublicSearchService) {}

  /**
   * GET /public/:publicSlug/search?q=&page=&limit=
   *
   * Full-text search over published notes in a public vault.
   * No authentication required.
   *
   * Query parameters:
   *   q      — required, min 2 chars, max 500 chars
   *   limit  — optional, default 10, max 50
   *   page   — optional, default 0 (zero-based)
   *
   * Returns:
   *   { data: PublicSearchResult[], pagination: { total, limit, page, hasMore } }
   *
   * Only notes with isPublished=true and isTrashed=false are ever returned.
   * Results are cached in ValKey for 5 minutes.
   */
  @Public()
  @Get('public/:publicSlug/search')
  async searchPublicVault(
    @Param('publicSlug') publicSlug: string,
    @Query() query: PublicSearchQueryDto,
  ) {
    return this.publicSearchService.searchPublishedNotes(publicSlug, query);
  }
}
