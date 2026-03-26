import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class UsersService {
  async findById(_id: string): Promise<unknown> {
    throw new NotImplementedException('findById not yet implemented');
  }

  async findByEmail(_email: string): Promise<unknown> {
    throw new NotImplementedException('findByEmail not yet implemented');
  }

  async create(_dto: { email: string; password: string; displayName: string }): Promise<unknown> {
    throw new NotImplementedException('create not yet implemented');
  }

  async update(
    _id: string,
    _dto: { displayName?: string; avatarUrl?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('update not yet implemented');
  }

  async updatePassword(
    _id: string,
    _currentPassword: string,
    _newPassword: string,
  ): Promise<void> {
    throw new NotImplementedException('updatePassword not yet implemented');
  }

  async deactivate(_id: string): Promise<void> {
    throw new NotImplementedException('deactivate not yet implemented');
  }

  async getWorkspaces(_userId: string): Promise<unknown[]> {
    throw new NotImplementedException('getWorkspaces not yet implemented');
  }
}
