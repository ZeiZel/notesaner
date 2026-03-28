/**
 * LinkTypesController
 *
 * REST endpoints for managing Zettelkasten typed link relationships.
 */

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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LinkTypesService } from './link-types.service';
import { CreateLinkTypeDto, SetLinkTypeDto } from './dto';

@ApiTags('Link Types')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId')
export class LinkTypesController {
  constructor(private readonly linkTypesService: LinkTypesService) {}

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('link-types')
  @ApiOperation({
    summary: 'List all relationship types for the workspace',
    description:
      'Returns built-in types (visible to all workspaces) + custom types scoped to this workspace. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of relationship types.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listLinkTypes(@Param('workspaceId') workspaceId: string) {
    return this.linkTypesService.listForWorkspace(workspaceId);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('link-types')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a custom relationship type',
    description:
      'Creates a workspace-scoped relationship type. Slugs must be unique. Returns 409 if the slug is already taken. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: CreateLinkTypeDto })
  @ApiCreatedResponse({ description: 'Link type created.' })
  @ApiConflictResponse({ description: 'Slug already taken.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async createLinkType(@Param('workspaceId') workspaceId: string, @Body() dto: CreateLinkTypeDto) {
    return this.linkTypesService.create(workspaceId, dto);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Delete('link-types/:typeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a custom relationship type',
    description:
      'Built-in types cannot be deleted (403). NoteLinks using this type have their relationshipTypeId cleared. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'typeId', description: 'Link type ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Link type deleted.' })
  @ApiForbiddenResponse({ description: 'Cannot delete built-in types or insufficient role.' })
  @ApiNotFoundResponse({ description: 'Link type not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async deleteLinkType(@Param('workspaceId') workspaceId: string, @Param('typeId') typeId: string) {
    await this.linkTypesService.delete(workspaceId, typeId);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Patch('note-links/:noteLinkId/type')
  @ApiOperation({
    summary: 'Set or clear the relationship type on a note link',
    description:
      'Pass { relationshipTypeId: null } to clear. The NoteLink must belong to a note in this workspace. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteLinkId', description: 'Note link ID (UUID)', type: String })
  @ApiBody({ type: SetLinkTypeDto })
  @ApiOkResponse({ description: 'NoteLink type updated.' })
  @ApiNotFoundResponse({ description: 'NoteLink not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async setLinkType(
    @Param('workspaceId') workspaceId: string,
    @Param('noteLinkId') noteLinkId: string,
    @Body() dto: SetLinkTypeDto,
  ) {
    return this.linkTypesService.setLinkType(workspaceId, noteLinkId, dto.relationshipTypeId);
  }
}
