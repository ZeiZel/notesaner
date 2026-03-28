import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'Alice Johnson' })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://avatars.example.com/alice.jpg',
  })
  avatarUrl?: string;
}

class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for verification', example: 'oldPassword123' })
  currentPassword!: string;

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'newSecurePass456' })
  newPassword!: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'User profile data.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Profile updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.sub, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiNoContentResponse({ description: 'Password changed successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid current password or missing JWT.' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.usersService.updatePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Get('me/workspaces')
  @ApiOperation({ summary: 'List workspaces the user belongs to' })
  @ApiOkResponse({ description: 'List of workspaces with membership roles.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getMyWorkspaces(@CurrentUser() user: JwtPayload) {
    return this.usersService.getWorkspaces(user.sub);
  }
}
