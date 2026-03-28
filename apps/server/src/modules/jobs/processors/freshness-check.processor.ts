import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { FreshnessService } from '../../notes/freshness.service';
import { FRESHNESS_CHECK_JOB, FRESHNESS_CHECK_QUEUE } from '../jobs.constants';
import type {
  FreshnessCheckJobData,
  FreshnessCheckJobResult,
  OwnerStaleNoteSummary,
} from '../jobs.types';

/**
 * BullMQ processor for daily freshness (staleness) checks.
 *
 * Runs on a cron schedule (configured in JobsModule) and:
 *   1. Iterates over all workspaces (or a single workspace if specified).
 *   2. Finds stale notes using FreshnessService.getStaleNotes().
 *   3. Groups stale notes by owner.
 *   4. Sends a single freshness-alert email per owner with their stale notes.
 *
 * This replaces the EventEmitter-based approach with durable, queue-backed
 * processing that survives server restarts.
 */
@Processor(FRESHNESS_CHECK_QUEUE)
export class FreshnessCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(FreshnessCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freshnessService: FreshnessService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<FreshnessCheckJobData>): Promise<FreshnessCheckJobResult> {
    if (job.name !== FRESHNESS_CHECK_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    return this.processFreshnessCheck(job);
  }

  private async processFreshnessCheck(
    job: Job<FreshnessCheckJobData>,
  ): Promise<FreshnessCheckJobResult> {
    const start = Date.now();
    const { workspaceId } = job.data;

    this.logger.log(
      workspaceId
        ? `Starting freshness check for workspace ${workspaceId}`
        : 'Starting daily freshness check for all workspaces',
    );

    // Determine which workspaces to check
    const workspaces = await this.getWorkspaces(workspaceId);

    let totalStaleNotes = 0;
    let totalEmailsQueued = 0;

    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];

      try {
        const { staleCount, emailCount } = await this.checkWorkspace(ws);
        totalStaleNotes += staleCount;
        totalEmailsQueued += emailCount;
      } catch (err) {
        this.logger.error(
          `Freshness check failed for workspace ${ws.id} (${ws.name}): ${String(err)}`,
        );
      }

      // Report progress
      await job.updateProgress(Math.round(((i + 1) / workspaces.length) * 100));
    }

    const durationMs = Date.now() - start;

    this.logger.log(
      `Freshness check complete: ${workspaces.length} workspace(s), ` +
        `${totalStaleNotes} stale note(s), ${totalEmailsQueued} email(s) in ${durationMs}ms`,
    );

    return {
      workspacesChecked: workspaces.length,
      staleNotesFound: totalStaleNotes,
      emailsQueued: totalEmailsQueued,
      durationMs,
    };
  }

  /**
   * Fetch the workspace(s) to check. Either a single workspace or all active ones.
   */
  private async getWorkspaces(
    workspaceId?: string,
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    if (workspaceId) {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, slug: true },
      });
      return ws ? [ws] : [];
    }

    return this.prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Check a single workspace for stale notes, group by owner, and send email alerts.
   */
  private async checkWorkspace(ws: {
    id: string;
    name: string;
    slug: string;
  }): Promise<{ staleCount: number; emailCount: number }> {
    const staleNotes = await this.freshnessService.getStaleNotes(ws.id, 'stale');

    if (staleNotes.length === 0) {
      return { staleCount: 0, emailCount: 0 };
    }

    this.logger.debug(`Workspace "${ws.name}" has ${staleNotes.length} stale note(s)`);

    // Group stale notes by owner
    const byOwner = new Map<string, OwnerStaleNoteSummary>();

    for (const note of staleNotes) {
      const ownerId = note.ownerId;
      if (!ownerId) continue; // Cannot notify if no owner

      if (!byOwner.has(ownerId)) {
        byOwner.set(ownerId, {
          ownerId,
          ownerEmail: '', // Resolved below
          ownerDisplayName: '',
          workspaceName: ws.name,
          workspaceId: ws.id,
          notes: [],
        });
      }

      (byOwner.get(ownerId) as NonNullable<ReturnType<typeof byOwner.get>>).notes.push({
        noteId: note.noteId,
        title: note.title,
        path: note.path,
        ageInDays: note.ageInDays,
      });
    }

    // Resolve owner user details in a single query
    const ownerIds = Array.from(byOwner.keys());

    if (ownerIds.length === 0) {
      // All stale notes lack an owner — no one to notify
      return { staleCount: staleNotes.length, emailCount: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ownerIds }, isActive: true },
      select: { id: true, email: true, displayName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Send email notifications
    let emailCount = 0;
    const { staleThresholdDays } = await this.freshnessService.resolveThresholds(ws.id);

    for (const [ownerId, summary] of byOwner.entries()) {
      const user = userMap.get(ownerId);
      if (!user) {
        this.logger.debug(`Skipping notification for owner ${ownerId}: user not found or inactive`);
        continue;
      }

      summary.ownerEmail = user.email;
      summary.ownerDisplayName = user.displayName;

      try {
        await this.emailService.send({
          to: user.email,
          template: 'freshness-alert',
          variables: {
            displayName: user.displayName,
            workspaceName: ws.name,
            staleDays: staleThresholdDays,
            workspaceUrl: `/workspaces/${ws.slug}`,
            notes: summary.notes.map((n) => ({
              title: n.title,
              url: `/workspaces/${ws.slug}/notes/${n.noteId}`,
              lastUpdated: `${n.ageInDays} days ago`,
            })),
          },
        });

        emailCount++;
        this.logger.debug(
          `Sent freshness alert to ${user.email} for ${summary.notes.length} stale note(s) in "${ws.name}"`,
        );
      } catch (err) {
        this.logger.error(`Failed to send freshness alert to ${user.email}: ${String(err)}`);
      }
    }

    // Also emit events on the FreshnessService for any listeners
    await this.freshnessService.emitStaleNotifications(ws.id);

    return { staleCount: staleNotes.length, emailCount };
  }
}
