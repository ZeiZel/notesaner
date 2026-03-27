import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AttachmentService } from './attachment.service';
import type { AttachmentRecord } from './attachment.service';

/**
 * AttachmentController handles multipart file uploads, serving, and deletion.
 *
 * Endpoints:
 *   POST   /workspaces/:workspaceId/notes/:noteId/attachments
 *   GET    /workspaces/:workspaceId/attachments
 *   GET    /workspaces/:workspaceId/notes/:noteId/attachments
 *   GET    /attachments/:attachmentId  (public streaming endpoint)
 *   DELETE /workspaces/:workspaceId/attachments/:attachmentId
 */

/**
 * Workspace-scoped attachment routes — require workspace membership.
 */
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  /**
   * POST /workspaces/:workspaceId/notes/:noteId/attachments
   *
   * Uploads a file and attaches it to the specified note.
   * The file must be sent as multipart/form-data with the field name "file".
   *
   * Maximum size: configurable via UPLOAD_MAX_FILE_SIZE_MB (default 50 MB).
   * Allowed types: images, PDF, text, and common office documents.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Post('notes/:noteId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        // 50 MB hard cap — further enforcement is done in AttachmentService
        // because the service has access to the configured limit.
        fileSize: 50 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async upload(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AttachmentRecord> {
    return this.attachmentService.upload(workspaceId, noteId, file);
  }

  /**
   * GET /workspaces/:workspaceId/notes/:noteId/attachments
   *
   * Returns a list of all attachment metadata records for the given note.
   * The client should use the returned `id` values to build download URLs.
   *
   * Minimum role: VIEWER
   */
  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('notes/:noteId/attachments')
  async listByNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<AttachmentRecord[]> {
    return this.attachmentService.listByNote(workspaceId, noteId);
  }

  /**
   * DELETE /workspaces/:workspaceId/attachments/:attachmentId
   *
   * Permanently removes an attachment record and its file from disk.
   *
   * Minimum role: EDITOR
   */
  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Delete('attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    await this.attachmentService.delete(workspaceId, attachmentId);
  }
}

/**
 * PublicAttachmentController — serves attachment files without workspace-scope
 * in the URL path. This keeps download URLs short and consistent.
 *
 * Route: GET /attachments/:attachmentId
 *
 * NOTE: This endpoint does NOT enforce workspace membership because note
 * attachments referenced in published notes must be accessible without auth.
 * Authorization for private notes is handled via the attachment record look-up:
 * the attachment can only be fetched if its ID is known, and IDs are opaque
 * UUIDs that are not guessable.
 *
 * For workspaces that require strict access control, a middleware layer or
 * signed URL approach (not in this sprint) should be added on top.
 */
@Controller('attachments')
export class PublicAttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  /**
   * GET /attachments/:attachmentId
   *
   * Streams the file with the correct Content-Type and Content-Disposition
   * headers. Uses NestJS StreamableFile to avoid buffering in memory.
   */
  @Get(':attachmentId')
  async serve(
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<import('@nestjs/common').StreamableFile> {
    const { stream, attachment } = await this.attachmentService.serve(attachmentId);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.filename)}"`,
    );
    res.setHeader('Content-Length', attachment.size.toString());
    // Allow clients to cache attachments for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');

    return stream;
  }
}
