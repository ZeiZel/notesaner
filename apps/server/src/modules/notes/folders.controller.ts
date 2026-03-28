import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * FoldersController — endpoints for managing note folders within a workspace.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@ApiTags('Folders')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/folders')
export class FoldersController {
  @Get()
  @ApiOperation({ summary: 'List folders in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Folder tree.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listFolders(@Param('workspaceId') _workspaceId: string) {
    return { folders: [] };
  }
}
