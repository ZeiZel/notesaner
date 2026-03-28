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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PluginsService } from './plugins.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class InstallPluginDto {
  @ApiProperty({
    description: 'GitHub repository (owner/repo format)',
    example: 'notesaner/plugin-focus-mode',
  })
  repository!: string;

  @ApiPropertyOptional({
    description: 'Specific version to install (defaults to latest)',
    example: '1.2.0',
  })
  version?: string;
}

class UpdateSettingsDto {
  @ApiProperty({
    description: 'Plugin settings key-value pairs',
    example: { theme: 'dark', autoStart: true },
  })
  settings!: Record<string, unknown>;
}

class PluginSearchQueryDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'focus mode' })
  q?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  cursor?: string;

  @ApiPropertyOptional({ description: 'Results per page (max 100)', default: 20 })
  limit?: number;
}

class TogglePluginDto {
  @ApiProperty({ description: 'Whether to enable or disable the plugin', example: true })
  enabled!: boolean;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Plugins')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  @ApiOperation({ summary: 'List installed plugins' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of installed plugins.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listInstalled(@Param('workspaceId') workspaceId: string) {
    return this.pluginsService.listInstalled(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install a plugin from the registry' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: InstallPluginDto })
  @ApiCreatedResponse({ description: 'Plugin installed successfully.' })
  @ApiNotFoundResponse({ description: 'Plugin not found in registry.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async install(@Param('workspaceId') workspaceId: string, @Body() dto: InstallPluginDto) {
    return this.pluginsService.install(workspaceId, dto.repository, dto.version);
  }

  @Delete(':pluginId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Plugin uninstalled.' })
  @ApiNotFoundResponse({ description: 'Plugin not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async uninstall(@Param('workspaceId') workspaceId: string, @Param('pluginId') pluginId: string) {
    await this.pluginsService.uninstall(workspaceId, pluginId);
  }

  @Patch(':pluginId/toggle')
  @ApiOperation({ summary: 'Enable or disable a plugin' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (UUID)', type: String })
  @ApiBody({ type: TogglePluginDto })
  @ApiOkResponse({ description: 'Plugin toggled.' })
  @ApiNotFoundResponse({ description: 'Plugin not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async toggle(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
    @Body() body: TogglePluginDto,
  ) {
    return this.pluginsService.toggle(workspaceId, pluginId, body.enabled);
  }

  @Get(':pluginId/settings')
  @ApiOperation({ summary: 'Get plugin settings' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Plugin settings object.' })
  @ApiNotFoundResponse({ description: 'Plugin not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getSettings(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginsService.getSettings(workspaceId, pluginId);
  }

  @Patch(':pluginId/settings')
  @ApiOperation({ summary: 'Update plugin settings' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (UUID)', type: String })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ description: 'Settings updated.' })
  @ApiNotFoundResponse({ description: 'Plugin not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateSettings(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.pluginsService.updateSettings(workspaceId, pluginId, dto.settings);
  }

  @Get('registry')
  @ApiOperation({ summary: 'Search the plugin registry' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated plugin search results.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async searchRegistry(@Query() query: PluginSearchQueryDto) {
    return this.pluginsService.searchRegistry(query);
  }
}
