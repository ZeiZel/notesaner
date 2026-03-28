/**
 * AnalyticsController
 *
 * Exposes two endpoints:
 *
 * 1. POST /p/:slug/:notePath/view  — Public pixel endpoint (no auth).
 *    Called by published-note pages to record a view. Returns a 1×1 transparent
 *    PNG so it can optionally be loaded as an <img src> tracking pixel.
 *    Rate-limited via the global ThrottlerGuard.
 *
 * 2. GET /workspaces/:workspaceId/analytics  — Authenticated analytics dashboard.
 *    Returns aggregated stats for the workspace owner.
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
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { PrismaService } from '../../prisma/prisma.service';

/** 1×1 transparent PNG — minimal tracking pixel payload. */
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Public pixel endpoint ─────────────────────────────────────────────────

  /**
   * POST /p/:slug/*
   *
   * Records a page view for the published note identified by `slug` and the
   * wildcard note path. No authentication required.
   *
   * The endpoint:
   * - Returns a 1×1 transparent PNG (HTTP 200) so it can serve as a pixel
   * - Resolves the workspace by publicSlug to obtain the workspaceId
   * - Looks up the note by path to obtain the noteId
   * - Fires-and-forgets the analytics write (errors do not affect the response)
   *
   * Privacy:
   * - IP is read from X-Forwarded-For or socket remoteAddress
   * - Visitor identity is SHA-256(ip + ua + daily-date) — no cookies, no PII stored
   */
  @Public()
  @Post('p/:slug/*')
  @HttpCode(HttpStatus.OK)
  async recordView(
    @Param('slug') publicSlug: string,
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const notePath = params['0'] ?? '';

    // Extract visitor IP — prefer forwarded header set by a trusted reverse proxy
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
    const visitorIp = rawIp ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? '';
    const referrer = req.headers.referer ?? req.headers.referrer ?? null;

    // Resolve workspace and note asynchronously — do not block the response
    setImmediate(() => {
      void this.resolveAndRecord(
        publicSlug,
        notePath,
        visitorIp,
        userAgent,
        typeof referrer === 'string' ? referrer : null,
      );
    });

    // Return tracking pixel immediately
    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'image/png')
      .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      .setHeader('Pragma', 'no-cache')
      .end(TRACKING_PIXEL);
  }

  // ─── Authenticated analytics endpoint ─────────────────────────────────────

  /**
   * GET /workspaces/:workspaceId/analytics
   *
   * Returns analytics summary for the authenticated workspace owner.
   *
   * Query params (all optional):
   * - dateRange: '7d' | '30d' | '90d' | 'all'  (default '30d')
   * - noteId: UUID to scope to a single note
   */
  @Get('workspaces/:workspaceId/analytics')
  async getAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getAnalytics(workspaceId, query.dateRange ?? '30d', query.noteId);
  }

  /**
   * GET /workspaces/:workspaceId/analytics/daily
   *
   * Returns daily stats data points for chart rendering.
   * Useful for a dedicated chart fetch without the full summary.
   */
  @Get('workspaces/:workspaceId/analytics/daily')
  async getDailyStats(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getDailyStats(workspaceId, query.dateRange ?? '30d', query.noteId);
  }

  /**
   * GET /workspaces/:workspaceId/analytics/top-notes
   *
   * Returns top N notes by page views in the given date range.
   */
  @Get('workspaces/:workspaceId/analytics/top-notes')
  async getTopNotes(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.analyticsService.getTopNotes(workspaceId, 20, query.dateRange ?? '30d');
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolve workspace + note IDs from the public slug and note path, then
   * forward to AnalyticsService.recordPageView.
   *
   * All errors are swallowed — analytics must never break the public reader.
   */
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
      // Silently discard — analytics errors must not surface to users
    }
  }
}
