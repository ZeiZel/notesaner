import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class PluginsService {
  async install(
    _workspaceId: string,
    _repository: string,
    _version?: string,
  ): Promise<unknown> {
    throw new NotImplementedException('install not yet implemented');
  }

  async uninstall(_workspaceId: string, _pluginId: string): Promise<void> {
    throw new NotImplementedException('uninstall not yet implemented');
  }

  async toggle(
    _workspaceId: string,
    _pluginId: string,
    _enabled: boolean,
  ): Promise<unknown> {
    throw new NotImplementedException('toggle not yet implemented');
  }

  async listInstalled(_workspaceId: string): Promise<unknown[]> {
    throw new NotImplementedException('listInstalled not yet implemented');
  }

  async updateSettings(
    _workspaceId: string,
    _pluginId: string,
    _settings: Record<string, unknown>,
  ): Promise<void> {
    throw new NotImplementedException('updateSettings not yet implemented');
  }

  async getSettings(
    _workspaceId: string,
    _pluginId: string,
  ): Promise<Record<string, unknown>> {
    throw new NotImplementedException('getSettings not yet implemented');
  }

  async checkForUpdates(_workspaceId: string): Promise<unknown[]> {
    throw new NotImplementedException('checkForUpdates not yet implemented');
  }

  async searchRegistry(_params: {
    q?: string;
    cursor?: string;
    limit?: number;
  }): Promise<unknown> {
    throw new NotImplementedException('searchRegistry not yet implemented');
  }
}
