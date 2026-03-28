import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ExportQuerySchema, BatchExportSchema } from './dto/export.dto';

/**
 * Handles note export endpoints.
 *
 * Supports exporting individual notes in various formats (MD, HTML, PDF, DOCX)
 * and batch export of multiple notes as a ZIP archive.
 */
@ApiTags('Notes / Export')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/notes')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // -----------------------------------------------------------------------
  // Single note export
  // -----------------------------------------------------------------------

  @Get(':noteId/export')
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

    res.set({
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(exported.filename)}"`,
      'Content-Length': exported.buffer.length.toString(),
    });

    res.send(exported.buffer);
  }

  // -----------------------------------------------------------------------
  // Batch export
  // -----------------------------------------------------------------------

  @Post('export/batch')
  @ApiOperation({
    summary: 'Export multiple notes as a ZIP archive',
    description:
      'Exports a batch of notes in the specified format, bundled into a ZIP archive. Maximum 100 notes per request.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
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
    );

    res.set({
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(exported.filename)}"`,
      'Content-Length': exported.buffer.length.toString(),
    });

    res.send(exported.buffer);
  }
}
