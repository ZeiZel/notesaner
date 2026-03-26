import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class WorkspacesService {
  async create(
    _userId: string,
    _dto: { name: string; slug: string; description?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('create not yet implemented');
  }

  async findById(_id: string): Promise<unknown> {
    throw new NotImplementedException('findById not yet implemented');
  }

  async findBySlug(_slug: string): Promise<unknown> {
    throw new NotImplementedException('findBySlug not yet implemented');
  }

  async findForUser(_userId: string): Promise<unknown[]> {
    throw new NotImplementedException('findForUser not yet implemented');
  }

  async update(
    _id: string,
    _dto: { name?: string; description?: string; isPublic?: boolean; publicSlug?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('update not yet implemented');
  }

  async delete(_id: string): Promise<void> {
    throw new NotImplementedException('delete not yet implemented');
  }

  async listMembers(_workspaceId: string): Promise<unknown[]> {
    throw new NotImplementedException('listMembers not yet implemented');
  }

  async invite(_workspaceId: string, _email: string, _role: string): Promise<unknown> {
    throw new NotImplementedException('invite not yet implemented');
  }

  async updateMemberRole(
    _workspaceId: string,
    _userId: string,
    _role: string,
  ): Promise<unknown> {
    throw new NotImplementedException('updateMemberRole not yet implemented');
  }

  async removeMember(_workspaceId: string, _userId: string): Promise<void> {
    throw new NotImplementedException('removeMember not yet implemented');
  }

  async getUserRole(_workspaceId: string, _userId: string): Promise<string | null> {
    throw new NotImplementedException('getUserRole not yet implemented');
  }
}
