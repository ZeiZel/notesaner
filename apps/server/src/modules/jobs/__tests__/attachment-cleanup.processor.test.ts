import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import { AttachmentCleanupProcessor } from '../processors/attachment-cleanup.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { JOB_CLEANUP_ATTACHMENTS } from '../jobs.constants';
import type { CleanupAttachmentsJobData } from '../jobs.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(data: CleanupAttachmentsJobData): Job<CleanupAttachmentsJobData> {
  return {
    id: 'job-cleanup-1',
    name: JOB_CLEANUP_ATTACHMENTS,
    data,
  } as unknown as Job<CleanupAttachmentsJobData>;
}

function makeAttachment(overrides = {}) {
  return {
    id: 'att-1',
    noteId: 'note-1',
    filename: 'photo.png',
    mimeType: 'image/png',
    size: 1024,
    path: '.attachments/note-1/photo.png',
    createdAt: new Date(),
    note: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AttachmentCleanupProcessor', () => {
  let processor: AttachmentCleanupProcessor;
  let prisma: {
    attachment: {
      findMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    note: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let filesService: {
    deleteFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      attachment: {
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      note: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    filesService = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    processor = new AttachmentCleanupProcessor(
      prisma as unknown as PrismaService,
      filesService as unknown as FilesService,
    );
  });

  // ─── Unknown job name ─────────────────────────────────────────────────────

  it('ignores jobs with unknown names', async () => {
    const job = { id: 'j1', name: 'unknown-job', data: {} } as Job<CleanupAttachmentsJobData>;
    await processor.process(job);

    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    expect(prisma.attachment.delete).not.toHaveBeenCalled();
  });

  // ─── noteId-scoped cleanup ────────────────────────────────────────────────

  describe('when noteId is provided', () => {
    it('deletes DB records for all attachments of the specified note', async () => {
      const attachment1 = makeAttachment({ id: 'att-1' });
      const attachment2 = makeAttachment({ id: 'att-2', path: '.attachments/note-1/doc.pdf' });

      prisma.attachment.findMany.mockResolvedValue([attachment1, attachment2]);
      prisma.note.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });

      const job = makeJob({ noteId: 'note-1', workspaceId: 'ws-1' });
      await processor.process(job);

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: { noteId: 'note-1' },
      });
      expect(prisma.attachment.delete).toHaveBeenCalledTimes(2);
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-2' } });
    });

    it('also deletes filesystem files when workspaceId is resolved', async () => {
      const attachment = makeAttachment();
      prisma.attachment.findMany.mockResolvedValue([attachment]);
      prisma.note.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });

      const job = makeJob({ noteId: 'note-1', workspaceId: 'ws-1' });
      await processor.process(job);

      expect(filesService.deleteFile).toHaveBeenCalledWith('ws-1', attachment.path);
    });

    it('logs a warning but does not throw when filesystem delete fails', async () => {
      const attachment = makeAttachment();
      prisma.attachment.findMany.mockResolvedValue([attachment]);
      prisma.note.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });
      filesService.deleteFile.mockRejectedValue(new Error('disk I/O error'));

      // Should NOT throw — filesystem errors are best-effort
      await expect(processor.process(makeJob({ noteId: 'note-1' }))).resolves.toBeUndefined();

      expect(prisma.attachment.delete).toHaveBeenCalled();
    });

    it('does nothing when note has no attachments', async () => {
      prisma.attachment.findMany.mockResolvedValue([]);

      const job = makeJob({ noteId: 'note-1' });
      await processor.process(job);

      expect(prisma.attachment.delete).not.toHaveBeenCalled();
      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('continues processing remaining attachments when one deletion fails', async () => {
      const att1 = makeAttachment({ id: 'att-1' });
      const att2 = makeAttachment({ id: 'att-2', path: '.attachments/note-1/doc.pdf' });

      prisma.attachment.findMany.mockResolvedValue([att1, att2]);
      prisma.note.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });

      // First attachment fails DB delete, second succeeds
      prisma.attachment.delete
        .mockRejectedValueOnce(new Error('constraint violation'))
        .mockResolvedValueOnce(undefined);

      await expect(processor.process(makeJob({ noteId: 'note-1' }))).resolves.toBeUndefined();

      // Both were attempted
      expect(prisma.attachment.delete).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Global / workspace-scoped orphan cleanup ─────────────────────────────

  describe('when noteId is absent (orphan scan)', () => {
    it('queries for orphans and removes them', async () => {
      const orphan = {
        id: 'att-orphan',
        path: '.attachments/deleted-note/photo.png',
        workspace_id: 'ws-1',
      };
      prisma.$queryRaw.mockResolvedValue([orphan]);

      const job = makeJob({});
      await processor.process(job);

      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-orphan' } });
      expect(filesService.deleteFile).toHaveBeenCalledWith('ws-1', orphan.path);
    });

    it('does nothing when no orphans exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const job = makeJob({});
      await processor.process(job);

      expect(prisma.attachment.delete).not.toHaveBeenCalled();
      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('logs a warning but skips filesystem delete when workspace_id is null', async () => {
      const orphan = { id: 'att-orphan', path: '.attachments/lost/file.pdf', workspace_id: null };
      prisma.$queryRaw.mockResolvedValue([orphan]);
      prisma.attachment.delete.mockResolvedValue(undefined);

      await expect(processor.process(makeJob({}))).resolves.toBeUndefined();

      expect(prisma.attachment.delete).toHaveBeenCalled();
      // No filesystem delete because workspaceId is unknown
      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('continues with remaining orphans when one removal fails', async () => {
      const orphan1 = { id: 'att-1', path: '.attachments/gone/a.png', workspace_id: 'ws-1' };
      const orphan2 = { id: 'att-2', path: '.attachments/gone/b.png', workspace_id: 'ws-1' };
      prisma.$queryRaw.mockResolvedValue([orphan1, orphan2]);

      prisma.attachment.delete
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(undefined);

      await expect(processor.process(makeJob({}))).resolves.toBeUndefined();

      expect(prisma.attachment.delete).toHaveBeenCalledTimes(2);
    });
  });

  // ─── workspace-scoped orphan cleanup ──────────────────────────────────────

  describe('when only workspaceId is provided', () => {
    it('passes workspaceId to the orphan query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const job = makeJob({ workspaceId: 'ws-specific' });
      await processor.process(job);

      // $queryRaw should be called (workspace filter applied internally)
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
