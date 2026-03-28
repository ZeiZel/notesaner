import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class CreateNoteDto {
  @ApiProperty({
    description: 'Workspace-relative file path',
    example: 'journal/2024-01-15.md',
  })
  path!: string;

  @ApiProperty({ description: 'Note title', example: 'Daily Journal Entry' })
  title!: string;

  @ApiPropertyOptional({
    description: 'Initial markdown content',
    example: '# My Note\n\nSome content here.',
  })
  content?: string;
}

class UpdateNoteDto {
  @ApiPropertyOptional({ description: 'Updated title', example: 'Revised Title' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated markdown content',
    example: '# Updated Content\n\nNew text.',
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'YAML frontmatter key-value pairs',
    example: { tags: ['project', 'planning'], status: 'draft' },
  })
  frontmatter?: Record<string, unknown>;
}

class NoteListQueryDto {
  @ApiPropertyOptional({ description: 'Pagination cursor (note ID)', example: 'clx1abc...' })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum results per page (1-100)',
    example: 20,
    default: 20,
  })
  limit?: number;

  @ApiPropertyOptional({ description: 'Full-text search string', example: 'meeting notes' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Include trashed notes only',
    example: false,
    default: false,
  })
  isTrashed?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tag ID (UUID)', example: 'abc-123-def' })
  tagId?: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Notes')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: CreateNoteDto })
  @ApiCreatedResponse({ description: 'Note created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(workspaceId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notes in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated list of notes.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findAll(@Param('workspaceId') workspaceId: string, @Query() query: NoteListQueryDto) {
    return this.notesService.list(workspaceId, query);
  }

  @Get('graph')
  @ApiOperation({ summary: 'Get note graph data for visualization' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Graph nodes and edges for the workspace.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getGraph(@Param('workspaceId') workspaceId: string) {
    return this.notesService.getGraphData(workspaceId);
  }

  @Get(':noteId')
  @ApiOperation({ summary: 'Get a single note by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Note metadata and frontmatter.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findOne(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    return this.notesService.findById(workspaceId, noteId);
  }

  @Get(':noteId/content')
  @ApiOperation({ summary: 'Get the raw markdown content of a note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Raw markdown content with content hash.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getContent(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    return this.notesService.getContent(workspaceId, noteId);
  }

  @Patch(':noteId')
  @ApiOperation({ summary: 'Update a note (partial)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiBody({ type: UpdateNoteDto })
  @ApiOkResponse({ description: 'Note updated successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(workspaceId, noteId, user.sub, dto);
  }

  @Post(':noteId/trash')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Move a note to trash' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note trashed successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async trash(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.notesService.trash(workspaceId, noteId);
  }

  @Post(':noteId/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a trashed note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note restored successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async restore(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.notesService.restore(workspaceId, noteId);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note permanently deleted.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async remove(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.notesService.permanentDelete(workspaceId, noteId);
  }

  @Get(':noteId/backlinks')
  @ApiOperation({ summary: 'Get all backlinks pointing to this note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of notes that link to this note.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getBacklinks(@Param('workspaceId') _workspaceId: string, @Param('noteId') noteId: string) {
    return this.notesService.getBacklinks(noteId);
  }

  @Get(':noteId/versions')
  @ApiOperation({ summary: 'List version history for a note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Version history entries.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getVersions(@Param('workspaceId') _workspaceId: string, @Param('noteId') noteId: string) {
    return this.notesService.listVersions(noteId);
  }
}
