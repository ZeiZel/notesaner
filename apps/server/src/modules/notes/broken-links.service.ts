import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * BrokenLinksService — detects and reports broken internal links in a workspace.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@Injectable()
export class BrokenLinksService {
  async findBrokenLinks(_workspaceId: string): Promise<unknown[]> {
    throw new NotImplementedException('findBrokenLinks not yet implemented');
  }
}
