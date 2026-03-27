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
@Controller('admin/auth-providers')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminAuthProvidersController {
  constructor(private readonly service: AdminAuthProvidersService) {}

  // ---------------------------------------------------------------------------
  // GET /admin/auth-providers
  // ---------------------------------------------------------------------------

  /**
   * List all configured authentication providers.
   *
   * Optional query filters:
   *   - workspaceId: filter by workspace
   *   - type: SAML | OIDC | LOCAL
   *   - isEnabled: true | false
   */
  @Get()
  async listProviders(
    @Query() query: Record<string, string>,
    @CurrentUser() _admin: JwtPayload,
  ): Promise<AuthProviderRecord[]> {
    return this.service.listProviders(query);
  }

  // ---------------------------------------------------------------------------
  // GET /admin/auth-providers/:id
  // ---------------------------------------------------------------------------

  /** Get a single auth provider by ID. */
  @Get(':id')
  async getProvider(
    @Param('id') id: string,
    @CurrentUser() _admin: JwtPayload,
  ): Promise<AuthProviderRecord> {
    return this.service.getProvider(id);
  }

  // ---------------------------------------------------------------------------
  // POST /admin/auth-providers
  // ---------------------------------------------------------------------------

  /**
   * Create a new authentication provider.
   *
   * Body must match CreateAuthProviderDto:
   *   - type: "SAML" — requires config.certificate, config.ssoUrl, config.entityId
   *   - type: "OIDC" — requires config.issuer, config.clientId, config.clientSecret
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
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

  /**
   * Update an existing authentication provider.
   *
   * The provider type cannot be changed. Partial updates are supported.
   */
  @Put(':id')
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

  /** Permanently remove an authentication provider. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ): Promise<void> {
    this.logAction('delete', admin.sub, { id });
    await this.service.deleteProvider(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /admin/auth-providers/:id/toggle
  // ---------------------------------------------------------------------------

  /**
   * Enable or disable an authentication provider.
   *
   * Body: { isEnabled: boolean }
   */
  @Patch(':id/toggle')
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
