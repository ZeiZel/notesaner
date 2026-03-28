import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * LinkExtractionService — extracts wiki-links, markdown links, embeds, and
 * block references from note content.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@Injectable()
export class LinkExtractionService {
  async extractLinks(_content: string, _workspaceId: string): Promise<unknown[]> {
    throw new NotImplementedException('extractLinks not yet implemented');
  }

  async updateLinks(_noteId: string, _workspaceId: string, _content: string): Promise<void> {
    throw new NotImplementedException('updateLinks not yet implemented');
  }
}
