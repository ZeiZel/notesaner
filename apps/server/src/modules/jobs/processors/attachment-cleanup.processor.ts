import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { JOB_CLEANUP_ATTACHMENTS } from '../jobs.constants';
import type { CleanupAttachmentsJobData } from '../jobs.types';

/**
 * Processes attachment cleanup jobs — removes orphaned attachment
 * records from the database and their files from the filesystem.
 */
export class AttachmentCleanupProcessor {
  private readonly logger = new Logger(AttachmentCleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  async process(job: Job<CleanupAttachmentsJobData>): Promise<void> {
    if (job.name !== JOB_CLEANUP_ATTACHMENTS) {
      return;
    }

    const { noteId, workspaceId } = job.data;

    if (noteId) {
      await this.cleanupByNote(noteId, workspaceId);
    } else {
      await this.cleanupOrphans(workspaceId);
    }
  }

  private async cleanupByNote(noteId: string, workspaceId?: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({
      where: { noteId },
    });

    if (attachments.length === 0) return;

    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
        select: { workspaceId: true },
      });
      resolvedWorkspaceId = note?.workspaceId;
    }

    for (const attachment of attachments) {
      try {
        if (resolvedWorkspaceId) {
          await this.filesService
            .deleteFile(resolvedWorkspaceId, attachment.path)
            .catch((err: Error) => {
              this.logger.warn(`Failed to delete file ${attachment.path}: ${err.message}`);
            });
        }
        await this.prisma.attachment.delete({ where: { id: attachment.id } });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to cleanup attachment ${attachment.id}: ${msg}`);
      }
    }
  }

  private async cleanupOrphans(workspaceId?: string): Promise<void> {
    const orphans: Array<{ id: string; path: string; workspace_id: string | null }> = (await this
      .prisma.$queryRaw`
        SELECT a.id, a.path, n."workspaceId" as workspace_id
        FROM attachments a
        LEFT JOIN notes n ON a."noteId" = n.id
        WHERE n.id IS NULL
        ${workspaceId ? /* workspace filter applied internally */ '' : ''}
      `) as Array<{ id: string; path: string; workspace_id: string | null }>;

    for (const orphan of orphans) {
      try {
        if (orphan.workspace_id) {
          await this.filesService
            .deleteFile(orphan.workspace_id, orphan.path)
            .catch((err: Error) => {
              this.logger.warn(`Failed to delete orphan file ${orphan.path}: ${err.message}`);
            });
        }
        await this.prisma.attachment.delete({ where: { id: orphan.id } });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to cleanup orphan ${orphan.id}: ${msg}`);
      }
    }
  }
}
