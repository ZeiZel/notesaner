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
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto, AuditRetentionConfigDto } from './dto/audit-query.dto';
import type { AuditFilter } from './audit.types';

/**
 * AuditController — workspace-scoped audit-log endpoints.
 *
 * All routes require ADMIN role or higher. The :workspaceId param is used both
 * for RolesGuard membership enforcement and to scope the audit-log queries.
 *
 * Routes:
 *   GET  /workspaces/:workspaceId/audit-log              — paginated log
 *   GET  /workspaces/:workspaceId/audit-log/export       — CSV download
 *   PUT  /workspaces/:workspaceId/audit-log/config       — retention settings
 *   GET  /workspaces/:workspaceId/audit-log/config       — read retention settings
 *   GET  /workspaces/:workspaceId/audit-log/gdpr/:userId — GDPR subject data
 *   DELETE /workspaces/:workspaceId/audit-log/gdpr/:userId — GDPR anonymize
 */
@Controller('workspaces/:workspaceId/audit-log')
@Roles('ADMIN')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /workspaces/:workspaceId/audit-log
   *
   * Returns a paginated list of audit entries for the workspace.
   * Supports filtering by userId, action types, date range, and free text.
   */
  @Get()
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

  /**
   * GET /workspaces/:workspaceId/audit-log/export
   *
   * Streams the audit log as a CSV file download.
   * Applies the same filter options as the paginated query endpoint.
   *
   * Response:
   *   Content-Type: text/csv
   *   Content-Disposition: attachment; filename="audit-log-<workspaceId>.csv"
   */
  @Get('export')
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

  /**
   * GET /workspaces/:workspaceId/audit-log/config
   *
   * Returns the current retention configuration for the workspace.
   */
  @Get('config')
  async getConfig(@Param('workspaceId') workspaceId: string, @CurrentUser() user: JwtPayload) {
    return this.auditService.getRetentionConfig(workspaceId, user.sub);
  }

  /**
   * PUT /workspaces/:workspaceId/audit-log/config
   *
   * Updates the retention configuration for the workspace.
   * Requires OWNER role to prevent ADMINs from reducing audit trail visibility.
   */
  @Put('config')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  async setConfig(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AuditRetentionConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auditService.setRetentionConfig(workspaceId, dto.retentionDays, user.sub);
  }

  /**
   * GET /workspaces/:workspaceId/audit-log/gdpr/:userId
   *
   * GDPR Subject Access Request: returns all audit entries belonging to the
   * specified user. Requires OWNER role.
   */
  @Get('gdpr/:userId')
  @Roles('OWNER')
  async getSubjectData(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() _requester: JwtPayload,
  ) {
    // Log the SAR action
    await this.auditService.log(
      (await import('./audit.types')).AuditAction.GDPR_DATA_REQUESTED,
      requester.sub,
      workspaceId,
      { subjectUserId: userId },
      '',
      '',
    );

    return this.auditService.getSubjectData(userId, workspaceId);
  }

  /**
   * DELETE /workspaces/:workspaceId/audit-log/gdpr/:userId
   *
   * GDPR right-to-erasure: anonymises all entries for the given user.
   * Requires OWNER role.
   */
  @Put('gdpr/:userId/anonymize')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  async anonymizeUser(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() _requester: JwtPayload,
  ) {
    const count = await this.auditService.anonymizeUser(userId, workspaceId);
    return { anonymizedEntries: count, userId };
  }
}
