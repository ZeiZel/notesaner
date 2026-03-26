import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';

class SearchQueryDto {
  q!: string;
  cursor?: string;
  limit?: number;
}

class SuggestQueryDto {
  prefix!: string;
}

@Controller('workspaces/:workspaceId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(workspaceId, query);
  }

  @Get('suggest')
  async suggest(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SuggestQueryDto,
  ) {
    return this.searchService.suggest(workspaceId, query.prefix);
  }
}
