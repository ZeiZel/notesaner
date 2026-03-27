import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as fsPromises from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from './files.service';
import type { AppConfiguration } from '../../config/configuration';

/**
 * Whitelist of allowed upload MIME types.
 * Covers images, PDF, and common office document formats.
 */
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // PDF
  'application/pdf',
  // Plain text / Markdown
  'text/plain',
  'text/markdown',
  // Office documents (Open XML)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Legacy Office formats
  'application/msword',                                                        // .doc
  'application/vnd.ms-excel',                                                  // .xls
  'application/vnd.ms-powerpoint',                                             // .ppt
  // Archives
  'application/zip',
  'application/x-zip-compressed',
]);

export interface AttachmentRecord {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

/** Relative directory within a workspace where attachments are stored. */
const ATTACHMENTS_DIR = '.attachments';

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  /** Maximum file size in bytes, configurable via UPLOAD_MAX_FILE_SIZE_MB env var. */
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {
    const maxMb = this.config.get<number>('upload.maxFileSizeMb', { infer: true }) ?? 50;
    this.maxFileSizeBytes = maxMb * 1024 * 1024;
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  /**
   * Stores an uploaded file in the workspace's `.attachments` directory and
   * records the metadata in the database.
   *
   * @param workspaceId - The owning workspace.
   * @param noteId      - The note the attachment belongs to.
   * @param file        - The Express.Multer.File received by FileInterceptor.
   * @returns           - The persisted Attachment record.
   */
  async upload(
    workspaceId: string,
    noteId: string,
    file: Express.Multer.File,
  ): Promise<AttachmentRecord> {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. ` +
          `Supported types: images, PDF, text, and common office documents.`,
      );
    }

    // Validate file size (belt-and-suspenders — multer limits are set too,
    // but multer's limit throws a different error so we also check here)
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File size ${file.size} bytes exceeds the maximum allowed ` +
          `${this.maxFileSizeBytes} bytes (${this.maxFileSizeBytes / 1024 / 1024} MB).`,
      );
    }

    // Verify the note exists and belongs to the workspace
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true },
    });

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    // Sanitize the original filename to prevent directory traversal
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    // Build a storage path: .attachments/<noteId>/<sanitizedFilename>
    // Using noteId as a sub-directory groups an attachment with its note and
    // avoids filename collisions across notes.
    const relativeStoragePath = path.join(
      ATTACHMENTS_DIR,
      noteId,
      sanitizedFilename,
    );

    // Resolve the absolute path and guard against traversal
    const absolutePath = this.filesService.resolveSafePath(workspaceId, relativeStoragePath);

    // Ensure the target directory exists
    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });

    // Write the file buffer to disk
    await fsPromises.writeFile(absolutePath, file.buffer);

    // Persist metadata to the database
    const attachment = await this.prisma.attachment.create({
      data: {
        noteId,
        filename: sanitizedFilename,
        mimeType: file.mimetype,
        size: file.size,
        path: relativeStoragePath,
      },
    });

    this.logger.log(
      `Attachment ${attachment.id} uploaded for note ${noteId}: ${sanitizedFilename} (${file.size} bytes)`,
    );

    return attachment;
  }

  // ─── Serve (stream) ────────────────────────────────────────────────────────

  /**
   * Streams the file for a given attachment ID.
   *
   * The caller is responsible for setting the Content-Type and
   * Content-Disposition headers using the returned metadata.
   *
   * @returns An object containing the StreamableFile and attachment metadata.
   */
  async serve(
    attachmentId: string,
  ): Promise<{ stream: StreamableFile; attachment: AttachmentRecord }> {
    const attachment = await this.findById(attachmentId);

    // We need the workspace ID to resolve the absolute path.
    // The attachment's note always belongs to a workspace.
    const note = await this.prisma.note.findUnique({
      where: { id: attachment.noteId },
      select: { workspaceId: true },
    });

    if (!note) {
      throw new NotFoundException(`Parent note for attachment ${attachmentId} not found`);
    }

    const absolutePath = this.filesService.resolveSafePath(
      note.workspaceId,
      attachment.path,
    );

    // Verify the physical file is still present
    try {
      await fsPromises.access(absolutePath);
    } catch {
      throw new NotFoundException(
        `Attachment file not found on disk for attachment ${attachmentId}`,
      );
    }

    const readStream = createReadStream(absolutePath);
    const streamableFile = new StreamableFile(readStream);

    return { stream: streamableFile, attachment };
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  /**
   * Returns all attachment records for a given note in the workspace.
   */
  async listByNote(
    workspaceId: string,
    noteId: string,
  ): Promise<AttachmentRecord[]> {
    // Verify the note belongs to the workspace
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true },
    });

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    return this.prisma.attachment.findMany({
      where: { noteId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  /**
   * Deletes an attachment — removes the DB record and the physical file.
   * Uses "delete-then-cleanup" order: DB first, then filesystem.
   * This ensures we don't leave orphaned DB records if the FS delete fails.
   */
  async delete(
    workspaceId: string,
    attachmentId: string,
  ): Promise<void> {
    const attachment = await this.findById(attachmentId);

    // Verify the attachment belongs to the given workspace
    const note = await this.prisma.note.findUnique({
      where: { id: attachment.noteId },
      select: { workspaceId: true },
    });

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException(
        `Attachment ${attachmentId} not found in workspace ${workspaceId}`,
      );
    }

    // Delete DB record first
    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    // Remove the physical file (best-effort — log a warning but don't throw)
    try {
      await this.filesService.deleteFile(workspaceId, attachment.path);
      this.logger.log(`Deleted attachment ${attachmentId}: ${attachment.path}`);
    } catch (error) {
      this.logger.warn(
        `DB record for attachment ${attachmentId} deleted, but failed to remove file "${attachment.path}": ${error}`,
      );
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Finds an attachment record by ID or throws NotFoundException.
   */
  async findById(attachmentId: string): Promise<AttachmentRecord> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    return attachment;
  }

  /**
   * Strips directory separators from a filename and replaces unsafe characters.
   * Prevents path traversal attacks via the filename field.
   *
   * Examples:
   *   "../../../etc/passwd"    → "etc_passwd"
   *   "my report (v2).docx"   → "my report (v2).docx"
   *   "hello world.png"       → "hello world.png"
   */
  sanitizeFilename(filename: string): string {
    // Take only the basename (strips leading path components)
    const base = path.basename(filename);

    // Replace any remaining unsafe characters (null bytes, control chars)
    // Keep alphanumeric, spaces, dots, hyphens, underscores, parentheses
    const sanitized = base.replace(/[^\w\s.()\-]/g, '_');

    // Ensure we always have a non-empty filename
    return sanitized.length > 0 ? sanitized : 'attachment';
  }

  /**
   * Returns the configured maximum file size in bytes.
   * Exposed for use in the Multer configuration.
   */
  getMaxFileSizeBytes(): number {
    return this.maxFileSizeBytes;
  }
}
