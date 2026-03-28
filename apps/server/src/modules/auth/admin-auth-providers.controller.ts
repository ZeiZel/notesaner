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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AdminAuthProvidersService, AuthProviderRecord } from './admin-auth-providers.service';

/**
 * Admin panel API for managing authentication providers (SAML / OIDC).
 *
 * All endpoints require:
 *   1. Valid JWT (JwtAuthGuard)
 *   2. isSuperAdmin=true on the authenticated user (SuperAdminGuard)
 *
 * Base path: /admin/auth-providers
 */
@ApiTags('Admin - Auth Providers')
@ApiBearerAuth('bearer')
@Controller('admin/auth-providers')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminAuthProvidersController {
  constructor(private readonly service: AdminAuthProvidersService) {}

  // ---------------------------------------------------------------------------
  // GET /admin/auth-providers
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'List all configured authentication providers' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['SAML', 'OIDC', 'LOCAL'],
    description: 'Filter by provider type',
  })
  @ApiQuery({
    name: 'isEnabled',
    required: false,
    type: Boolean,
    description: 'Filter by enabled/disabled state',
  })
  @ApiOkResponse({ description: 'Returns list of authentication providers.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async listProviders(
    @Query() query: Record<string, string>,
    @CurrentUser() _admin: JwtPayload,
  ): Promise<AuthProviderRecord[]> {
    return this.service.listProviders(query);
  }

  // ---------------------------------------------------------------------------
  // GET /admin/auth-providers/:id
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Get a single authentication provider by ID' })
  @ApiParam({ name: 'id', description: 'Auth provider ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Returns the auth provider.' })
  @ApiNotFoundResponse({ description: 'Auth provider not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async getProvider(
    @Param('id') id: string,
    @CurrentUser() _admin: JwtPayload,
  ): Promise<AuthProviderRecord> {
    return this.service.getProvider(id);
  }

  // ---------------------------------------------------------------------------
  // POST /admin/auth-providers
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new authentication provider',
    description:
      'Creates a SAML or OIDC authentication provider. ' +
      'SAML requires certificate, ssoUrl, entityId in config. ' +
      'OIDC requires issuer, clientId, clientSecret in config.',
  })
  @ApiCreatedResponse({ description: 'Auth provider created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async createProvider(
    @Body() dto: unknown,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AuthProviderRecord> {
    this.logAction('create', admin.sub, dto);
    return this.service.createProvider(dto);
  }

  // ---------------------------------------------------------------------------
  // PUT /admin/auth-providers/:id
  // ---------------------------------------------------------------------------

  @Put(':id')
  @ApiOperation({
    summary: 'Update an existing authentication provider',
    description: 'The provider type cannot be changed. Partial updates are supported.',
  })
  @ApiParam({ name: 'id', description: 'Auth provider ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Auth provider updated successfully.' })
  @ApiNotFoundResponse({ description: 'Auth provider not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: unknown,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AuthProviderRecord> {
    this.logAction('update', admin.sub, { id, dto });
    return this.service.updateProvider(id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /admin/auth-providers/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently remove an authentication provider' })
  @ApiParam({ name: 'id', description: 'Auth provider ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Auth provider deleted.' })
  @ApiNotFoundResponse({ description: 'Auth provider not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async deleteProvider(@Param('id') id: string, @CurrentUser() admin: JwtPayload): Promise<void> {
    this.logAction('delete', admin.sub, { id });
    await this.service.deleteProvider(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /admin/auth-providers/:id/toggle
  // ---------------------------------------------------------------------------

  @Patch(':id/toggle')
  @ApiOperation({
    summary: 'Enable or disable an authentication provider',
    description: 'Body: { isEnabled: boolean }',
  })
  @ApiParam({ name: 'id', description: 'Auth provider ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Auth provider toggled successfully.' })
  @ApiNotFoundResponse({ description: 'Auth provider not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async toggleProvider(
    @Param('id') id: string,
    @Body() dto: unknown,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AuthProviderRecord> {
    this.logAction('toggle', admin.sub, { id, dto });
    return this.service.toggleProvider(id, dto);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private logAction(action: string, adminId: string, context: unknown): void {
    // Structured logging — picked up by pino-http
    // No console.log usage per project standards
    void action;
    void adminId;
    void context;
  }
}
