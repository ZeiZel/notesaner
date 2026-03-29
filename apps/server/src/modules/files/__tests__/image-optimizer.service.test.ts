import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// ─── Hoist mocks so vi.mock factory can reference them ───────────────────────

const { mockPipeline, sharpMock } = vi.hoisted(() => {
  const mockPipeline = {
    resize: vi.fn(),
    webp: vi.fn(),
    jpeg: vi.fn(),
    png: vi.fn(),
    toBuffer: vi.fn(),
    metadata: vi.fn(),
  };

  // Make each chainable method return `mockPipeline` itself
  mockPipeline.resize.mockReturnValue(mockPipeline);
  mockPipeline.webp.mockReturnValue(mockPipeline);
  mockPipeline.jpeg.mockReturnValue(mockPipeline);
  mockPipeline.png.mockReturnValue(mockPipeline);

  const sharpMock = vi.fn(() => mockPipeline);

  return { mockPipeline, sharpMock };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('sharp', () => ({ default: sharpMock }));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  stat: vi.fn(),
}));

import * as fsMock from 'fs/promises';
import { ImageOptimizerService, OPTIMIZABLE_MIME_TYPES } from '../image-optimizer.service';

// ─── Test data ────────────────────────────────────────────────────────────────

const ABSOLUTE_INPUT = '/var/notesaner/ws-1/.attachments/note-1/photo.jpg';
const FAKE_BUFFER = Buffer.from('fake-image-bytes');

function makeService(): ImageOptimizerService {
  return new ImageOptimizerService();
}

// ─── Helper: reset chainable mock return values after clearAllMocks ───────────

