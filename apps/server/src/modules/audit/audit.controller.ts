import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto, AuditRetentionConfigDto } from './dto/audit-query.dto';
import type { AuditFilter } from './audit.types';

/**
 * AuditController -- workspace-scoped audit-log endpoints.
 *
 * All routes require ADMIN role or higher.
 */
@ApiTags('Audit Log')
@ApiBearerAuth('bearer')
@Controller('workspaces/:workspaceId/audit-log')
@Roles('ADMIN')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit log',
    description:
      'Returns a paginated list of audit entries. Supports filtering by userId, action types, date range, and free text. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Paginated audit entries with nextCursor and total.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async query(@Param('workspaceId') workspaceId: string, @Query() dto: AuditQueryDto) {
    return this.auditService.query(workspaceId, {
      filter: {
        userId: dto.userId,
        actions: dto.actions,
        from: dto.from,
        to: dto.to,
        search: dto.search,
      },
      cursor: dto.cursor,
      limit: dto.limit,
    });
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export audit log as CSV',
    description:
      'Streams the audit log as a CSV file download. Same filter options as the query endpoint. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'CSV file download.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async exportCsv(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: AuditQueryDto,
    @Res() res: Response,
    @CurrentUser() user: JwtPayload,
  ) {
    const filter: AuditFilter = {
      userId: dto.userId,
      actions: dto.actions,
      from: dto.from,
      to: dto.to,
      search: dto.search,
    };

    const csv = await this.auditService.exportCsv(workspaceId, filter);

    // Log the export action
    await this.auditService.log(
      (await import('./audit.types')).AuditAction.AUDIT_LOG_EXPORTED,
      user.sub,
      workspaceId,
      { filters: filter },
      '',
      '',
    );

    const filename = `audit-log-${workspaceId}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get audit log retention configuration',
    description:
      'Returns the retention settings (retentionDays) for the workspace. Minimum role: ADMIN.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Retention configuration.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getConfig(@Param('workspaceId') workspaceId: string, @CurrentUser() user: JwtPayload) {
    return this.auditService.getRetentionConfig(workspaceId, user.sub);
  }

  @Put('config')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update audit log retention configuration',
    description: 'Sets the number of days to retain audit entries (30-365). Requires OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: AuditRetentionConfigDto })
  @ApiOkResponse({ description: 'Retention configuration updated.' })
  @ApiForbiddenResponse({ description: 'Requires OWNER role.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async setConfig(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AuditRetentionConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auditService.setRetentionConfig(workspaceId, dto.retentionDays, user.sub);
  }

  @Get('gdpr/:userId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'GDPR Subject Access Request',
    description:
      'Returns all audit entries belonging to the specified user. For GDPR compliance. Requires OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'userId', description: 'Subject user ID (UUID)', type: String })
  @ApiOkResponse({ description: 'All audit entries for the subject user.' })
  @ApiForbiddenResponse({ description: 'Requires OWNER role.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getSubjectData(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() _requester: JwtPayload,
  ) {
    // Log the SAR action
    await this.auditService.log(
      (await import('./audit.types')).AuditAction.GDPR_DATA_REQUESTED,
      _requester.sub,
      workspaceId,
      { subjectUserId: userId },
      '',
      '',
    );

    return this.auditService.getSubjectData(userId, workspaceId);
  }

  @Put('gdpr/:userId/anonymize')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'GDPR right-to-erasure: anonymize user audit entries',
    description:
      'Anonymises all audit entries for the given user in this workspace. Requires OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'userId', description: 'User ID to anonymize (UUID)', type: String })
  @ApiOkResponse({
    description: 'Anonymization result.',
    schema: {
      type: 'object',
      properties: {
        anonymizedEntries: { type: 'number', example: 42 },
        userId: { type: 'string', example: 'usr-abc-123' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Requires OWNER role.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async anonymizeUser(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() _requester: JwtPayload,
  ) {
    const count = await this.auditService.anonymizeUser(userId, workspaceId);
    return { anonymizedEntries: count, userId };
  }
}
