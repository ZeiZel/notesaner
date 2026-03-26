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
import { PluginsService } from './plugins.service';

class InstallPluginDto {
  repository!: string;
  version?: string;
}

class UpdateSettingsDto {
  settings!: Record<string, unknown>;
}

class PluginSearchQueryDto {
  q?: string;
  cursor?: string;
  limit?: number;
}

@Controller('workspaces/:workspaceId/plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  async listInstalled(@Param('workspaceId') workspaceId: string) {
    return this.pluginsService.listInstalled(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async install(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InstallPluginDto,
  ) {
    return this.pluginsService.install(workspaceId, dto.repository, dto.version);
  }

  @Delete(':pluginId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
  ) {
    await this.pluginsService.uninstall(workspaceId, pluginId);
  }

  @Patch(':pluginId/toggle')
  async toggle(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.pluginsService.toggle(workspaceId, pluginId, body.enabled);
  }

  @Get(':pluginId/settings')
  async getSettings(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginsService.getSettings(workspaceId, pluginId);
  }

  @Patch(':pluginId/settings')
  async updateSettings(
    @Param('workspaceId') workspaceId: string,
    @Param('pluginId') pluginId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.pluginsService.updateSettings(workspaceId, pluginId, dto.settings);
  }

  @Get('registry')
  async searchRegistry(@Query() query: PluginSearchQueryDto) {
    return this.pluginsService.searchRegistry(query);
  }
}
