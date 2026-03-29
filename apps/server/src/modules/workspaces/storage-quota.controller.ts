import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Audited } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditAction } from '../audit/audit.types';
import { StorageQuotaService } from './storage-quota.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class SetWorkspaceLimitsDto {
  @ApiPropertyOptional({
    description: 'Max storage in bytes (string for BigInt). Pass null to reset to system default.',
    example: '10737418240',
  })
  maxStorageBytes?: string | null;

  @ApiPropertyOptional({
    description: 'Max note count. Pass null to reset to system default.',
    example: 100000,
  })
  maxNotes?: number | null;

  @ApiPropertyOptional({
    description:
      'Max single file size in bytes (string for BigInt). Pass null to reset to system default.',
    example: '104857600',
  })
  maxFileSizeBytes?: string | null;
}

class TriggerRecalculationDto {
  @ApiPropertyOptional({
    description: 'Workspace ID to recalculate. Omit for all workspaces.',
  })
  workspaceId?: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Storage Quota')
@ApiBearerAuth('bearer')
@Controller('workspaces')
@UseInterceptors(AuditInterceptor)
export class StorageQuotaController {
  constructor(private readonly storageQuotaService: StorageQuotaService) {}

  @Get(':workspaceId/storage')
  @UseGuards(RolesGuard)
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @ApiOperation({
    summary: 'Get workspace storage statistics and quota',
    description:
      'Returns current storage usage (notes, attachments, versions), configured limits, ' +
      'and quota percentage for the visual progress bar. ' +
      'When usage is at or above 80%, a X-Quota-Warning header is included.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Storage statistics and quota information.' })
  @ApiHeader({
    name: 'X-Quota-Warning',
    description: 'Present when storage usage exceeds warning threshold (80%)',
    required: false,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getStorageStats(
    @Param('workspaceId') workspaceId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const stats = await this.storageQuotaService.getStorageStats(workspaceId);

    // Set quota warning header when approaching limits
    if (stats.quota.isStorageWarning || stats.quota.isNoteWarning) {
      const warnings: string[] = [];
      if (stats.quota.isStorageWarning) {
        warnings.push(`storage ${stats.quota.storageUsedPercent}%`);
      }
      if (stats.quota.isNoteWarning) {
        warnings.push(`notes ${stats.quota.noteUsedPercent}%`);
      }
      res.setHeader('X-Quota-Warning', warnings.join(', '));
    }

    return stats;
  }

  @Put(':workspaceId/storage/limits')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Audited(AuditAction.STORAGE_QUOTA_CHANGED)
  @ApiOperation({
    summary: 'Set per-workspace storage limits (admin override)',
    description:
      'Override system-default storage limits for a specific workspace. ' +
      'Pass null for any field to revert to system defaults. Requires super-admin privileges.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: SetWorkspaceLimitsDto })
  @ApiOkResponse({ description: 'Workspace limits updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Super-admin access required.' })
  async setWorkspaceLimits(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SetWorkspaceLimitsDto,
  ) {
    await this.storageQuotaService.setWorkspaceLimits(workspaceId, {
      maxStorageBytes:
        dto.maxStorageBytes === null
          ? null
          : dto.maxStorageBytes !== undefined
            ? BigInt(dto.maxStorageBytes)
            : undefined,
      maxNotes: dto.maxNotes,
      maxFileSizeBytes:
        dto.maxFileSizeBytes === null
          ? null
          : dto.maxFileSizeBytes !== undefined
            ? BigInt(dto.maxFileSizeBytes)
            : undefined,
    });

    return { message: 'Workspace storage limits updated' };
  }

  @Post('storage/recalculate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary: 'Trigger storage recalculation (admin)',
    description:
      'Triggers a full storage recalculation for one or all workspaces. ' +
      'Normally this runs daily via cron at 03:00 UTC. Requires super-admin privileges.',
  })
  @ApiBody({ type: TriggerRecalculationDto })
  @ApiOkResponse({ description: 'Recalculation completed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Super-admin access required.' })
  async triggerRecalculation(@Body() dto: TriggerRecalculationDto) {
    if (dto.workspaceId) {
      await this.storageQuotaService.recalculate(dto.workspaceId);
      return { message: `Recalculation completed for workspace ${dto.workspaceId}` };
    }

    const result = await this.storageQuotaService.recalculateAll();
    return {
      message: `Recalculation completed for ${result.workspacesProcessed} workspaces`,
      errors: result.errors,
    };
  }
}
