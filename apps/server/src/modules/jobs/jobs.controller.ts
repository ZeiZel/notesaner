import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Admin controller for search indexing operations.
 * All endpoints require super-admin access (verified via JwtAuthGuard + isSuperAdmin).
 *
 * POST /admin/search/reindex/:workspaceId — enqueue a full workspace reindex
 * GET  /admin/search/jobs/:jobId          — poll job status
 */
@Controller('admin/search')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a full-text-search reindex for all notes in a workspace.
   *
   * POST /admin/search/reindex/:workspaceId
   */
  @Post('reindex/:workspaceId')
  @HttpCode(HttpStatus.ACCEPTED)
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

  /**
   * Poll the status of an indexing job.
   *
   * GET /admin/search/jobs/:jobId
   */
  @Get('jobs/:jobId')
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
