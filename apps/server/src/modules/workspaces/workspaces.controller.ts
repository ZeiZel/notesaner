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
  UseInterceptors,
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
import { Audited } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/audit.types';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceSwitchService } from './workspace-switch.service';

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
@UseInterceptors(AuditInterceptor)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceSwitchService: WorkspaceSwitchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audited(AuditAction.WORKSPACE_CREATED)
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiCreatedResponse({ description: 'Workspace created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List workspaces for the current user',
    description:
      'Returns all workspaces the user is a member of, including role, member count, and note count.',
  })
  @ApiOkResponse({ description: 'List of workspaces with summary statistics.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.workspaceSwitchService.listUserWorkspaces(user.sub);
  }

  @Post(':workspaceId/switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Switch to a workspace',
    description:
      'Validates the user has membership in the target workspace and returns workspace details with the user role. ' +
      'The active workspace is tracked client-side; this endpoint serves as a validated fetch.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Workspace details and user membership info.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT or not a member.' })
  async switchWorkspace(
    @CurrentUser() user: JwtPayload,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceSwitchService.switchWorkspace(user.sub, workspaceId);
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
  @Audited(AuditAction.WORKSPACE_UPDATED)
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
  @Audited(AuditAction.WORKSPACE_DELETED)
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
  @Audited(AuditAction.MEMBER_INVITED)
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
  @Audited(AuditAction.MEMBER_ROLE_CHANGED)
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
  @Audited(AuditAction.MEMBER_REMOVED)
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
