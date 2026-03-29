import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from './files.service';
import { ImageOptimizerService, OPTIMIZABLE_MIME_TYPES } from './image-optimizer.service';
import {
  IMAGE_OPTIMIZE_QUEUE,
  OPTIMIZE_IMAGE_JOB,
  IMAGE_OPTIMIZE_CONCURRENCY,
} from './image-optimizer.constants';
import type { OptimizeImageJobData, OptimizeImageJobResult } from './image-optimizer.types';

/**
 * BullMQ processor for the IMAGE_OPTIMIZE queue.
 *
 * On each job:
 *  1. Look up the attachment record to retrieve its workspace and disk path.
 *  2. Resolve the absolute filesystem path via FilesService.
 *  3. Generate a 150×150 and a 300×300 WebP thumbnail.
 *  4. Generate a full-resolution WebP optimized variant.
 *  5. Persist the derived paths back to the attachment record.
 *
 * If the attachment MIME type is not an optimizable raster image the job is
 * acknowledged as a no-op so the queue does not stall.
 */
@Processor(IMAGE_OPTIMIZE_QUEUE, {
  concurrency: IMAGE_OPTIMIZE_CONCURRENCY,
})
export class ImageOptimizerProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageOptimizerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly imageOptimizer: ImageOptimizerService,
  ) {
    super();
  }

  async process(job: Job<OptimizeImageJobData>): Promise<OptimizeImageJobResult> {
    if (job.name !== OPTIMIZE_IMAGE_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    return this.optimizeAttachment(job);
  }

  // ─── Core processing ────────────────────────────────────────────────────────

  private async optimizeAttachment(
    job: Job<OptimizeImageJobData>,
  ): Promise<OptimizeImageJobResult> {
    const { attachmentId } = job.data;
    const start = Date.now();

    this.logger.debug(`Starting image optimization for attachment ${attachmentId}`);

    // ── 1. Load attachment and workspace info ────────────────────────────────

    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        mimeType: true,
        path: true,
        note: { select: { workspaceId: true } },
      },
    });

    if (!attachment) {
      this.logger.warn(`Attachment ${attachmentId} not found — skipping optimization`);
      return { attachmentId, skipped: true, durationMs: Date.now() - start };
    }

    // ── 2. Guard: skip non-raster images ────────────────────────────────────

    if (!OPTIMIZABLE_MIME_TYPES.has(attachment.mimeType)) {
      this.logger.debug(
        `Attachment ${attachmentId} has MIME type "${attachment.mimeType}" — skipping`,
      );
      return { attachmentId, skipped: true, durationMs: Date.now() - start };
    }

    // ── 3. Resolve absolute path ─────────────────────────────────────────────

    const workspaceId = attachment.note.workspaceId;
    const absolutePath = this.filesService.resolveSafePath(workspaceId, attachment.path);

    // ── 4. Generate derivatives ──────────────────────────────────────────────

    const [thumb150Result, thumb300Result, webpResult] = await Promise.all([
      this.imageOptimizer.generateThumbnail(absolutePath, 150),
      this.imageOptimizer.generateThumbnail(absolutePath, 300),
      this.imageOptimizer.convertToWebP(absolutePath),
    ]);

    // ── 5. Persist derived paths to DB ────────────────────────────────────────
    // The attachment table exposes optional columns for the derived paths.
    // We use a raw update to avoid coupling this processor to Prisma model
    // regeneration when the migration hasn't yet been applied in all envs.

    await this.prisma.$executeRaw`
      UPDATE attachments
      SET
        thumbnail_sm_path  = ${this.filesService.resolveSafePath(workspaceId, thumb150Result.outputPath)},
        thumbnail_lg_path  = ${this.filesService.resolveSafePath(workspaceId, thumb300Result.outputPath)},
        optimized_path     = ${this.filesService.resolveSafePath(workspaceId, webpResult.outputPath)},
        optimized_at       = now()
      WHERE id = ${attachmentId}
    `;

    const durationMs = Date.now() - start;

    this.logger.log(
      `Optimized attachment ${attachmentId} in ${durationMs}ms — ` +
        `thumb_150: ${thumb150Result.size}B, thumb_300: ${thumb300Result.size}B, webp: ${webpResult.size}B`,
    );

    return {
      attachmentId,
      skipped: false,
      thumb150Path: thumb150Result.outputPath,
      thumb300Path: thumb300Result.outputPath,
      optimizedPath: webpResult.outputPath,
      durationMs,
    };
  }
}
