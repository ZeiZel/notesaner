import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicVaultService } from './public-vault.service';
import { PublicVaultQueryDto } from './dto/public-vault-query.dto';

/**
 * PublicVaultController — routes for publicly accessible vaults.
 *
 * All endpoints under /p/:slug are unauthenticated. Authentication is not
 * required because public vaults are intended for anonymous readers.
 * Individual notes are only accessible when the note has isPublished=true
 * and the workspace has isPublic=true.
 *
 * Route structure:
 *   GET /p/:slug                — vault home (metadata)
 *   GET /p/:slug/notes          — paginated list of published notes
 *   GET /p/:slug/notes/*path    — single published note (rendered as HTML)
 */
@Public()
@Controller('p')
export class PublicVaultController {
  constructor(private readonly publicVaultService: PublicVaultService) {}

  /**
   * GET /p/:slug
   *
   * Return vault metadata: name, description, and published note count.
   * This is the vault "home" page endpoint.
   */
  @Get(':slug')
  async getVaultHome(@Param('slug') slug: string) {
    return this.publicVaultService.getVaultIndex(slug);
  }

  /**
   * GET /p/:slug/notes
   *
   * Return a paginated list of published notes in the vault.
   * Supports cursor-based pagination, sorting, and optional folder filtering.
   */
  @Get(':slug/notes')
  async getPublishedNotes(@Param('slug') slug: string, @Query() query: PublicVaultQueryDto) {
    return this.publicVaultService.getPublishedNotes(slug, query);
  }

  /**
   * GET /p/:slug/*
   *
   * Serve a single published note identified by its path within the vault.
   * The wildcard captures the full note path including any subdirectory
   * segments (e.g. /p/my-vault/projects/note-name).
   *
   * Notes with isPublished=false are not accessible and return 404.
   */
  @Get(':slug/*')
  async getPublishedNote(@Param('slug') slug: string, @Param() params: Record<string, string>) {
    const notePath = params['0'] ?? '';
    return this.publicVaultService.getPublishedNote(slug, notePath);
  }
}
