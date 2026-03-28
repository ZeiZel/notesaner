/**
 * BlockReferencesController
 *
 * REST endpoints for block-level references within notes.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { BlockReferencesService } from './block-references.service';

@ApiTags('Block References')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId/notes/:noteId/blocks')
export class BlockReferencesController {
  constructor(private readonly blockReferencesService: BlockReferencesService) {}

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  @ApiOperation({
    summary: 'List all blocks in a note',
    description:
      'Returns all paragraphs tagged with ^block-id. Each block includes its ID, content, and line number. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of blocks with IDs and content.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listBlocks(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    return this.blockReferencesService.listBlocks(workspaceId, noteId);
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get(':blockId')
  @ApiOperation({
    summary: 'Get a specific block by ID',
    description:
      'Returns the content of a specific block identified by its block ID (without ^ prefix). Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiParam({ name: 'blockId', description: 'Block ID (without ^ prefix)', type: String })
  @ApiOkResponse({ description: 'Block content.' })
  @ApiNotFoundResponse({ description: 'Note or block not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getBlockContent(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Param('blockId') blockId: string,
  ) {
    return this.blockReferencesService.getBlockContent(workspaceId, noteId, blockId);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a block reference',
    description:
      'Generates and inserts a block ID for a specific line. If the line already has one, the existing ID is returned. ' +
      'Body: { line: number, blockId?: string }. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Block reference created or existing ID returned.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async createBlockReference(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ) {
    return this.blockReferencesService.createBlockReference(workspaceId, noteId, user.sub, body);
  }
}
