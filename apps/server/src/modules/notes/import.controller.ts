import {
  Body,
  Controller,
  Post,
  Param,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImportService } from './import.service';
import { ImportOptionsSchema } from './dto/import.dto';
import type { ImportPreviewResult, ImportResult, ImportProgressEvent } from './dto/import.dto';
import { mkdtemp, rm, writeFile, copyFile, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Dynamically require an optional dependency.
 * Returns the module if available, or null if not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryRequire(moduleName: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(moduleName);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  path: string;
  buffer?: Buffer;
}

// Shared API body schema for all import endpoints
const importBodySchema = {
  type: 'object',
  properties: {
    file: { type: 'string', format: 'binary', description: 'ZIP or file archive' },
    source: {
      type: 'string',
      enum: ['obsidian', 'notion', 'logseq', 'markdown'],
      description: 'Source application',
    },
    preserveFolderStructure: {
      type: 'boolean',
      default: true,
      description: 'Keep original folder structure',
    },
    targetFolder: {
      type: 'string',
      default: '',
      description: 'Target folder within workspace',
    },
    convertLinks: {
      type: 'boolean',
      default: true,
      description: 'Convert internal links to Notesaner format',
    },
    importAttachments: {
      type: 'boolean',
      default: true,
      description: 'Import attachment files',
    },
    conflictStrategy: {
      type: 'string',
      enum: ['skip', 'overwrite', 'rename'],
      default: 'rename',
      description:
        'What to do when a target note already exists. ' +
        '"skip" leaves existing files untouched, ' +
        '"overwrite" replaces them, ' +
        '"rename" appends a numeric suffix to the new file.',
    },
    parseObsidianWorkspace: {
      type: 'boolean',
      default: false,
      description:
        'Obsidian only: read .obsidian/workspace.json to mark recently-open notes in the preview.',
    },
  },
  required: ['file', 'source'],
} as const;

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * Handles note import endpoints.
 *
 * Supports importing from Obsidian, Notion, Logseq, and generic markdown files.
 * Uses a two-phase approach: preview first, then execute.
 *
 * For large imports use `/execute-stream` to receive Server-Sent Events (SSE)
 * progress updates during the operation.
 */
@ApiTags('Notes / Import')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/notes/import')
export class ImportController {
  private readonly logger = new Logger(ImportController.name);

  constructor(private readonly importService: ImportService) {}

  // -----------------------------------------------------------------------
  // Preview import
  // -----------------------------------------------------------------------

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Preview an import',
    description:
      'Upload a ZIP file or folder to preview what will be imported. ' +
      'Returns a list of notes that will be created, with warnings about potential issues. ' +
      'Supports: Obsidian vault exports, Notion exports, Logseq exports, and generic markdown files.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({
    description: 'ZIP file or folder to preview, plus import options',
    schema: importBodySchema as Record<string, unknown>,
  })
  @ApiOkResponse({ description: 'Import preview result with list of notes to be created.' })
  @ApiBadRequestResponse({ description: 'Invalid file or options.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async previewImport(
    @Param('workspaceId') _workspaceId: string,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<ImportPreviewResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options = ImportOptionsSchema.parse(body);
    let extractedPath: string;

    try {
      extractedPath = await this.extractUpload(file);
    } catch (error) {
      throw new BadRequestException(`Failed to extract uploaded file: ${String(error)}`);
    }

    try {
      return await this.importService.previewImport(extractedPath, options);
    } finally {
      await this.cleanupTemp(extractedPath);
    }
  }

  // -----------------------------------------------------------------------
  // Execute import (returns JSON when done)
  // -----------------------------------------------------------------------

  @Post('execute')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Execute an import',
    description:
      'Upload a ZIP file or folder to import into the workspace. ' +
      'Notes are created in the target folder with the specified options. ' +
      'Returns a JSON summary when the entire import is complete. ' +
      'For real-time progress use the `/execute-stream` endpoint.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({
    description: 'ZIP file or folder to import, plus import options',
    schema: importBodySchema as Record<string, unknown>,
  })
  @ApiOkResponse({ description: 'Import result with counts and any errors.' })
  @ApiBadRequestResponse({ description: 'Invalid file or options.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async executeImport(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options = ImportOptionsSchema.parse(body);
    let extractedPath: string;

    try {
      extractedPath = await this.extractUpload(file);
    } catch (error) {
      throw new BadRequestException(`Failed to extract uploaded file: ${String(error)}`);
    }

    try {
      return await this.importService.executeImport(workspaceId, extractedPath, options);
    } finally {
      await this.cleanupTemp(extractedPath);
    }
  }

  // -----------------------------------------------------------------------
  // Execute import with SSE progress streaming
  // -----------------------------------------------------------------------

  @Post('execute-stream')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Execute an import with SSE progress streaming',
    description:
      'Same as `/execute` but streams progress events as Server-Sent Events (SSE). ' +
      'Each event has a `data` field with a JSON-encoded `ImportProgressEvent`. ' +
      'The stream is closed when the import completes or encounters a fatal error.\n\n' +
      'SSE event format:\n```\n' +
      'data: {"phase":"importing","current":3,"total":10,"currentFile":"note.md","errors":[]}\n\n' +
      'data: {"phase":"complete","current":10,"total":10,"errors":[]}\n\n```',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({
    description: 'ZIP file or folder to import, plus import options',
    schema: importBodySchema as Record<string, unknown>,
  })
  @ApiOkResponse({
    description:
      'text/event-stream response. Each SSE event carries an ImportProgressEvent JSON payload.',
  })
  @ApiBadRequestResponse({ description: 'Invalid file or options.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async executeImportStream(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options = ImportOptionsSchema.parse(body);
    let extractedPath: string;

    try {
      extractedPath = await this.extractUpload(file);
    } catch (error) {
      throw new BadRequestException(`Failed to extract uploaded file: ${String(error)}`);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering
    res.flushHeaders();

    const sendEvent = (event: ImportProgressEvent): void => {
      const payload = JSON.stringify(event);
      res.write(`data: ${payload}\n\n`);
      // Flush if the response supports it (Express w/ compression middleware)
      if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
      }
    };

    try {
      await this.importService.executeImport(workspaceId, extractedPath, options, sendEvent);
    } catch (error) {
      // Emit a terminal error event before closing
      const errorEvent: ImportProgressEvent = {
        phase: 'error',
        current: 0,
        total: 0,
        errors: [
          {
            file: '',
            message: `Import failed: ${String(error)}`,
            recoverable: false,
          },
        ],
      };
      sendEvent(errorEvent);
      this.logger.error(`Import stream error for workspace ${workspaceId}: ${String(error)}`);
    } finally {
      await this.cleanupTemp(extractedPath);
      res.end();
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Extract an uploaded file (ZIP or single file) to a temporary directory.
   */
  private async extractUpload(file: MulterFile): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), 'notesaner-import-'));

    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      await this.extractZip(file, tempDir);
    } else {
      // Single file: write directly to temp dir
      const targetPath = join(tempDir, file.originalname);
      if (file.buffer) {
        await writeFile(targetPath, file.buffer);
      } else if (file.path) {
        await copyFile(file.path, targetPath);
      }
    }

    return tempDir;
  }

  /**
   * Extract a ZIP file to the target directory.
   *
   * Tries extract-zip (npm package) first, then falls back to the
   * system unzip command.
   */
  private async extractZip(file: MulterFile, targetDir: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractZipFn: any = tryRequire('extract-zip');

    if (extractZipFn) {
      try {
        if (file.path) {
          await extractZipFn(file.path, { dir: targetDir });
          return;
        } else if (file.buffer) {
          const tempZipPath = join(targetDir, '_import.zip');
          await writeFile(tempZipPath, file.buffer);

          await extractZipFn(tempZipPath, { dir: targetDir });
          await unlink(tempZipPath);
          return;
        }
      } catch {
        // Fall through to system unzip
      }
    }

    // Fallback: use the system unzip command
    try {
      const zipPath = file.path ?? join(targetDir, '_import.zip');
      if (!file.path && file.buffer) {
        await writeFile(zipPath, file.buffer);
      }
      execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`);
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract ZIP file. Ensure it is a valid ZIP archive: ${String(error)}`,
      );
    }
  }

  /**
   * Clean up a temporary directory.
   */
  private async cleanupTemp(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp dir ${path}: ${String(error)}`);
    }
  }
}
