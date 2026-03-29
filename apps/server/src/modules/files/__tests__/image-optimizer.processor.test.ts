import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job } from 'bullmq';
import { ImageOptimizerProcessor } from '../image-optimizer.processor';
import { OPTIMIZE_IMAGE_JOB } from '../image-optimizer.constants';
import type { OptimizeImageJobData } from '../image-optimizer.types';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FilesService } from '../files.service';
import type { ImageOptimizerService } from '../image-optimizer.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATTACHMENT_ID = 'att-uuid-1';
const WORKSPACE_ID = 'ws-uuid-1';
const RELATIVE_PATH = '.attachments/note-1/photo.jpg';
const ABSOLUTE_PATH = `/var/notesaner/${WORKSPACE_ID}/${RELATIVE_PATH}`;

function makeJobData(overrides: Partial<OptimizeImageJobData> = {}): OptimizeImageJobData {
  return { attachmentId: ATTACHMENT_ID, ...overrides };
}

function makeJob(
  data: OptimizeImageJobData,
  overrides: Record<string, unknown> = {},
): Job<OptimizeImageJobData> {
  return {
    name: OPTIMIZE_IMAGE_JOB,
    data,
    ...overrides,
  } as unknown as Job<OptimizeImageJobData>;
}

function makePrisma() {
  return {
    attachment: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as unknown as Partial<PrismaService>;
}

function makeFilesService() {
  return {
    resolveSafePath: vi.fn((wsId: string, relPath: string) => `/var/notesaner/${wsId}/${relPath}`),
  } as unknown as Partial<FilesService>;
}

function makeImageOptimizer() {
  return {
    generateThumbnail: vi.fn(),
    convertToWebP: vi.fn(),
  } as unknown as Partial<ImageOptimizerService>;
}

function makeProcessor(
  prisma = makePrisma(),
  files = makeFilesService(),
  optimizer = makeImageOptimizer(),
) {
  return new ImageOptimizerProcessor(
    prisma as PrismaService,
    files as FilesService,
    optimizer as ImageOptimizerService,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImageOptimizerProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Routing ───────────────────────────────────────────────────────────────

  describe('process() routing', () => {
    it('throws for unknown job names', async () => {
      const processor = makeProcessor();
      const job = {
        name: 'unknown-job',
        data: makeJobData(),
      } as unknown as Job<OptimizeImageJobData>;

      await expect(processor.process(job)).rejects.toThrow('Unknown job name: unknown-job');
    });
  });

  // ─── Skip conditions ───────────────────────────────────────────────────────

  describe('skipping', () => {
    it('returns skipped=true when attachment is not found', async () => {
      const prisma = makePrisma();
      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue(null);

      const processor = makeProcessor(prisma);
      const result = await processor.process(makeJob(makeJobData()));

      expect(result.skipped).toBe(true);
      expect(result.attachmentId).toBe(ATTACHMENT_ID);
    });

    it('returns skipped=true for non-optimizable MIME types (e.g. PDF)', async () => {
      const prisma = makePrisma();
      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue({
        id: ATTACHMENT_ID,
        mimeType: 'application/pdf',
        path: RELATIVE_PATH,
        note: { workspaceId: WORKSPACE_ID },
      } as never);

      const processor = makeProcessor(prisma);
      const result = await processor.process(makeJob(makeJobData()));

      expect(result.skipped).toBe(true);
    });

    it('returns skipped=true for SVG (not a raster image)', async () => {
      const prisma = makePrisma();
      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue({
        id: ATTACHMENT_ID,
        mimeType: 'image/svg+xml',
        path: RELATIVE_PATH,
        note: { workspaceId: WORKSPACE_ID },
      } as never);

      const processor = makeProcessor(prisma);
      const result = await processor.process(makeJob(makeJobData()));

      expect(result.skipped).toBe(true);
    });
  });

  // ─── Successful optimization ───────────────────────────────────────────────

  describe('successful optimization', () => {
    function makeAttachment(mimeType = 'image/jpeg') {
      return {
        id: ATTACHMENT_ID,
        mimeType,
        path: RELATIVE_PATH,
        note: { workspaceId: WORKSPACE_ID },
      };
    }

    it('generates thumbnail sizes 150 and 300 plus WebP variant', async () => {
      const prisma = makePrisma();
      const files = makeFilesService();
      const optimizer = makeImageOptimizer();

      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue(makeAttachment() as never);
      vi.mocked(optimizer.generateThumbnail!).mockImplementation(async (_path, size) => ({
        outputPath: `${ABSOLUTE_PATH.replace('.jpg', '')}_thumb_${size}.webp`,
        size: 5_000,
      }));
      vi.mocked(optimizer.convertToWebP!).mockResolvedValue({
        outputPath: `${ABSOLUTE_PATH.replace('.jpg', '')}_optimized.webp`,
        size: 40_000,
      });

      const processor = makeProcessor(prisma, files, optimizer);
      const result = await processor.process(makeJob(makeJobData()));

      expect(result.skipped).toBe(false);
      expect(result.attachmentId).toBe(ATTACHMENT_ID);
      expect(optimizer.generateThumbnail).toHaveBeenCalledWith(ABSOLUTE_PATH, 150);
      expect(optimizer.generateThumbnail).toHaveBeenCalledWith(ABSOLUTE_PATH, 300);
      expect(optimizer.convertToWebP).toHaveBeenCalledWith(ABSOLUTE_PATH);
      expect(result.thumb150Path).toBeDefined();
      expect(result.thumb300Path).toBeDefined();
      expect(result.optimizedPath).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('persists the derived paths to the database via $executeRaw', async () => {
      const prisma = makePrisma();
      const files = makeFilesService();
      const optimizer = makeImageOptimizer();

      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue(makeAttachment() as never);
      vi.mocked(optimizer.generateThumbnail!).mockResolvedValue({
        outputPath: '/out/t.webp',
        size: 1,
      });
      vi.mocked(optimizer.convertToWebP!).mockResolvedValue({ outputPath: '/out/o.webp', size: 2 });

      const processor = makeProcessor(prisma, files, optimizer);
      await processor.process(makeJob(makeJobData()));

      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('processes PNG attachments the same way', async () => {
      const prisma = makePrisma();
      const files = makeFilesService();
      const optimizer = makeImageOptimizer();

      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue(
        makeAttachment('image/png') as never,
      );
      vi.mocked(optimizer.generateThumbnail!).mockResolvedValue({
        outputPath: '/out/t.webp',
        size: 1,
      });
      vi.mocked(optimizer.convertToWebP!).mockResolvedValue({ outputPath: '/out/o.webp', size: 2 });

      const processor = makeProcessor(prisma, files, optimizer);
      const result = await processor.process(makeJob(makeJobData()));

      expect(result.skipped).toBe(false);
    });
  });

  // ─── Error propagation ──────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('propagates sharp errors to BullMQ for retry', async () => {
      const prisma = makePrisma();
      const files = makeFilesService();
      const optimizer = makeImageOptimizer();

      vi.mocked(prisma.attachment!.findUnique).mockResolvedValue({
        id: ATTACHMENT_ID,
        mimeType: 'image/jpeg',
        path: RELATIVE_PATH,
        note: { workspaceId: WORKSPACE_ID },
      } as never);
      vi.mocked(optimizer.generateThumbnail!).mockRejectedValue(new Error('libvips crash'));

      const processor = makeProcessor(prisma, files, optimizer);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow('libvips crash');
    });
  });
});
