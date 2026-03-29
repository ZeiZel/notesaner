import { Injectable, Logger, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import * as fsPromises from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';

export interface ServeImageResult {
  stream: StreamableFile;
  contentType: string;
  filename: string;
  size: number;
}

/**
 * Serves optimized image derivatives (thumbnails and WebP variants) for
 * attachments, falling back to the original file when derivatives are not
 * yet available.
 *
 * This service is intentionally focused solely on streaming concerns, with
 * no optimization logic of its own. It reads the derived paths persisted by
 * ImageOptimizerProcessor and falls back gracefully when they are absent.
 */
@Injectable()
export class ImageServeService {
  private readonly logger = new Logger(ImageServeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── serveThumbnail ─────────────────────────────────────────────────────────

  /**
   * Serves the best available thumbnail:
   *  1. 300×300 WebP (`thumbnail_lg_path`)
   *  2. 150×150 WebP (`thumbnail_sm_path`)
   *  3. Original file (fallback when optimization has not yet run)
   */
  async serveThumbnail(attachmentId: string): Promise<ServeImageResult> {
    const row = await this.loadAttachmentRow(attachmentId);

    const candidates: Array<{ path: string | null; contentType: string; filename: string }> = [
      {
        path: row.thumbnailLgPath,
        contentType: 'image/webp',
        filename: `${this.basename(row.filename)}_thumb_300.webp`,
      },
      {
        path: row.thumbnailSmPath,
        contentType: 'image/webp',
        filename: `${this.basename(row.filename)}_thumb_150.webp`,
      },
      {
        path: row.absolutePath,
        contentType: row.mimeType,
        filename: row.filename,
      },
    ];

    return this.streamFirstAvailable(candidates, attachmentId);
  }

  // ─── serveOptimized ─────────────────────────────────────────────────────────

  /**
   * Serves the full-resolution optimized WebP variant, falling back to the
   * original file when optimization has not yet run.
   */
  async serveOptimized(attachmentId: string): Promise<ServeImageResult> {
    const row = await this.loadAttachmentRow(attachmentId);

    const candidates: Array<{ path: string | null; contentType: string; filename: string }> = [
      {
        path: row.optimizedPath,
        contentType: 'image/webp',
        filename: `${this.basename(row.filename)}_optimized.webp`,
      },
      {
        path: row.absolutePath,
        contentType: row.mimeType,
        filename: row.filename,
      },
    ];

    return this.streamFirstAvailable(candidates, attachmentId);
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private async loadAttachmentRow(attachmentId: string): Promise<{
    filename: string;
    mimeType: string;
    absolutePath: string;
    thumbnailSmPath: string | null;
    thumbnailLgPath: string | null;
    optimizedPath: string | null;
  }> {
    // Use a raw query to read the optional derived-path columns that may not
    // yet exist in the generated Prisma client (schema migration applied
    // separately from client regeneration in dev).
    const rows = await this.prisma.$queryRaw<
      Array<{
        filename: string;
        mime_type: string;
        absolute_path: string;
        thumbnail_sm_path: string | null;
        thumbnail_lg_path: string | null;
        optimized_path: string | null;
      }>
    >`
      SELECT
        a.filename,
        a.mime_type,
        a.path            AS absolute_path,
        a.thumbnail_sm_path,
        a.thumbnail_lg_path,
        a.optimized_path
      FROM attachments a
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    const row = rows[0];
    return {
      filename: row.filename,
      mimeType: row.mime_type,
      absolutePath: row.absolute_path,
      thumbnailSmPath: row.thumbnail_sm_path,
      thumbnailLgPath: row.thumbnail_lg_path,
      optimizedPath: row.optimized_path,
    };
  }

  /**
   * Tries each candidate in order, returning a stream for the first path
   * that exists on disk. The last candidate is always the original file, so
   * it is expected to exist — NotFoundException is thrown if it does not.
   */
  private async streamFirstAvailable(
    candidates: Array<{ path: string | null; contentType: string; filename: string }>,
    attachmentId: string,
  ): Promise<ServeImageResult> {
    for (const candidate of candidates) {
      if (!candidate.path) continue;

      try {
        const stat = await fsPromises.stat(candidate.path);
        const readStream = createReadStream(candidate.path);

        this.logger.debug(
          `Serving attachment ${attachmentId} from ${candidate.path} (${stat.size} bytes)`,
        );

        return {
          stream: new StreamableFile(readStream),
          contentType: candidate.contentType,
          filename: candidate.filename,
          size: stat.size,
        };
      } catch {
        // File does not exist on disk; try the next candidate
        this.logger.debug(`Path not available for attachment ${attachmentId}: ${candidate.path}`);
      }
    }

    throw new NotFoundException(`No file available on disk for attachment ${attachmentId}`);
  }

  /** Returns the filename without its extension. */
  private basename(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  }
}
