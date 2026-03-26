import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class SearchService {
  async search(
    _workspaceId: string,
    _params: { q: string; cursor?: string; limit?: number },
  ): Promise<unknown> {
    throw new NotImplementedException('search not yet implemented');
  }

  async suggest(_workspaceId: string, _prefix: string): Promise<string[]> {
    throw new NotImplementedException('suggest not yet implemented');
  }

  async indexNote(
    _noteId: string,
    _title: string,
    _content: string,
  ): Promise<void> {
    throw new NotImplementedException('indexNote not yet implemented');
  }

  async removeFromIndex(_noteId: string): Promise<void> {
    throw new NotImplementedException('removeFromIndex not yet implemented');
  }

  async rebuildIndex(_workspaceId: string): Promise<void> {
    throw new NotImplementedException('rebuildIndex not yet implemented');
  }
}
