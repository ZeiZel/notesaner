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
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class CreateWorkspaceDto {
  @ApiProperty({ description: 'Workspace name', example: 'My Knowledge Base' })
  name!: string;

  @ApiProperty({
    description: 'URL-safe slug (unique)',
    example: 'my-knowledge-base',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Workspace description',
    example: 'Personal notes and research',
  })
  description?: string;
}

class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Updated workspace name', example: 'Renamed Workspace' })
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description', example: 'New description' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the workspace vault is publicly accessible',
    example: false,
  })
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Public vault slug',
    example: 'my-public-notes',
  })
  publicSlug?: string;
}

class InviteMemberDto {
  @ApiProperty({ description: 'Email of the user to invite', example: 'bob@example.com' })
  email!: string;

  @ApiProperty({
    description: 'Role to assign',
    example: 'EDITOR',
    enum: ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'],
  })
  role!: string;
}

class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role',
    example: 'ADMIN',
    enum: ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'],
  })
  role!: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Workspaces')
@ApiBearerAuth('bearer')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiCreatedResponse({ description: 'Workspace created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for the current user' })
  @ApiOkResponse({ description: 'List of workspaces the user is a member of.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.workspacesService.findForUser(user.sub);
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Get a workspace by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Workspace details.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findOne(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Update a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: UpdateWorkspaceDto })
  @ApiOkResponse({ description: 'Workspace updated.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async update(@Param('workspaceId') workspaceId: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Workspace deleted.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async remove(@Param('workspaceId') workspaceId: string) {
    await this.workspacesService.delete(workspaceId);
  }

  @Get(':workspaceId/members')
  @ApiOperation({ summary: 'List workspace members' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of workspace members with roles.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @Post(':workspaceId/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a member to the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: InviteMemberDto })
  @ApiCreatedResponse({ description: 'Invitation sent.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async inviteMember(@Param('workspaceId') workspaceId: string, @Body() dto: InviteMemberDto) {
    return this.workspacesService.invite(workspaceId, dto.email, dto.role);
  }

  @Patch(':workspaceId/members/:userId')
  @ApiOperation({ summary: "Update a member's role" })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'userId', description: 'User ID (UUID) of the member', type: String })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiOkResponse({ description: 'Member role updated.' })
  @ApiNotFoundResponse({ description: 'Workspace or member not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, userId, dto.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'userId', description: 'User ID (UUID) of the member', type: String })
  @ApiNoContentResponse({ description: 'Member removed.' })
  @ApiNotFoundResponse({ description: 'Workspace or member not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async removeMember(@Param('workspaceId') workspaceId: string, @Param('userId') userId: string) {
    await this.workspacesService.removeMember(workspaceId, userId);
  }
}
