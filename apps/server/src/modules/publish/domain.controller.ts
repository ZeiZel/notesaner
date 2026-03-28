import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { DomainService } from './domain.service';
import { SetDomainDto } from './dto/custom-domain.dto';

/**
 * DomainController -- custom domain management for public vaults.
 */
@ApiTags('Publish - Custom Domains')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/domain')
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Post()
  @ApiOperation({
    summary: 'Set custom domain for public vault',
    description:
      'Configures a custom domain. Creates a verification token and resets status to "unverified". ' +
      'Returns DNS instructions for verification.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: SetDomainDto })
  @ApiOkResponse({ description: 'Domain configuration with DNS instructions.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async setDomain(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SetDomainDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.domainService.setDomain(workspaceId, dto.domain);
  }

  @Get()
  @ApiOperation({ summary: 'Get custom domain configuration and verification status' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Domain config with status (unverified/pending/verified/failed).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getDomainConfig(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.domainService.getDomainConfig(workspaceId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger DNS verification',
    description:
      'Checks for the TXT record at _notesaner-verify.<domain> and updates the verification status.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Verification result (verified or failed).' })
  @ApiNotFoundResponse({ description: 'No domain configured.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async verifyDomain(@Param('workspaceId') workspaceId: string, @CurrentUser() _user: JwtPayload) {
    return this.domainService.verifyDomain(workspaceId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove custom domain' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Custom domain removed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async removeDomain(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() _user: JwtPayload,
  ): Promise<void> {
    await this.domainService.removeDomain(workspaceId);
  }
}
