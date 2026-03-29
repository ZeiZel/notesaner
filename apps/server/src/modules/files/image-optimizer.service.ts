import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import sharp from 'sharp';

// ─── Public types ────────────────────────────────────────────────────────────

export type ThumbnailSize = 150 | 300;

export interface OptimizeOptions {
  /** Maximum width in pixels. Aspect ratio is preserved. */
  maxWidth?: number;
  /** Maximum height in pixels. Aspect ratio is preserved. */
  maxHeight?: number;
  /** JPEG/WebP quality 1–100. Defaults to 80. */
  quality?: number;
  /** Output format. Defaults to preserving the original format. */
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  /** File size in bytes. */
  size: number;
}

export interface OptimizeResult {
  /** Absolute path of the output file. */
  outputPath: string;
  /** Size of the written file in bytes. */
  size: number;
}

// ─── Set of MIME types that are raster images we can process with sharp ──────

export const OPTIMIZABLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // AVIF and TIFF are also supported by sharp but not in our upload whitelist
]);

/**
 * Service for image optimization operations backed by the `sharp` library.
 *
 * Responsibilities:
 *  - Resize / compress / convert images
 *  - Generate fixed-size thumbnails (150×150 and 300×300, object-fit: cover)
 *  - Convert images to WebP with a fixed quality of 80
 *  - Read image metadata (dimensions, format, file size)
 *
 * All methods accept absolute file paths and write output to the same
 * directory as the source file using a deterministic suffix so callers can
 * rely on predictable paths without receiving them back.
 *
 * This service is intentionally side-effect free outside the filesystem and
 * has no database dependencies — it can be used independently or driven by a
 * BullMQ processor.
 */
@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  // ─── optimizeImage ──────────────────────────────────────────────────────────

  /**
   * Resizes and/or compresses an image according to the given options,
   * writing the result to a sibling file with an `_optimized` suffix.
   *
   * @param inputPath  Absolute path to the source image.
   * @param options    Resize/quality/format options.
   * @returns          Path and size of the written output file.
   */
  async optimizeImage(inputPath: string, options: OptimizeOptions = {}): Promise<OptimizeResult> {
    const { maxWidth, maxHeight, quality = 80, format } = options;

    const ext = format ? `.${format}` : path.extname(inputPath);
    const outputPath = this.buildOutputPath(inputPath, '_optimized', ext);

    let pipeline = sharp(inputPath);

    if (maxWidth !== undefined || maxHeight !== undefined) {
      pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    pipeline = this.applyOutputFormat(pipeline, format ?? this.extToFormat(ext), quality);

    const outputBuffer = await pipeline.toBuffer();
    await fsPromises.writeFile(outputPath, outputBuffer);

    this.logger.debug(`optimizeImage: ${inputPath} → ${outputPath} (${outputBuffer.length} bytes)`);

    return { outputPath, size: outputBuffer.length };
  }

  // ─── generateThumbnail ──────────────────────────────────────────────────────

  /**
   * Generates a square thumbnail of `size×size` pixels using object-fit:cover
   * semantics (crops from centre). The output file gets a `_thumb_<size>`
   * suffix and is written as WebP for efficient delivery.
   *
   * @param inputPath  Absolute path to the source image.
   * @param size       Thumbnail edge length in pixels (150 or 300).
   * @returns          Path and size of the written thumbnail file.
   */
  async generateThumbnail(inputPath: string, size: ThumbnailSize): Promise<OptimizeResult> {
    const outputPath = this.buildOutputPath(inputPath, `_thumb_${size}`, '.webp');

    const outputBuffer = await sharp(inputPath)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();

    await fsPromises.writeFile(outputPath, outputBuffer);

    this.logger.debug(
      `generateThumbnail(${size}): ${inputPath} → ${outputPath} (${outputBuffer.length} bytes)`,
    );

    return { outputPath, size: outputBuffer.length };
  }

  // ─── convertToWebP ─────────────────────────────────────────────────────────

  /**
   * Converts an image to WebP at quality 80, writing a sibling file with a
   * `.webp` extension. If the source is already WebP the conversion still runs
   * so the quality target is consistently applied.
   *
   * @param inputPath  Absolute path to the source image.
   * @returns          Path and size of the written WebP file.
   */
  async convertToWebP(inputPath: string): Promise<OptimizeResult> {
    const outputPath = this.buildOutputPath(inputPath, '_optimized', '.webp');

    const outputBuffer = await sharp(inputPath).webp({ quality: 80 }).toBuffer();

    await fsPromises.writeFile(outputPath, outputBuffer);

    this.logger.debug(`convertToWebP: ${inputPath} → ${outputPath} (${outputBuffer.length} bytes)`);

    return { outputPath, size: outputBuffer.length };
  }

  // ─── getImageMetadata ───────────────────────────────────────────────────────

  /**
   * Reads image dimensions, format, and current file size without decoding
   * the full pixel buffer.
   *
   * @param inputPath  Absolute path to the source image.
   * @returns          Metadata for the image at `inputPath`.
   * @throws           Error if `inputPath` is not a supported image file.
   */
  async getImageMetadata(inputPath: string): Promise<ImageMetadata> {
    const [meta, stat] = await Promise.all([
      sharp(inputPath).metadata(),
      fsPromises.stat(inputPath),
    ]);

    if (meta.width === undefined || meta.height === undefined || !meta.format) {
      throw new Error(`Unable to read metadata for image at ${inputPath}`);
    }

    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: stat.size,
    };
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Builds a sibling output path:
   *   `/path/to/image.png` + `_optimized` + `.webp` → `/path/to/image_optimized.webp`
   */
  private buildOutputPath(inputPath: string, suffix: string, ext: string): string {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${base}${suffix}${ext}`);
  }

  /**
   * Maps a file extension string (e.g. `.png`) to a format key.
   * Falls back to `'jpeg'` for any unknown extension.
   */
  private extToFormat(ext: string): OptimizeOptions['format'] {
    const normalized = ext.toLowerCase().replace('.', '');
    if (normalized === 'png') return 'png';
    if (normalized === 'webp') return 'webp';
    return 'jpeg';
  }

  /**
   * Applies the appropriate sharp output format method.
   */
  private applyOutputFormat(
    pipeline: sharp.Sharp,
    format: OptimizeOptions['format'],
    quality: number,
  ): sharp.Sharp {
    switch (format) {
      case 'png':
        // PNG quality maps to compressionLevel 0-9 (inverse of quality)
        return pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) });
      case 'webp':
        return pipeline.webp({ quality });
      case 'jpeg':
      default:
        return pipeline.jpeg({ quality });
    }
  }
}
