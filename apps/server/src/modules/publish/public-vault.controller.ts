import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CachePolicy } from '../../common/decorators/cache-policy.decorator';
import { PageCache } from '../../common/interceptors/page-cache.interceptor';
import { PublicVaultService } from './public-vault.service';
import { PublicVaultQueryDto } from './dto/public-vault-query.dto';

/**
 * PublicVaultController -- routes for publicly accessible vaults.
 *
 * All endpoints under /p/:slug are unauthenticated.
 * Responses are cached in ValKey via @PageCache() decorator (5-minute TTL).
 */
@ApiTags('Public Vault')
@Public()
@CachePolicy('public')
@Controller('p')
export class PublicVaultController {
  constructor(private readonly publicVaultService: PublicVaultService) {}

  @Get(':slug')
  @PageCache({ ttl: 300, prefix: 'page' })
  @ApiOperation({
    summary: 'Get public vault home',
    description:
      'Returns vault metadata: name, description, and published note count. No authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Vault metadata.' })
  @ApiNotFoundResponse({ description: 'Vault not found or not public.' })
  async getVaultHome(@Param('slug') slug: string) {
    return this.publicVaultService.getVaultIndex(slug);
  }

  @Get(':slug/notes')
  @PageCache({ ttl: 300, prefix: 'page', includeQuery: true })
  @ApiOperation({
    summary: 'List published notes in vault',
    description:
      'Paginated list of published notes with cursor-based pagination, sorting, and optional folder filtering.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Paginated list of published notes.' })
  @ApiNotFoundResponse({ description: 'Vault not found or not public.' })
  async getPublishedNotes(@Param('slug') slug: string, @Query() query: PublicVaultQueryDto) {
    return this.publicVaultService.getPublishedNotes(slug, query);
  }

  @Get(':slug/*')
  @PageCache({ ttl: 300, prefix: 'page' })
  @ApiOperation({
    summary: 'Get a published note by path',
    description:
      'Serves a single published note identified by its path. Notes with isPublished=false return 404.',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Published note content.' })
  @ApiNotFoundResponse({ description: 'Note not found or not published.' })
  async getPublishedNote(@Param('slug') slug: string, @Param() params: Record<string, string>) {
    const notePath = params['0'] ?? '';
    return this.publicVaultService.getPublishedNote(slug, notePath);
  }
}
