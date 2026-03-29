import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { NoteAliasService } from './note-alias.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class SetAliasBodyDto {
  @ApiProperty({
    description: 'URL-friendly alias slug (lowercase letters, digits, hyphens only)',
    example: 'my-daily-journal',
  })
  alias!: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

/**
 * NoteAliasController
 *
 * Exposes three alias-related endpoints nested under the workspace path:
 *
 *   GET    /api/workspaces/:wid/notes/by-alias/:alias  — resolve alias → note
 *   PUT    /api/workspaces/:wid/notes/:id/alias        — set alias on a note
 *   DELETE /api/workspaces/:wid/notes/:id/alias        — remove alias from a note
 */
@ApiTags('Note Aliases')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/notes')
export class NoteAliasController {
  constructor(private readonly noteAliasService: NoteAliasService) {}

  // ── GET by-alias/:alias ────────────────────────────────────────────────────

  @Get('by-alias/:alias')
  @ApiOperation({
    summary: 'Resolve a note alias',
    description:
      'Look up a note by its workspace-scoped alias slug. Returns the note ID and alias.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({
    name: 'alias',
    description: 'URL-friendly alias slug (e.g. "my-daily-journal")',
    type: String,
  })
  @ApiOkResponse({ description: 'Alias resolved to a note.' })
  @ApiNotFoundResponse({ description: 'No note with that alias in this workspace.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async resolveAlias(@Param('workspaceId') workspaceId: string, @Param('alias') alias: string) {
    return this.noteAliasService.resolveAlias(workspaceId, alias);
  }

  // ── PUT :noteId/alias ──────────────────────────────────────────────────────

  @Put(':noteId/alias')
  @ApiOperation({
    summary: 'Set an alias on a note',
    description:
      'Assign a workspace-unique URL-friendly alias to the note. Replaces any previously set alias.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiBody({ type: SetAliasBodyDto })
  @ApiOkResponse({ description: 'Alias set successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found in workspace.' })
  @ApiConflictResponse({ description: 'Alias already in use by another note.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async setAlias(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Body() body: SetAliasBodyDto,
  ) {
    return this.noteAliasService.setAlias(noteId, workspaceId, body.alias);
  }

  // ── DELETE :noteId/alias ──────────────────────────────────────────────────

  @Delete(':noteId/alias')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove the alias from a note',
    description: 'Clears the alias. Idempotent — returns 204 even if no alias was set.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Alias removed (or was already absent).' })
  @ApiNotFoundResponse({ description: 'Note not found in workspace.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async removeAlias(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.noteAliasService.removeAlias(noteId, workspaceId);
  }
}
