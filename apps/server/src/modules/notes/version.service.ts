import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * VersionService — manages note version history snapshots.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@Injectable()
export class VersionService {
  async createVersion(
    _noteId: string,
    _userId: string,
    _content: string,
    _message?: string,
  ): Promise<unknown> {
    throw new NotImplementedException('createVersion not yet implemented');
  }

  async listVersions(_noteId: string): Promise<unknown[]> {
    throw new NotImplementedException('listVersions not yet implemented');
  }

  async getVersion(_noteId: string, _version: number): Promise<unknown> {
    throw new NotImplementedException('getVersion not yet implemented');
  }

  async restoreVersion(_noteId: string, _version: number, _userId: string): Promise<unknown> {
    throw new NotImplementedException('restoreVersion not yet implemented');
  }
}
