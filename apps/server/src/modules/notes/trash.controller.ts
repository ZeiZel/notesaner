import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { TrashService } from './trash.service';
import type { TrashListResult } from './trash.service';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class TrashListQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination cursor (note ID from previous page)',
    example: 'clx1abc...',
  })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum results per page (1–100)',
    example: 20,
    default: 20,
  })
  limit?: number;
}

class TrashListItemDto {
  @ApiProperty({ description: 'Note ID (UUID)' })
  id!: string;

  @ApiProperty({ description: 'Workspace ID (UUID)' })
  workspaceId!: string;

  @ApiProperty({ description: 'Workspace-relative file path (within .trash/)' })
  path!: string;

  @ApiProperty({ description: 'Note title' })
  title!: string;

  @ApiProperty({ description: 'Timestamp when the note was trashed' })
  trashedAt!: Date;

  @ApiProperty({ description: 'Approximate word count' })
  wordCount!: number;
}

class TrashListResponseDto {
  @ApiProperty({ type: [TrashListItemDto] })
  items!: TrashListItemDto[];

  @ApiProperty({
    description: 'Cursor for the next page (null when on last page)',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more results exist' })
  hasMore!: boolean;

  @ApiProperty({ description: 'Total trashed notes in the workspace' })
  total!: number;
}

class EmptyTrashResponseDto {
  @ApiProperty({ description: 'Number of notes permanently deleted' })
  deleted!: number;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * Trash management endpoints.
 *
 * Routes:
 *   GET    /workspaces/:wid/trash                 — list trashed notes
 *   POST   /workspaces/:wid/trash/empty           — permanently delete all trashed notes
 *   POST   /workspaces/:wid/notes/:id/trash       — soft-delete (move to trash)
 *   POST   /workspaces/:wid/notes/:id/restore     — restore from trash
 *   DELETE /workspaces/:wid/notes/:id/permanent   — permanent delete
 *
 * Note: The /notes/:id/trash and /notes/:id/restore routes are also declared in
 * NotesController (as stubs). This controller provides the full implementations.
 * Both controllers live under the same module so NestJS will register both.
 */
@ApiTags('Trash')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  // ─── List trash ────────────────────────────────────────────────────────────

  @Get('trash')
  @ApiOperation({ summary: 'List trashed notes in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated list of trashed notes.', type: TrashListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listTrash(
    @Param('workspaceId') workspaceId: string,
    @Query() query: TrashListQueryDto,
  ): Promise<TrashListResult> {
    const limit = query.limit ? Number(query.limit) : 20;
    return this.trashService.listTrash(workspaceId, query.cursor, limit);
  }

  // ─── Empty trash ───────────────────────────────────────────────────────────

  @Post('trash/empty')
  @ApiOperation({ summary: 'Permanently delete all trashed notes in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Trash emptied. Returns count of deleted notes.',
    type: EmptyTrashResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async emptyTrash(@Param('workspaceId') workspaceId: string): Promise<EmptyTrashResponseDto> {
    const deleted = await this.trashService.emptyTrash(workspaceId);
    return { deleted };
  }

  // ─── Move to trash ─────────────────────────────────────────────────────────

  @Post('notes/:noteId/trash')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Move a note to trash (soft delete)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note moved to trash.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async moveToTrash(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    await this.trashService.moveToTrash(workspaceId, noteId);
  }

  // ─── Restore from trash ────────────────────────────────────────────────────

  @Post('notes/:noteId/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a trashed note to its original location' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note restored from trash.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiBadRequestResponse({ description: 'Original path is already occupied by another note.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async restoreFromTrash(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    await this.trashService.restoreFromTrash(workspaceId, noteId);
  }

  // ─── Permanent delete ──────────────────────────────────────────────────────

  @Delete('notes/:noteId/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a trashed note (irreversible)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note permanently deleted.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiBadRequestResponse({ description: 'Note is not in the trash.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async permanentDelete(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    await this.trashService.permanentDelete(workspaceId, noteId);
  }
}
