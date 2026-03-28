import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublishService } from './publish.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class PublicVaultConfigDto {
  @ApiProperty({ description: 'Whether the vault is publicly accessible', example: true })
  isPublic!: boolean;

  @ApiPropertyOptional({
    description: 'URL-safe slug for the public vault',
    example: 'my-public-notes',
  })
  publicSlug?: string;

  @ApiPropertyOptional({
    description: 'Custom domain for the public vault',
    example: 'notes.mycompany.com',
  })
  customDomain?: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Publish')
@Controller()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  // ---- Publishing management (authenticated) ----

  @Post('workspaces/:workspaceId/notes/:noteId/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Publish a note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note published.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async publishNote(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.publishService.publishNote(workspaceId, noteId);
  }

  @Delete('workspaces/:workspaceId/notes/:noteId/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Unpublish a note' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Note unpublished.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async unpublishNote(@Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await this.publishService.unpublishNote(workspaceId, noteId);
  }

  @Put('workspaces/:workspaceId/publish-config')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Configure public vault settings' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: PublicVaultConfigDto })
  @ApiOkResponse({ description: 'Public vault configuration updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async setPublicVault(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: PublicVaultConfigDto,
  ) {
    return this.publishService.setPublicVault(workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/publish-config')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get public vault configuration' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Current public vault configuration.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getPublicVaultConfig(@Param('workspaceId') workspaceId: string) {
    return this.publishService.getPublicVaultConfig(workspaceId);
  }

  // ---- Public access (no auth required) ----

  @Public()
  @Get('public/:publicSlug')
  @ApiOperation({
    summary: 'Get public vault index',
    description: 'Returns the public vault landing page data. No authentication required.',
  })
  @ApiParam({ name: 'publicSlug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Public vault index data.' })
  @ApiNotFoundResponse({ description: 'Public vault not found.' })
  async getPublicVaultIndex(@Param('publicSlug') publicSlug: string) {
    return this.publishService.renderVaultIndex(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/nav')
  @ApiOperation({
    summary: 'Get public vault navigation tree',
    description:
      'Returns the navigation structure for the public vault. No authentication required.',
  })
  @ApiParam({ name: 'publicSlug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Navigation tree.' })
  @ApiNotFoundResponse({ description: 'Public vault not found.' })
  async getPublicNavigation(@Param('publicSlug') publicSlug: string) {
    return this.publishService.getPublicNavigation(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/graph')
  @ApiOperation({
    summary: 'Get public vault graph data',
    description: 'Returns graph nodes and edges for the public vault. No authentication required.',
  })
  @ApiParam({ name: 'publicSlug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Graph data (nodes and edges).' })
  @ApiNotFoundResponse({ description: 'Public vault not found.' })
  async getPublicGraph(@Param('publicSlug') publicSlug: string) {
    return this.publishService.getGraphData(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/notes/*')
  @ApiOperation({
    summary: 'Get a published note by path',
    description:
      'Returns a single published note by its path within the vault. No authentication required.',
  })
  @ApiParam({ name: 'publicSlug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: 'Published note content.' })
  @ApiNotFoundResponse({ description: 'Note not found or not published.' })
  async getPublicNote(
    @Param('publicSlug') publicSlug: string,
    @Param() params: Record<string, string>,
  ) {
    const notePath = params['0'] ?? '';
    return this.publishService.renderNote(publicSlug, notePath);
  }
}
