import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class NotesService {
  async create(
    _workspaceId: string,
    _userId: string,
    _dto: { path: string; title: string; content?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('create not yet implemented');
  }

  async findById(_workspaceId: string, _noteId: string): Promise<unknown> {
    throw new NotImplementedException('findById not yet implemented');
  }

  async findByPath(_workspaceId: string, _path: string): Promise<unknown> {
    throw new NotImplementedException('findByPath not yet implemented');
  }

  async list(
    _workspaceId: string,
    _params: {
      cursor?: string;
      limit?: number;
      search?: string;
      isTrashed?: boolean;
      tagId?: string;
    },
  ): Promise<unknown> {
    throw new NotImplementedException('list not yet implemented');
  }

  async update(
    _workspaceId: string,
    _noteId: string,
    _userId: string,
    _dto: { title?: string; content?: string; frontmatter?: Record<string, unknown> },
  ): Promise<unknown> {
    throw new NotImplementedException('update not yet implemented');
  }

  async trash(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('trash not yet implemented');
  }

  async restore(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('restore not yet implemented');
  }

  async permanentDelete(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('permanentDelete not yet implemented');
  }

  async getContent(_workspaceId: string, _noteId: string): Promise<string> {
    throw new NotImplementedException('getContent not yet implemented');
  }

  async persistContent(
    _noteId: string,
    _content: string,
    _userId: string,
  ): Promise<void> {
    throw new NotImplementedException('persistContent not yet implemented');
  }

  async getGraphData(_workspaceId: string): Promise<unknown> {
    throw new NotImplementedException('getGraphData not yet implemented');
  }

  async getBacklinks(_noteId: string): Promise<unknown[]> {
    throw new NotImplementedException('getBacklinks not yet implemented');
  }

  async listVersions(_noteId: string): Promise<unknown[]> {
    throw new NotImplementedException('listVersions not yet implemented');
  }

  async bulkMove(
    _workspaceId: string,
    _noteIds: string[],
    _targetFolder: string,
  ): Promise<void> {
    throw new NotImplementedException('bulkMove not yet implemented');
  }

  async renameWithLinkUpdate(
    _workspaceId: string,
    _noteId: string,
    _newPath: string,
  ): Promise<void> {
    throw new NotImplementedException('renameWithLinkUpdate not yet implemented');
  }
}
