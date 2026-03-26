import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';

class CreateWorkspaceDto {
  name!: string;
  slug!: string;
  description?: string;
}

class UpdateWorkspaceDto {
  name?: string;
  description?: string;
  isPublic?: boolean;
  publicSlug?: string;
}

class InviteMemberDto {
  email!: string;
  role!: string;
}

class UpdateMemberRoleDto {
  role!: string;
}

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.workspacesService.findForUser(user.sub);
  }

  @Get(':workspaceId')
  async findOne(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Patch(':workspaceId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('workspaceId') workspaceId: string) {
    await this.workspacesService.delete(workspaceId);
  }

  @Get(':workspaceId/members')
  async listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @Post(':workspaceId/members')
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspacesService.invite(workspaceId, dto.email, dto.role);
  }

  @Patch(':workspaceId/members/:userId')
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, userId, dto.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    await this.workspacesService.removeMember(workspaceId, userId);
  }
}
