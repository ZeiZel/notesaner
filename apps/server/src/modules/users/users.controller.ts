import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

class UpdateProfileDto {
  displayName?: string;
  avatarUrl?: string;
}

class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.sub, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.usersService.updatePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Get('me/workspaces')
  async getMyWorkspaces(@CurrentUser() user: JwtPayload) {
    return this.usersService.getWorkspaces(user.sub);
  }
}
