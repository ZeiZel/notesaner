/**
 * LinkTypesController
 *
 * REST endpoints for managing Zettelkasten typed link relationships.
 *
 * Routes:
 *   GET    /workspaces/:workspaceId/link-types                       — list all types
 *   POST   /workspaces/:workspaceId/link-types                       — create custom type
 *   DELETE /workspaces/:workspaceId/link-types/:typeId               — delete custom type
 *   PATCH  /workspaces/:workspaceId/note-links/:noteLinkId/type      — set link type
 *
 * All routes require workspace membership. Role requirements:
 *   - GET: VIEWER (read access is always safe)
 *   - POST / DELETE: EDITOR (modifications require editor role or higher)
 *   - PATCH: EDITOR (setting a type is a graph annotation)
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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LinkTypesService } from './link-types.service';
import { CreateLinkTypeDto, SetLinkTypeDto } from './dto';

@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId')
export class LinkTypesController {
  constructor(private readonly linkTypesService: LinkTypesService) {}

  /**
   * GET /workspaces/:workspaceId/link-types
   *
   * Returns all relationship types available for the workspace:
   * built-in types (visible to all workspaces) + custom types scoped to this workspace.
   * Built-in types are listed first, then custom types alphabetically.
   *
   * Minimum role: VIEWER
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('link-types')
  async listLinkTypes(@Param('workspaceId') workspaceId: string) {
    return this.linkTypesService.listForWorkspace(workspaceId);
  }

  /**
   * POST /workspaces/:workspaceId/link-types
   *
   * Creates a new custom relationship type scoped to the workspace.
   * Slugs must be unique within the workspace and must not shadow built-in slugs.
   * Returns 409 if the slug is already taken (built-in or custom in this workspace).
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('link-types')
  @HttpCode(HttpStatus.CREATED)
  async createLinkType(@Param('workspaceId') workspaceId: string, @Body() dto: CreateLinkTypeDto) {
    return this.linkTypesService.create(workspaceId, dto);
  }

  /**
   * DELETE /workspaces/:workspaceId/link-types/:typeId
   *
   * Deletes a custom relationship type. Built-in types cannot be deleted (403).
   * All NoteLink rows using the deleted type have their relationshipTypeId cleared
   * automatically via the ON DELETE SET NULL cascade.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Delete('link-types/:typeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLinkType(@Param('workspaceId') workspaceId: string, @Param('typeId') typeId: string) {
    await this.linkTypesService.delete(workspaceId, typeId);
  }

  /**
   * PATCH /workspaces/:workspaceId/note-links/:noteLinkId/type
   *
   * Sets or clears the relationship type on a specific NoteLink.
   * Pass { relationshipTypeId: null } to remove the type annotation.
   * The NoteLink must belong to a note in this workspace (authorization scope).
   *
   * Returns the updated NoteLink id and its new relationshipTypeId.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Patch('note-links/:noteLinkId/type')
  async setLinkType(
    @Param('workspaceId') workspaceId: string,
    @Param('noteLinkId') noteLinkId: string,
    @Body() dto: SetLinkTypeDto,
  ) {
    return this.linkTypesService.setLinkType(workspaceId, noteLinkId, dto.relationshipTypeId);
  }
}
