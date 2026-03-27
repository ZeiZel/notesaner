import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentService, ALLOWED_MIME_TYPES } from '../attachment.service';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs', () => ({
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
}));

import * as fsMock from 'fs/promises';
import * as fsSync from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-test';
const NOTE_ID = 'note-uuid-1';
const ATTACHMENT_ID = 'att-uuid-1';
const STORAGE_ROOT = '/var/notesaner';

function makeConfigService(maxMb = 50): ConfigService {
  return {
    get: vi.fn((key: string, opts?: { infer?: boolean }) => {
      if (key === 'upload.maxFileSizeMb') return maxMb;
      if (key === 'storage.root') return STORAGE_ROOT;
      return undefined;
    }),
  } as unknown as ConfigService;
}

function makeFilesService() {
  return {
    resolveSafePath: vi.fn((wsId: string, relPath: string) =>
      `${STORAGE_ROOT}/${wsId}/${relPath}`,
    ),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  };
}

function makePrismaService() {
  return {
    note: {
      findUnique: vi.fn(),
    },
    attachment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

function makeAttachmentRecord(overrides = {}) {
  return {
    id: ATTACHMENT_ID,
    noteId: NOTE_ID,
    filename: 'test-image.png',
    mimeType: 'image/png',
    size: 1024,
    path: `.attachments/${NOTE_ID}/test-image.png`,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeService(prisma?: ReturnType<typeof makePrismaService>, maxMb = 50) {
  const prismaService = prisma ?? makePrismaService();
  const filesService = makeFilesService();
  const configService = makeConfigService(maxMb);
  const service = new AttachmentService(
    prismaService as never,
    filesService as never,
    configService,
  );
  return { service, prismaService, filesService, configService };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AttachmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── sanitizeFilename ──────────────────────────────────────────────────────

  describe('sanitizeFilename', () => {
    const { service } = makeService();

    it.each([
      ['simple.png', 'simple.png'],
      ['my report (v2).docx', 'my report (v2).docx'],
      ['../../../etc/passwd', 'passwd'],
      ['/absolute/path/file.pdf', 'file.pdf'],
      ['hello world.jpg', 'hello world.jpg'],
      ['file-name_v1.0.txt', 'file-name_v1.0.txt'],
    ])('sanitizes "%s" → "%s"', (input, expected) => {
      expect(service.sanitizeFilename(input)).toBe(expected);
    });

    it('replaces special characters with underscores', () => {
      // '!', '@', '#', '$', '%' are replaced with '_'
      const result = service.sanitizeFilename('!@#$%');
      expect(result).toMatch(/^[_]+$/);
    });

    it('returns "attachment" for empty filename input', () => {
      expect(service.sanitizeFilename('')).toBe('attachment');
    });
  });

  // ─── ALLOWED_MIME_TYPES ────────────────────────────────────────────────────

  describe('ALLOWED_MIME_TYPES', () => {
    it('contains all required image types', () => {
      expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/gif')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(true);
    });

    it('contains application/pdf', () => {
      expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
    });

    it('does NOT allow executables', () => {
      expect(ALLOWED_MIME_TYPES.has('application/x-executable')).toBe(false);
      expect(ALLOWED_MIME_TYPES.has('application/x-sh')).toBe(false);
    });
  });

  // ─── upload ────────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('stores the file and creates a DB record for a valid upload', async () => {
      const { service, prismaService, filesService } = makeService();

      prismaService.note.findUnique.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID });
      vi.mocked(fsMock.mkdir).mockResolvedValue(undefined as never);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);

      const record = makeAttachmentRecord();
      prismaService.attachment.create.mockResolvedValue(record);

      const file = makeMulterFile();
      const result = await service.upload(WORKSPACE_ID, NOTE_ID, file);

      expect(result).toEqual(record);
      expect(fsMock.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(NOTE_ID),
        { recursive: true },
      );
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-image.png'),
        file.buffer,
      );
      expect(prismaService.attachment.create).toHaveBeenCalledWith({
        data: {
          noteId: NOTE_ID,
          filename: 'test-image.png',
          mimeType: 'image/png',
          size: 1024,
          path: expect.stringContaining(NOTE_ID),
        },
      });
    });

    it('throws BadRequestException for a disallowed MIME type', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID });

      const file = makeMulterFile({ mimetype: 'application/x-executable' });
      await expect(service.upload(WORKSPACE_ID, NOTE_ID, file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when file exceeds the configured size limit', async () => {
      // Configure service with 1 MB limit
      const { service, prismaService } = makeService(undefined, 1);
      prismaService.note.findUnique.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID });

      // File is 2 MB
      const file = makeMulterFile({ size: 2 * 1024 * 1024, mimetype: 'image/png' });
      await expect(service.upload(WORKSPACE_ID, NOTE_ID, file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue(null);

      const file = makeMulterFile();
      await expect(service.upload(WORKSPACE_ID, NOTE_ID, file)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when note belongs to a different workspace', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: 'other-workspace',
      });

      const file = makeMulterFile();
      await expect(service.upload(WORKSPACE_ID, NOTE_ID, file)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sanitizes the filename before saving', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID });
      vi.mocked(fsMock.mkdir).mockResolvedValue(undefined as never);
      vi.mocked(fsMock.writeFile).mockResolvedValue(undefined as never);
      prismaService.attachment.create.mockResolvedValue(makeAttachmentRecord({ filename: 'passwd' }));

      const file = makeMulterFile({ originalname: '../../../etc/passwd', mimetype: 'text/plain' });
      await service.upload(WORKSPACE_ID, NOTE_ID, file);

      // The create call should have sanitized the filename
      expect(prismaService.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // Traversal components are stripped; basename "passwd" remains
            filename: expect.not.stringContaining('..'),
          }),
        }),
      );
    });
  });

  // ─── serve ─────────────────────────────────────────────────────────────────

  describe('serve', () => {
    it('returns a StreamableFile with the attachment metadata', async () => {
      const { service, prismaService, filesService } = makeService();

      const record = makeAttachmentRecord();
      prismaService.attachment.findUnique.mockResolvedValue(record);
      prismaService.note.findUnique.mockResolvedValue({ workspaceId: WORKSPACE_ID });
      vi.mocked(fsMock.access).mockResolvedValue(undefined as never);
      vi.mocked(fsSync.createReadStream).mockReturnValue({ pipe: vi.fn() } as never);

      const result = await service.serve(ATTACHMENT_ID);

      expect(result.attachment).toEqual(record);
      expect(result.stream).toBeInstanceOf(StreamableFile);
      expect(filesService.resolveSafePath).toHaveBeenCalledWith(
        WORKSPACE_ID,
        record.path,
      );
    });

    it('throws NotFoundException when attachment ID does not exist', async () => {
      const { service, prismaService } = makeService();
      prismaService.attachment.findUnique.mockResolvedValue(null);

      await expect(service.serve('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the physical file is missing from disk', async () => {
      const { service, prismaService } = makeService();
      prismaService.attachment.findUnique.mockResolvedValue(makeAttachmentRecord());
      prismaService.note.findUnique.mockResolvedValue({ workspaceId: WORKSPACE_ID });
      vi.mocked(fsMock.access).mockRejectedValue(new Error('ENOENT'));

      await expect(service.serve(ATTACHMENT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listByNote ────────────────────────────────────────────────────────────

  describe('listByNote', () => {
    it('returns all attachments for a valid note', async () => {
      const { service, prismaService } = makeService();

      prismaService.note.findUnique.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID });
      const records = [makeAttachmentRecord(), makeAttachmentRecord({ id: 'att-2' })];
      prismaService.attachment.findMany.mockResolvedValue(records);

      const result = await service.listByNote(WORKSPACE_ID, NOTE_ID);
      expect(result).toEqual(records);
    });

    it('throws NotFoundException when the note is not in the workspace', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue(null);

      await expect(service.listByNote(WORKSPACE_ID, NOTE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when note belongs to a different workspace', async () => {
      const { service, prismaService } = makeService();
      prismaService.note.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: 'wrong-workspace',
      });

      await expect(service.listByNote(WORKSPACE_ID, NOTE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes the DB record and the physical file', async () => {
      const { service, prismaService, filesService } = makeService();

      const record = makeAttachmentRecord();
      prismaService.attachment.findUnique.mockResolvedValue(record);
      prismaService.note.findUnique.mockResolvedValue({ workspaceId: WORKSPACE_ID });
      prismaService.attachment.delete.mockResolvedValue(record);

      await service.delete(WORKSPACE_ID, ATTACHMENT_ID);

      expect(prismaService.attachment.delete).toHaveBeenCalledWith({
        where: { id: ATTACHMENT_ID },
      });
      expect(filesService.deleteFile).toHaveBeenCalledWith(
        WORKSPACE_ID,
        record.path,
      );
    });

    it('throws NotFoundException when attachment does not exist', async () => {
      const { service, prismaService } = makeService();
      prismaService.attachment.findUnique.mockResolvedValue(null);

      await expect(service.delete(WORKSPACE_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when attachment belongs to a different workspace', async () => {
      const { service, prismaService } = makeService();
      prismaService.attachment.findUnique.mockResolvedValue(makeAttachmentRecord());
      prismaService.note.findUnique.mockResolvedValue({ workspaceId: 'wrong-workspace' });

      await expect(service.delete(WORKSPACE_ID, ATTACHMENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('still removes DB record even if filesystem delete fails', async () => {
      const { service, prismaService, filesService } = makeService();

      const record = makeAttachmentRecord();
      prismaService.attachment.findUnique.mockResolvedValue(record);
      prismaService.note.findUnique.mockResolvedValue({ workspaceId: WORKSPACE_ID });
      prismaService.attachment.delete.mockResolvedValue(record);
      filesService.deleteFile.mockRejectedValue(new Error('disk I/O error'));

      // Should not throw — filesystem error is logged but not propagated
      await expect(service.delete(WORKSPACE_ID, ATTACHMENT_ID)).resolves.toBeUndefined();

      expect(prismaService.attachment.delete).toHaveBeenCalled();
    });
  });

  // ─── getMaxFileSizeBytes ───────────────────────────────────────────────────

  describe('getMaxFileSizeBytes', () => {
    it('returns 50 MB by default', () => {
      const { service } = makeService(undefined, 50);
      expect(service.getMaxFileSizeBytes()).toBe(50 * 1024 * 1024);
    });

    it('reflects a custom configured limit', () => {
      const { service } = makeService(undefined, 10);
      expect(service.getMaxFileSizeBytes()).toBe(10 * 1024 * 1024);
    });
  });
});
