import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class PublishService {
  async publishNote(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('publishNote not yet implemented');
  }

  async unpublishNote(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('unpublishNote not yet implemented');
  }

  async setPublicVault(
    _workspaceId: string,
    _config: { isPublic: boolean; publicSlug?: string; customDomain?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('setPublicVault not yet implemented');
  }

  async getPublicVaultConfig(_workspaceId: string): Promise<unknown> {
    throw new NotImplementedException('getPublicVaultConfig not yet implemented');
  }

  async getPublicNavigation(_publicSlug: string): Promise<unknown[]> {
    throw new NotImplementedException('getPublicNavigation not yet implemented');
  }

  async invalidateCache(_workspaceId: string): Promise<void> {
    throw new NotImplementedException('invalidateCache not yet implemented');
  }

  async renderNote(_publicSlug: string, _notePath: string): Promise<unknown> {
    throw new NotImplementedException('renderNote not yet implemented');
  }

  async renderVaultIndex(_publicSlug: string): Promise<unknown> {
    throw new NotImplementedException('renderVaultIndex not yet implemented');
  }

  async getGraphData(_publicSlug: string): Promise<unknown> {
    throw new NotImplementedException('getGraphData not yet implemented');
  }
}
