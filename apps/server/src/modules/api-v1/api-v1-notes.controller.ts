import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotesService } from '../notes/notes.service';
import { ApiKeyGuard, getApiKey, RequestWithApiKey } from './api-key.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyPermission } from './dto/create-api-key.dto';
import { ApiCreateNoteDto, ApiUpdateNoteDto } from './dto/api-note.dto';

/**
 * ApiV1NotesController — public REST API for notes.
 *
 * All routes are versioned under /api/v1/notes.
 * Authentication is via X-API-Key header (enforced by ApiKeyGuard).
 * The workspace is derived from the API key — no workspaceId in URL.
 *
 * Rate limiting is applied at the module level via the throttler guard.
 */
@UseGuards(ApiKeyGuard)
@Controller('api/v1/notes')
export class ApiV1NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/notes
   *
   * Returns a paginated list of notes for the API key's workspace.
   *
   * Query params:
   *   - cursor: opaque pagination cursor
   *   - limit: max results per page (1-100, default 20)
   *   - search: full-text search string
   *   - folder: filter by folder prefix
   */
  @Get()
  async list(
    @Req() req: RequestWithApiKey,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('folder') folder?: string,
  ) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_READ);

    return this.notesService.list(apiKey.workspaceId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      folder,
    });
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/notes/:noteId
   *
   * Returns note metadata and markdown content.
   */
  @Get(':noteId')
  async findOne(@Req() req: RequestWithApiKey, @Param('noteId') noteId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_READ);

    return this.notesService.findByIdWithContent(apiKey.workspaceId, noteId);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/notes
   *
   * Creates a new note in the API key's workspace.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: RequestWithApiKey, @Body() dto: ApiCreateNoteDto) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_WRITE);

    return this.notesService.create(apiKey.workspaceId, apiKey.userId, {
      path: dto.path,
      title: dto.title,
      content: dto.content,
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * PUT /api/v1/notes/:noteId
   *
   * Full or partial update of note content, title, and frontmatter.
   */
  @Put(':noteId')
  async update(
    @Req() req: RequestWithApiKey,
    @Param('noteId') noteId: string,
    @Body() dto: ApiUpdateNoteDto,
  ) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_WRITE);

    return this.notesService.update(apiKey.workspaceId, noteId, apiKey.userId, dto);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  /**
   * DELETE /api/v1/notes/:noteId
   *
   * Permanently deletes a note. This action is irreversible.
   */
  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: RequestWithApiKey, @Param('noteId') noteId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_DELETE);

    await this.notesService.permanentDelete(apiKey.workspaceId, noteId);
  }
}
