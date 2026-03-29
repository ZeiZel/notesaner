import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExportService } from './export.service';
import { ExportQuerySchema, BatchExportSchema, WorkspaceExportSchema } from './dto/export.dto';

/**
 * Handles note export endpoints.
 *
 * Supports exporting individual notes in various formats (MD, HTML, PDF, DOCX),
 * batch export of multiple notes as a ZIP archive preserving folder structure,
 * and full workspace export.
 */
@ApiTags('Notes / Export')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // -----------------------------------------------------------------------
  // Single note export
  // -----------------------------------------------------------------------

  @Get('notes/:noteId/export')
  @ApiOperation({
    summary: 'Export a single note',
    description:
      'Exports a note in the specified format. Supported formats: md (raw markdown with frontmatter), html (rendered with embedded styles), pdf (server-side rendered), docx (Word document).',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'noteId', description: 'Note ID (UUID)', type: String })
  @ApiQuery({
    name: 'format',
    description: 'Export format',
    enum: ['md', 'html', 'pdf', 'docx'],
    required: true,
  })
  @ApiOkResponse({ description: 'File content returned as binary stream.' })
  @ApiNotFoundResponse({ description: 'Note not found.' })
  @ApiBadRequestResponse({ description: 'Invalid format specified.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async exportNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ExportQuerySchema.parse(query);
    const exported = await this.exportService.exportNote(workspaceId, noteId, parsed.format);

    this.sendFileResponse(res, exported);
  }

  // -----------------------------------------------------------------------
  // Batch export
  // -----------------------------------------------------------------------

  @Post('notes/export/batch')
  @ApiOperation({
    summary: 'Export multiple notes as a ZIP archive',
    description:
      'Exports a batch of notes in the specified format, bundled into a ZIP archive. ' +
      'Folder structure, attachments, and internal link rewriting are controlled via the request body. ' +
      'Maximum 100 notes per request.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['noteIds', 'format'],
      properties: {
        noteIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          minItems: 1,
          maxItems: 100,
          description: 'UUIDs of the notes to export',
        },
        format: { type: 'string', enum: ['md', 'html', 'pdf', 'docx'] },
        preserveFolderStructure: {
          type: 'boolean',
          default: true,
          description: 'Mirror the vault folder hierarchy inside the ZIP',
        },
        includeAttachments: {
          type: 'boolean',
          default: true,
          description: 'Bundle note attachments alongside the exported files',
        },
        rewriteInternalLinks: {
          type: 'boolean',
          default: true,
          description: 'Rewrite wiki/markdown links between exported notes to relative paths',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'ZIP archive returned as binary stream.' })
  @ApiNotFoundResponse({ description: 'One or more notes not found.' })
  @ApiBadRequestResponse({ description: 'Invalid request body or format.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async exportBatch(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = BatchExportSchema.parse(body);
    const exported = await this.exportService.exportBatch(
      workspaceId,
      parsed.noteIds,
      parsed.format,
      {
        preserveFolderStructure: parsed.preserveFolderStructure,
        includeAttachments: parsed.includeAttachments,
        rewriteInternalLinks: parsed.rewriteInternalLinks,
      },
    );

    this.sendFileResponse(res, exported);
  }

  // -----------------------------------------------------------------------
  // Workspace export
  // -----------------------------------------------------------------------

  @Post('export')
  @ApiOperation({
    summary: 'Export entire workspace as a ZIP archive',
    description:
      'Exports all notes in the workspace in the specified format, preserving the full folder ' +
      'structure. Attachments are included by default and internal links are rewritten to ' +
      'relative paths so the exported vault is self-contained.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['format'],
      properties: {
        format: { type: 'string', enum: ['md', 'html', 'pdf', 'docx'] },
        preserveFolderStructure: {
          type: 'boolean',
          default: true,
          description: 'Mirror the vault folder hierarchy inside the ZIP',
        },
        includeAttachments: {
          type: 'boolean',
          default: true,
          description: 'Bundle note attachments alongside the exported files',
        },
        rewriteInternalLinks: {
          type: 'boolean',
          default: true,
          description: 'Rewrite wiki/markdown links to relative paths inside the ZIP',
        },
        excludeTrashed: {
          type: 'boolean',
          default: true,
          description: 'Omit notes that have been moved to trash',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'ZIP archive of the entire workspace returned as binary stream.' })
  @ApiBadRequestResponse({ description: 'Invalid request body or format.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async exportWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = WorkspaceExportSchema.parse(body);
    const exported = await this.exportService.exportWorkspace(workspaceId, parsed);

    this.sendFileResponse(res, exported);
  }

  // -----------------------------------------------------------------------
  // Shared helpers
  // -----------------------------------------------------------------------

  private sendFileResponse(
    res: Response,
    exported: { filename: string; contentType: string; buffer: Buffer },
  ): void {
    res.set({
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(exported.filename)}"`,
      'Content-Length': exported.buffer.length.toString(),
    });

    res.send(exported.buffer);
  }
}
