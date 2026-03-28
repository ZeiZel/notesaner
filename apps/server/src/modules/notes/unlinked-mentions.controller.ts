/**
 * UnlinkedMentionsController
 *
 * REST endpoints for the Zettelkasten "unlinked mentions" feature.
 *
 * Routes:
 *   GET  /workspaces/:workspaceId/notes/:noteId/unlinked-mentions
 *     Returns notes that mention the target note's title in plain text but
 *     do not have a formal wiki/markdown link pointing to it.
 *
 *   POST /workspaces/:workspaceId/notes/:noteId/unlinked-mentions/:sourceNoteId/link
 *     Inserts a [[wiki-link]] in the source note at the first plain-text
 *     occurrence of the target note's title. One-click linking from the UI.
 *
 * Registration note (for wiring into notes.module.ts):
 *   controllers: [..., UnlinkedMentionsController]
 *   providers:   [..., UnlinkedMentionsService]
 */

import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UnlinkedMentionsService } from './unlinked-mentions.service';

@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId/notes/:noteId/unlinked-mentions')
export class UnlinkedMentionsController {
  constructor(private readonly unlinkedMentionsService: UnlinkedMentionsService) {}

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/unlinked-mentions
   *
   * Returns all notes in the workspace that mention the target note's title in
   * their raw markdown content but do NOT have a formal [[wiki link]] or
   * [markdown](link) pointing to it.
   *
   * Each result includes:
   *   - sourceNoteId / sourceNoteTitle / sourceNotePath — identify the source note
   *   - context  — plain-text snippet of the area around the first mention
   *   - position — character offset within the source note's markdown
   *
   * The result set is limited to 50 notes, ordered by most-recently-updated
   * source note first.
   *
   * Returns an empty array when FTS is not available (migration not applied)
   * or when no mentions are found — never a 5xx.
   *
   * Minimum role: VIEWER
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  async findUnlinkedMentions(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.unlinkedMentionsService.findUnlinkedMentions(workspaceId, noteId);
  }

  /**
   * POST /workspaces/:workspaceId/notes/:noteId/unlinked-mentions/:sourceNoteId/link
   *
   * One-click link creation: inserts `[[Target Note Title]]` at the first
   * plain-text occurrence of the target note's title in the source note's
   * content.
   *
   * The source note's content is updated via NotesService.update() so all
   * existing hooks fire: FTS reindex, link extraction (NoteLink table), tag
   * sync, and version history.
   *
   * Response body: { success: boolean; message: string }
   *   - success=true  — the [[wiki-link]] was inserted successfully.
   *   - success=false — the mention could not be found or persisted; the
   *     message explains the reason. HTTP status is still 200 to allow the UI
   *     to display a friendly error without triggering error boundary logic.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post(':sourceNoteId/link')
  @HttpCode(HttpStatus.OK)
  async createLinkFromMention(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Param('sourceNoteId') sourceNoteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unlinkedMentionsService.createLinkFromMention(
      workspaceId,
      noteId,
      sourceNoteId,
      user.sub,
    );
  }
}
