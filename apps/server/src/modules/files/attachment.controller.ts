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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UploadRateLimit } from '../../common/decorators/throttle.decorator';
import { AttachmentService } from './attachment.service';
import type { AttachmentRecord } from './attachment.service';

/**
 * Workspace-scoped attachment routes -- require workspace membership.
 */
@ApiTags('Attachments')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @UploadRateLimit()
  @Post('notes/:noteId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload a file attachment to a note',
    description:
      'Uploads a file (max 50 MB) and attaches it to the specified note. ' +
      'Send as multipart/form-data with field name "file". Minimum role: EDITOR.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiCreatedResponse({ description: 'Attachment uploaded successfully.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async upload(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AttachmentRecord> {
    return this.attachmentService.upload(workspaceId, noteId, file);
  }

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get('notes/:noteId/attachments')
  @ApiOperation({
    summary: 'List attachments for a note',
    description:
      'Returns all attachment metadata records for the given note. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of attachment metadata.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async listByNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<AttachmentRecord[]> {
    return this.attachmentService.listByNote(workspaceId, noteId);
  }

  @Roles('EDITOR', 'ADMIN', 'OWNER')
  @Delete('attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an attachment',
    description:
      'Permanently removes an attachment record and its file from disk. Minimum role: EDITOR.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Attachment deleted.' })
  @ApiNotFoundResponse({ description: 'Attachment not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    await this.attachmentService.delete(workspaceId, attachmentId);
  }
}

/**
 * Public attachment serving endpoint -- no workspace scope needed.
 */
@ApiTags('Attachments')
@Controller('attachments')
export class PublicAttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Get(':attachmentId')
  @ApiOperation({
    summary: 'Serve an attachment file',
    description:
      'Streams the file with correct Content-Type and Content-Disposition headers. ' +
      'No authentication required (IDs are opaque UUIDs). ' +
      'Used by published notes to reference embedded files.',
  })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID (UUID)', type: String })
  @ApiOkResponse({ description: 'File streamed with correct headers.' })
  @ApiNotFoundResponse({ description: 'Attachment not found.' })
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