function resetPipelineChain(): void {
  mockPipeline.resize.mockReturnValue(mockPipeline);
  mockPipeline.webp.mockReturnValue(mockPipeline);
  mockPipeline.jpeg.mockReturnValue(mockPipeline);
  mockPipeline.png.mockReturnValue(mockPipeline);
  sharpMock.mockReturnValue(mockPipeline);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImageOptimizerService', () => {
  let service: ImageOptimizerService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPipelineChain();
    service = makeService();
  });

  // ─── OPTIMIZABLE_MIME_TYPES ────────────────────────────────────────────────

  describe('OPTIMIZABLE_MIME_TYPES', () => {
    it('includes common raster image types', () => {
      expect(OPTIMIZABLE_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(OPTIMIZABLE_MIME_TYPES.has('image/png')).toBe(true);
      expect(OPTIMIZABLE_MIME_TYPES.has('image/gif')).toBe(true);
      expect(OPTIMIZABLE_MIME_TYPES.has('image/webp')).toBe(true);
    });

    it('does NOT include non-raster types', () => {
      expect(OPTIMIZABLE_MIME_TYPES.has('application/pdf')).toBe(false);
      expect(OPTIMIZABLE_MIME_TYPES.has('image/svg+xml')).toBe(false);
    });
  });

  // ─── generateThumbnail ─────────────────────────────────────────────────────

  describe('generateThumbnail', () => {
    it('writes a 150×150 WebP thumbnail and returns the correct output path', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.generateThumbnail(ABSOLUTE_INPUT, 150);

      expect(sharpMock).toHaveBeenCalledWith(ABSOLUTE_INPUT);

      // resize with cover + 150×150
      expect(mockPipeline.resize).toHaveBeenCalledWith(150, 150, {
        fit: 'cover',
        position: 'centre',
      });

      // WebP output at quality 80
      expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 80 });

      // Output path ends with _thumb_150.webp and is in the same directory
      expect(result.outputPath).toMatch(/_thumb_150\.webp$/);
      expect(path.dirname(result.outputPath)).toBe(path.dirname(ABSOLUTE_INPUT));

      // File written to disk
      expect(fsMock.writeFile).toHaveBeenCalledWith(result.outputPath, FAKE_BUFFER);
      expect(result.size).toBe(FAKE_BUFFER.length);
    });

    it('writes a 300×300 WebP thumbnail and returns the correct output path', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.generateThumbnail(ABSOLUTE_INPUT, 300);

      expect(mockPipeline.resize).toHaveBeenCalledWith(
        300,
        300,
        expect.objectContaining({ fit: 'cover' }),
      );
      expect(result.outputPath).toMatch(/_thumb_300\.webp$/);
      expect(result.size).toBe(FAKE_BUFFER.length);
    });

    it('propagates sharp errors', async () => {
      mockPipeline.toBuffer.mockRejectedValue(new Error('libvips error'));

      await expect(service.generateThumbnail(ABSOLUTE_INPUT, 150)).rejects.toThrow('libvips error');
    });
  });

  // ─── convertToWebP ─────────────────────────────────────────────────────────

  describe('convertToWebP', () => {
    it('converts the image to WebP at quality 80 and returns the correct path', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.convertToWebP(ABSOLUTE_INPUT);

      expect(sharpMock).toHaveBeenCalledWith(ABSOLUTE_INPUT);
      expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 80 });

      // Output file must use _optimized suffix with .webp extension
      expect(result.outputPath).toMatch(/_optimized\.webp$/);
      expect(result.size).toBe(FAKE_BUFFER.length);
      expect(fsMock.writeFile).toHaveBeenCalledWith(result.outputPath, FAKE_BUFFER);
    });

    it('places the output file in the same directory as the input', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.convertToWebP(ABSOLUTE_INPUT);

      expect(path.dirname(result.outputPath)).toBe(path.dirname(ABSOLUTE_INPUT));
    });

    it('propagates sharp errors', async () => {
      mockPipeline.toBuffer.mockRejectedValue(new Error('unsupported format'));

      await expect(service.convertToWebP(ABSOLUTE_INPUT)).rejects.toThrow('unsupported format');
    });
  });

  // ─── optimizeImage ─────────────────────────────────────────────────────────

  describe('optimizeImage', () => {
    it('resizes within bounds and applies default JPEG quality 80', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.optimizeImage(ABSOLUTE_INPUT, {
        maxWidth: 1920,
        maxHeight: 1080,
      });

      expect(mockPipeline.resize).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(mockPipeline.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(result.outputPath).toMatch(/_optimized\.jpg$/);
    });

    it('does not call resize when no dimension constraints are given', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      await service.optimizeImage(ABSOLUTE_INPUT, { quality: 70 });

      expect(mockPipeline.resize).not.toHaveBeenCalled();
    });

    it('converts to WebP when format: "webp" is requested', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.optimizeImage(ABSOLUTE_INPUT, { format: 'webp', quality: 75 });

      expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 75 });
      expect(result.outputPath).toMatch(/_optimized\.webp$/);
    });

    it('converts to PNG when format: "png" is requested', async () => {
      mockPipeline.toBuffer.mockResolvedValue(FAKE_BUFFER);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.optimizeImage(ABSOLUTE_INPUT, { format: 'png' });

      expect(mockPipeline.png).toHaveBeenCalled();
      expect(result.outputPath).toMatch(/_optimized\.png$/);
    });

    it('returns the correct output size', async () => {
      const outputBuffer = Buffer.from('compressed-output');
      mockPipeline.toBuffer.mockResolvedValue(outputBuffer);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const result = await service.optimizeImage(ABSOLUTE_INPUT);

      expect(result.size).toBe(outputBuffer.length);
    });
  });

  // ─── getImageMetadata ──────────────────────────────────────────────────────

  describe('getImageMetadata', () => {
    it('returns dimensions, format, and file size', async () => {
      mockPipeline.metadata.mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg' });
      vi.mocked(fsMock.stat).mockResolvedValue({ size: 204_800 } as never);

      const meta = await service.getImageMetadata(ABSOLUTE_INPUT);

      expect(meta).toEqual({ width: 1920, height: 1080, format: 'jpeg', size: 204_800 });
    });

    it('throws when sharp metadata is incomplete', async () => {
      mockPipeline.metadata.mockResolvedValue({
        width: undefined,
        height: undefined,
        format: undefined,
      });
      vi.mocked(fsMock.stat).mockResolvedValue({ size: 1024 } as never);

      await expect(service.getImageMetadata(ABSOLUTE_INPUT)).rejects.toThrow(
        /Unable to read metadata/,
      );
    });

    it('propagates fs.stat errors', async () => {
      mockPipeline.metadata.mockResolvedValue({ width: 100, height: 100, format: 'png' });
      vi.mocked(fsMock.stat).mockRejectedValue(new Error('ENOENT'));

      await expect(service.getImageMetadata(ABSOLUTE_INPUT)).rejects.toThrow('ENOENT');
    });
  });
});
