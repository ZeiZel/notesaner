import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * FileWatcherService — watches the filesystem for changes to note files.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@Injectable()
export class FileWatcherService {
  async watchWorkspace(_workspaceId: string, _storagePath: string): Promise<void> {
    throw new NotImplementedException('watchWorkspace not yet implemented');
  }

  async stopWatching(_workspaceId: string): Promise<void> {
    throw new NotImplementedException('stopWatching not yet implemented');
  }
}
