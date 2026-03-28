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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotesService } from '../notes/notes.service';
import { ApiKeyGuard, getApiKey, RequestWithApiKey } from './api-key.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyPermission } from './dto/create-api-key.dto';
import { ApiCreateNoteDto, ApiUpdateNoteDto } from './dto/api-note.dto';

/**
 * ApiV1NotesController -- public REST API for notes.
 *
 * All routes are versioned under /api/v1/notes.
 * Authentication is via X-API-Key header (enforced by ApiKeyGuard).
 * The workspace is derived from the API key.
 */
@ApiTags('API v1 - Notes')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/v1/notes')
export class ApiV1NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  // ---- List ----

  @Get()
  @ApiOperation({
    summary: 'List notes',
    description:
      "Returns a paginated list of notes for the API key's workspace. Requires notes:read permission.",
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results per page (1-100, default 20)',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Full-text search string' })
  @ApiQuery({ name: 'folder', required: false, description: 'Filter by folder prefix' })
  @ApiOkResponse({ description: 'Paginated list of notes.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks notes:read permission.' })
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

  // ---- Get one ----

  @Get(':noteId')
  @ApiOperation({
    summary: 'Get a note with content',
    description: 'Returns note metadata and markdown content. Requires notes:read permission.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Note metadata and content.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks notes:read permission.' })
  async findOne(@Req() req: RequestWithApiKey, @Param('noteId') noteId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_READ);

    return this.notesService.findByIdWithContent(apiKey.workspaceId, noteId);
  }

  // ---- Create ----

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a note',
    description: "Creates a new note in the API key's workspace. Requires notes:write permission.",
  })
  @ApiBody({ type: ApiCreateNoteDto })
  @ApiCreatedResponse({ description: 'Note created.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks notes:write permission.' })
  async create(@Req() req: RequestWithApiKey, @Body() dto: ApiCreateNoteDto) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_WRITE);

    return this.notesService.create(apiKey.workspaceId, apiKey.userId, {
      path: dto.path,
      title: dto.title,
      content: dto.content,
    });
  }

  // ---- Update ----

  @Put(':noteId')
  @ApiOperation({
    summary: 'Update a note',
    description:
      'Full or partial update of note content, title, and frontmatter. Requires notes:write permission.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiBody({ type: ApiUpdateNoteDto })
  @ApiOkResponse({ description: 'Note updated.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks notes:write permission.' })
  async update(
    @Req() req: RequestWithApiKey,
    @Param('noteId') noteId: string,
    @Body() dto: ApiUpdateNoteDto,
  ) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_WRITE);

    return this.notesService.update(apiKey.workspaceId, noteId, apiKey.userId, dto);
  }

  // ---- Delete ----

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete a note',
    description: 'Permanently deletes a note. Irreversible. Requires notes:delete permission.',
  })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note permanently deleted.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks notes:delete permission.' })
  async delete(@Req() req: RequestWithApiKey, @Param('noteId') noteId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.NOTES_DELETE);

    await this.notesService.permanentDelete(apiKey.workspaceId, noteId);
  }
}
