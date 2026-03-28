/**
 * AnalyticsController
 *
 * Public pixel endpoint and authenticated analytics dashboard.
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { PrismaService } from '../../prisma/prisma.service';

/** 1x1 transparent PNG -- minimal tracking pixel payload. */
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

@ApiTags('Analytics')
@Controller()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Public pixel endpoint ----

  @Public()
  @Post('p/:slug/*')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a page view (tracking pixel)',
    description:
      'Records a page view for a published note. Returns a 1x1 transparent PNG. ' +
      'No authentication required. Visitor identity is hashed (no cookies, no PII stored).',
  })
  @ApiParam({ name: 'slug', description: 'Public vault slug', type: String })
  @ApiOkResponse({ description: '1x1 transparent PNG tracking pixel.' })
  async recordView(
    @Param('slug') publicSlug: string,
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const notePath = params['0'] ?? '';

    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
    const visitorIp = rawIp ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? '';
    const referrer = req.headers.referer ?? req.headers.referrer ?? null;

    setImmediate(() => {
      void this.resolveAndRecord(
        publicSlug,
        notePath,
        visitorIp,
        userAgent,
        typeof referrer === 'string' ? referrer : null,
      );
    });

    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'image/png')
      .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      .setHeader('Pragma', 'no-cache')
      .end(TRACKING_PIXEL);
  }

  // ---- Authenticated analytics endpoints ----

  @Get('workspaces/:workspaceId/analytics')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get analytics summary',
    description:
      'Returns analytics summary for a workspace. Supports date range filtering and optional note-level scoping.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Analytics summary with total views, unique visitors, etc.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getAnalytics(workspaceId, query.dateRange ?? '30d', query.noteId);
  }

  @Get('workspaces/:workspaceId/analytics/daily')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get daily analytics data points',
    description: 'Returns daily stats for chart rendering.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Daily data points.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getDailyStats(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getDailyStats(workspaceId, query.dateRange ?? '30d', query.noteId);
  }

  @Get('workspaces/:workspaceId/analytics/top-notes')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get top notes by page views',
    description: 'Returns the top 20 notes by page views in the given date range.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'Top notes by views.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getTopNotes(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getTopNotes(workspaceId, 20, query.dateRange ?? '30d');
  }

  // ---- Private helpers ----

  private async resolveAndRecord(
    publicSlug: string,
    notePath: string,
    visitorIp: string,
    userAgent: string,
    referrer: string | null,
  ): Promise<void> {
    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { publicSlug, isPublic: true },
        select: { id: true },
      });

      if (!workspace) {
        return;
      }

      const lookupPath = notePath.endsWith('.md') ? notePath : `${notePath}.md`;

      const note = await this.prisma.note.findFirst({
        where: {
          workspaceId: workspace.id,
          path: lookupPath,
          isPublished: true,
          isTrashed: false,
        },
        select: { id: true },
      });

      if (!note) {
        return;
      }

      await this.analyticsService.recordPageView(
        workspace.id,
        note.id,
        visitorIp,
        userAgent,
        referrer,
      );
    } catch {
      // Silently discard -- analytics errors must not surface to users
    }
  }
}
