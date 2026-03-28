import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Admin controller for search indexing operations.
 * All endpoints require super-admin access.
 */
@ApiTags('Admin - Search Jobs')
@ApiBearerAuth('bearer')
@Controller('admin/search')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('reindex/:workspaceId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue a workspace reindex job',
    description:
      'Enqueues a full-text-search reindex for all notes in a workspace. Requires super-admin access.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiAcceptedResponse({
    description: 'Reindex job accepted.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'job_abc123' },
        message: { type: 'string', example: 'Reindex job accepted for workspace "My Workspace".' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async reindexWorkspace(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ jobId: string; message: string }> {
    // Verify workspace exists before accepting the job
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    const jobId = await this.jobsService.scheduleWorkspaceReindex(workspaceId);

    return {
      jobId,
      message: `Reindex job accepted for workspace "${workspace.name}". Poll /admin/search/jobs/${jobId} for status.`,
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get indexing job status',
    description: 'Poll the status of a previously enqueued indexing job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID returned from the reindex endpoint',
    type: String,
  })
  @ApiOkResponse({
    description: 'Job status.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'job_abc123' },
        state: {
          type: 'string',
          enum: ['waiting', 'active', 'completed', 'failed'],
          example: 'completed',
        },
        progress: { type: 'object', example: { processed: 150, total: 150 } },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Job not found or already removed from queue.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Requires super admin privileges.' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<{ jobId: string; state: string; progress: unknown }> {
    const status = await this.jobsService.getJobStatus(jobId);

    if (!status) {
      throw new NotFoundException(
        `Job ${jobId} not found — it may have already been removed from the queue`,
      );
    }

    return { jobId, ...status };
  }
}
