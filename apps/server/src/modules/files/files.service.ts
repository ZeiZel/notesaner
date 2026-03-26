import { Injectable, NotImplementedException } from '@nestjs/common';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  modifiedAt?: Date;
}

@Injectable()
export class FilesService {
  async readFile(_workspaceId: string, _relativePath: string): Promise<string> {
    throw new NotImplementedException('readFile not yet implemented');
  }

  async writeFile(
    _workspaceId: string,
    _relativePath: string,
    _content: string,
  ): Promise<void> {
    throw new NotImplementedException('writeFile not yet implemented');
  }

  async deleteFile(_workspaceId: string, _relativePath: string): Promise<void> {
    throw new NotImplementedException('deleteFile not yet implemented');
  }

  async moveFile(
    _workspaceId: string,
    _fromPath: string,
    _toPath: string,
  ): Promise<void> {
    throw new NotImplementedException('moveFile not yet implemented');
  }

  async listDirectory(
    _workspaceId: string,
    _relativePath: string,
  ): Promise<FileTreeNode[]> {
    throw new NotImplementedException('listDirectory not yet implemented');
  }

  async createDirectory(_workspaceId: string, _relativePath: string): Promise<void> {
    throw new NotImplementedException('createDirectory not yet implemented');
  }

  async deleteDirectory(_workspaceId: string, _relativePath: string): Promise<void> {
    throw new NotImplementedException('deleteDirectory not yet implemented');
  }

  async atomicWrite(_absolutePath: string, _content: string): Promise<void> {
    throw new NotImplementedException('atomicWrite not yet implemented');
  }

  getWorkspaceRoot(_workspaceId: string): string {
    throw new NotImplementedException('getWorkspaceRoot not yet implemented');
  }

  resolveSafePath(_workspaceId: string, _relativePath: string): string {
    throw new NotImplementedException('resolveSafePath not yet implemented');
  }
}
