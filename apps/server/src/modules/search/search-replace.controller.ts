import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchRateLimit } from '../../common/decorators/throttle.decorator';
import { SearchReplaceService } from './search-replace.service';
import { SearchReplacePreviewDto } from './dto/search-replace-preview.dto';
import { SearchReplaceExecuteDto } from './dto/search-replace-execute.dto';

/**
 * Search & Replace REST API.
 *
 * Workspace-scoped: /workspaces/:workspaceId/search/replace/...
 *
 * Requires EDITOR role or above — VIEWER cannot modify notes.
 */
@ApiTags('Search & Replace')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@SearchRateLimit()
@Controller('workspaces/:workspaceId/search/replace')
export class SearchReplaceController {
  constructor(private readonly searchReplaceService: SearchReplaceService) {}

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('preview')
  @ApiOperation({
    summary: 'Preview search & replace matches',
    description:
      'Returns all matches for the search query without modifying any files. ' +
      'Supports plain text, regex, case-sensitive, and whole-word modes. ' +
      'Results include line numbers, column offsets, and surrounding context. ' +
      'Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Preview result with matches grouped by note.',
  })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR or above).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async preview(@Param('workspaceId') workspaceId: string, @Body() dto: SearchReplacePreviewDto) {
    return this.searchReplaceService.preview(workspaceId, {
      query: dto.query,
      replacement: dto.replacement,
      mode: dto.mode,
      caseSensitive: dto.caseSensitive,
      wholeWord: dto.wholeWord,
      filters: dto.filters,
      maxMatches: dto.maxMatches,
    });
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post()
  @ApiOperation({
    summary: 'Execute search & replace',
    description:
      'Replaces matches across notes in the workspace. Creates a version snapshot ' +
      'of each affected note before modification (undo support). ' +
      'When specific matches are provided, only those are replaced; otherwise replaces all. ' +
      'Operations with >1000 total matches are batched via BullMQ. ' +
      'Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Replacement result with count and modified note IDs.',
  })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires EDITOR or above).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async execute(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SearchReplaceExecuteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchReplaceService.execute(workspaceId, user.sub, {
      query: dto.query,
      replacement: dto.replacement,
      mode: dto.mode,
      caseSensitive: dto.caseSensitive,
      wholeWord: dto.wholeWord,
      filters: dto.filters,
      matches: dto.matches,
      excludeNoteIds: dto.excludeNoteIds,
    });
  }
}
