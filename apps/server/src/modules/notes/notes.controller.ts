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
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';

class CreateNoteDto {
  path!: string;
  title!: string;
  content?: string;
}

class UpdateNoteDto {
  title?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
}

class NoteListQueryDto {
  cursor?: string;
  limit?: number;
  search?: string;
  isTrashed?: boolean;
  tagId?: string;
}

@Controller('workspaces/:workspaceId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(workspaceId, user.sub, dto);
  }

  @Get()
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: NoteListQueryDto,
  ) {
    return this.notesService.list(workspaceId, query);
  }

  @Get('graph')
  async getGraph(@Param('workspaceId') workspaceId: string) {
    return this.notesService.getGraphData(workspaceId);
  }

  @Get(':noteId')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.findById(workspaceId, noteId);
  }

  @Get(':noteId/content')
  async getContent(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.getContent(workspaceId, noteId);
  }

  @Patch(':noteId')
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
  async trash(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.notesService.trash(workspaceId, noteId);
  }

  @Post(':noteId/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.notesService.restore(workspaceId, noteId);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.notesService.permanentDelete(workspaceId, noteId);
  }

  @Get(':noteId/backlinks')
  async getBacklinks(
    @Param('workspaceId') _workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.getBacklinks(noteId);
  }

  @Get(':noteId/versions')
  async getVersions(
    @Param('workspaceId') _workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.listVersions(noteId);
  }
}
