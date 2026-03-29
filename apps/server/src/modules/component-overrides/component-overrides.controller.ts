import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
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
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ComponentOverridesService } from './component-overrides.service';
import { CreateOverrideDto, UpdateOverrideDto } from './dto';

interface AuthenticatedRequest {
  user: { sub: string };
}

@ApiTags('Component Overrides')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/component-overrides')
export class ComponentOverridesController {
  constructor(private readonly service: ComponentOverridesService) {}

  // ---------------------------------------------------------------------------
  // Registry (no admin role)
  // ---------------------------------------------------------------------------

  @Get('registry')
  @ApiOperation({ summary: 'List all overridable components with props and starter templates' })
  @ApiOkResponse({ description: 'Component registry entries.' })
  async getRegistry() {
    return this.service.getRegistry();
  }

  // ---------------------------------------------------------------------------
  // Override CRUD
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'List all component overrides for a workspace (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiOkResponse({ description: 'List of component overrides.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async list(@Param('workspaceId') workspaceId: string, @Request() req: AuthenticatedRequest) {
    return this.service.list(workspaceId, req.user.sub);
  }

  @Get(':componentId')
  @ApiOperation({ summary: 'Get a single component override' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiOkResponse({ description: 'Component override record.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async getOne(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.getOne(workspaceId, componentId, req.user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new component override (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiBody({ type: CreateOverrideDto })
  @ApiCreatedResponse({ description: 'Override created in draft status.' })
  @ApiBadRequestResponse({ description: 'Invalid component id or override already exists.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateOverrideDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.create(workspaceId, dto, req.user.sub);
  }

  @Patch(':componentId')
  @ApiOperation({ summary: 'Update override source code (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiBody({ type: UpdateOverrideDto })
  @ApiOkResponse({ description: 'Override updated; status reset to draft.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateOverrideDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.update(workspaceId, componentId, dto, req.user.sub);
  }

  // ---------------------------------------------------------------------------
  // Compile & activate
  // ---------------------------------------------------------------------------

  @Post(':componentId/compile')
  @ApiOperation({ summary: 'Compile and activate an override (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiOkResponse({ description: 'Override compiled. Status is active or error.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiBadRequestResponse({ description: 'esbuild unavailable.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async compile(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.compile(workspaceId, componentId, req.user.sub);
  }

  // ---------------------------------------------------------------------------
  // Revert
  // ---------------------------------------------------------------------------

  @Post(':componentId/revert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revert component to its base implementation (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiOkResponse({ description: 'Override reverted; base component is now active.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async revert(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.revert(workspaceId, componentId, req.user.sub);
  }

  // ---------------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------------

  @Get(':componentId/audit')
  @ApiOperation({ summary: 'Get audit log for a component override (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiOkResponse({ description: 'Audit log entries, newest first.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async getAuditLog(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.getAuditLog(workspaceId, componentId, req.user.sub);
  }

  // ---------------------------------------------------------------------------
  // No-content delete (for completeness; reverts + deletes the record)
  // ---------------------------------------------------------------------------

  @Post(':componentId/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a component override record (admin only)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiParam({ name: 'componentId', type: String })
  @ApiNoContentResponse({ description: 'Override deleted.' })
  @ApiNotFoundResponse({ description: 'Override not found.' })
  @ApiForbiddenResponse({ description: 'Not an OWNER or ADMIN.' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('componentId') componentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.delete(workspaceId, componentId, req.user.sub);
  }
}
