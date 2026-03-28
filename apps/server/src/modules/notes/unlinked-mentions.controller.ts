/**
 * UnlinkedMentionsController
 *
 * REST endpoints for the Zettelkasten "unlinked mentions" feature.
 */

import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UnlinkedMentionsService } from './unlinked-mentions.service';

@ApiTags('Unlinked Mentions')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId/notes/:noteId/unlinked-mentions')
export class UnlinkedMentionsController {
  constructor(private readonly unlinkedMentionsService: UnlinkedMentionsService) {}

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  @ApiOperation({
    summary: 'Find unlinked mentions of a note',
    description:
      "Returns notes that mention the target note's title in plain text but do not have a formal wiki/markdown link. " +
      'Results limited to 50, ordered by most recently updated. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Target note ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Array of unlinked mention results with sourceNoteId, context, and position.',
  })
  @ApiNotFoundResponse({ description: 'Target note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findUnlinkedMentions(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.unlinkedMentionsService.findUnlinkedMentions(workspaceId, noteId);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post(':sourceNoteId/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert an unlinked mention into a wiki-link',
    description:
      "Inserts [[Target Note Title]] at the first plain-text occurrence of the target note's title in the source note. " +
      'Returns { success: boolean, message: string }. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Target note ID (UUID)', type: String })
  @ApiParam({
    name: 'sourceNoteId',
    description: 'Source note ID that contains the mention',
    type: String,
  })
  @ApiOkResponse({ description: 'Link creation result.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
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
