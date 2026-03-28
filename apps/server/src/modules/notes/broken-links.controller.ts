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
import { BrokenLinksService } from './broken-links.service';

/**
 * BrokenLinksController — endpoints for detecting broken internal links.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@ApiTags('Broken Links')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/broken-links')
export class BrokenLinksController {
  constructor(private readonly brokenLinksService: BrokenLinksService) {}

  @Get()
  @ApiOperation({ summary: 'List broken links in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of broken links.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listBrokenLinks(@Param('workspaceId') workspaceId: string) {
    return this.brokenLinksService.findBrokenLinks(workspaceId);
  }
}
