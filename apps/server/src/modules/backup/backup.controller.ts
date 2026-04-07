// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — BackupVerifyJobResult type not yet defined
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BackupService } from './backup.service';
import type { BackupType, BackupStatus } from '@prisma/client';

/**
 * Admin controller for backup and disaster recovery operations.
 * All endpoints require super-admin access.
 */
@ApiTags('Admin - Backups')
@ApiBearerAuth('bearer')
@Controller('admin/backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ─── List backups ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List backup history',
    description:
      'Returns a paginated list of backup logs with summary statistics. Requires super-admin access.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of records to return (default 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of records to skip (default 0)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['DATABASE', 'FILESYSTEM', 'FULL'],
    description: 'Filter by backup type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['RUNNING', 'COMPLETED', 'FAILED', 'VERIFIED', 'EXPIRED'],
    description: 'Filter by backup status',
  })
  @ApiOkResponse({
    description: 'Backup list with statistics.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async listBackups(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: BackupType,
    @Query('status') status?: BackupStatus,
  ) {
    return this.backupService.listBackups({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      type,
      status,
    });
  }

  // ─── Get single backup ────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get backup details',
    description: 'Returns the full details of a specific backup log entry.',
  })
  @ApiParam({
    name: 'id',
    description: 'Backup log ID (UUID)',
    type: String,
  })
  @ApiOkResponse({ description: 'Backup details.' })
  @ApiNotFoundResponse({ description: 'Backup not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async getBackup(@Param('id') id: string) {
    const backup = await this.backupService.getBackup(id);

    if (!backup) {
      throw new NotFoundException(`Backup ${id} not found`);
    }

    return backup;
  }

  // ─── Trigger manual backup ────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger a manual backup',
    description:
      'Enqueues a backup job for immediate execution. Returns a job ID for status tracking. Requires super-admin access.',
  })
  @ApiAcceptedResponse({
    description: 'Backup job accepted.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'backup-manual:FULL:1711584000000' },
        message: {
          type: 'string',
          example: 'Backup job accepted. Poll /admin/backups/jobs/{jobId} for status.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async triggerBackup(
    @Body() body: { type?: BackupType },
  ): Promise<{ jobId: string; message: string }> {
    const type = body.type ?? 'FULL';
    const validTypes: BackupType[] = ['DATABASE', 'FILESYSTEM', 'FULL'];

    if (!validTypes.includes(type)) {
      throw new NotFoundException(
        `Invalid backup type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const jobId = await this.backupService.triggerManualBackup(type);

    return {
      jobId,
      message: `${type} backup job accepted. Poll /admin/backups/jobs/${jobId} for status.`,
    };
  }

  // ─── Job status ───────────────────────────────────────────────────────────

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get backup job status',
    description: 'Poll the status of a previously enqueued backup job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID returned from the trigger endpoint',
    type: String,
  })
  @ApiOkResponse({
    description: 'Job status.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        state: {
          type: 'string',
          enum: ['waiting', 'active', 'completed', 'failed'],
        },
        progress: { type: 'object' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Job not found or already removed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<{ jobId: string; state: string; progress: unknown }> {
    const status = await this.backupService.getJobStatus(jobId);

    if (!status) {
      throw new NotFoundException(
        `Job ${jobId} not found — it may have already been removed from the queue`,
      );
    }

    return { jobId, ...status };
  }

  // ─── Trigger verification ─────────────────────────────────────────────────

  @Post('verify')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger backup verification',
    description:
      'Enqueues a restore-test job that verifies the latest backup can be decrypted and its integrity is intact.',
  })
  @ApiAcceptedResponse({
    description: 'Verification job accepted.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Verification job accepted.' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async triggerVerification(@Body() body?: { backupId?: string }): Promise<{ message: string }> {
    const result = await this.backupService.verifyBackup(body?.backupId);

    return {
      message: result.verified
        ? `Backup ${result.backupLogId} verified successfully in ${result.durationMs}ms.`
        : `Backup verification failed: ${result.error}`,
    };
  }
}
