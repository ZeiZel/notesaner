import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { DomainService } from './domain.service';
import { SetDomainDto } from './dto/custom-domain.dto';

/**
 * DomainController — custom domain management for public vaults.
 *
 * All routes are authenticated (JwtAuthGuard applied globally).
 * The caller must be a member of the target workspace — workspace-level
 * permission enforcement is expected to be handled by a guard at the
 * router or module level (consistent with the rest of the publish module).
 *
 * Endpoints:
 *   POST   /workspaces/:id/domain          — set custom domain
 *   GET    /workspaces/:id/domain          — get domain config & status
 *   POST   /workspaces/:id/domain/verify   — trigger DNS verification
 *   DELETE /workspaces/:id/domain          — remove custom domain
 */
@Controller('workspaces/:workspaceId/domain')
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  /**
   * POST /workspaces/:workspaceId/domain
   * Configure a custom domain for the workspace's public vault.
   *
   * Creates a new verification token and resets status to "unverified".
   * Returns the full DomainStatusResponse including DNS instructions.
   */
  @Post()
  async setDomain(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SetDomainDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.domainService.setDomain(workspaceId, dto.domain);
  }

  /**
   * GET /workspaces/:workspaceId/domain
   * Get the current custom domain configuration and verification status.
   */
  @Get()
  async getDomainConfig(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.domainService.getDomainConfig(workspaceId);
  }

  /**
   * POST /workspaces/:workspaceId/domain/verify
   * Trigger a DNS TXT-record verification attempt.
   *
   * Checks for the TXT record at _notesaner-verify.<domain> and updates
   * the verification status accordingly (verified | failed).
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyDomain(@Param('workspaceId') workspaceId: string, @CurrentUser() _user: JwtPayload) {
    return this.domainService.verifyDomain(workspaceId);
  }

  /**
   * DELETE /workspaces/:workspaceId/domain
   * Remove the custom domain from the workspace.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDomain(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() _user: JwtPayload,
  ): Promise<void> {
    await this.domainService.removeDomain(workspaceId);
  }
}
