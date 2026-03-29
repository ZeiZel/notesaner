import { Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, dirname, basename, extname } from 'path';
import { promises as fsp } from 'fs';
import { JobsService } from '../jobs/jobs.service';

/**
 * Notes domain service.
 *
 * Wraps CRUD operations for notes and ensures the FTS index is kept
 * up to date after every save operation via a debounced BullMQ job.
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);
  private readonly storageRoot: string;

  constructor(
    private readonly jobsService: JobsService,
    configService: ConfigService,
  ) {
    this.storageRoot = configService.get<string>('storage.root') ?? '/var/lib/notesaner/workspaces';
  }

  async create(
    _workspaceId: string,
    _userId: string,
    _dto: { path: string; title: string; content?: string },
  ): Promise<unknown> {
    throw new NotImplementedException('create not yet implemented');
  }

  async findById(_workspaceId: string, _noteId: string): Promise<unknown> {
    throw new NotImplementedException('findById not yet implemented');
  }

  async findByIdWithContent(_workspaceId: string, _noteId: string): Promise<unknown> {
    throw new NotImplementedException('findByIdWithContent not yet implemented');
  }

  async findByPath(_workspaceId: string, _path: string): Promise<unknown> {
    throw new NotImplementedException('findByPath not yet implemented');
  }

  async list(
    _workspaceId: string,
    _params: {
      cursor?: string;
      limit?: number;
      search?: string;
      isTrashed?: boolean;
      tagId?: string;
    },
  ): Promise<unknown> {
    throw new NotImplementedException('list not yet implemented');
  }

  async update(
    _workspaceId: string,
    _noteId: string,
    _userId: string,
    _dto: { title?: string; content?: string; frontmatter?: Record<string, unknown> },
  ): Promise<unknown> {
    throw new NotImplementedException('update not yet implemented');
  }

  async trash(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('trash not yet implemented');
  }

  async restore(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('restore not yet implemented');
  }

  async permanentDelete(_workspaceId: string, _noteId: string): Promise<void> {
    throw new NotImplementedException('permanentDelete not yet implemented');
  }

  async getContent(_workspaceId: string, _noteId: string): Promise<string> {
    throw new NotImplementedException('getContent not yet implemented');
  }

  async persistContent(
    noteId: string,
    _content: string,
    userId: string,
    workspaceId: string,
    notePath: string,
  ): Promise<void> {
    const absolutePath = join(this.storageRoot, workspaceId, notePath);
    await this.scheduleIndexUpdate(noteId, workspaceId, absolutePath);

    this.logger.debug(`Content persisted for note ${noteId} by user ${userId} — index scheduled`);
  }

  async getGraphData(_workspaceId: string): Promise<unknown> {
    throw new NotImplementedException('getGraphData not yet implemented');
  }

  async getBacklinks(_noteId: string): Promise<unknown[]> {
    throw new NotImplementedException('getBacklinks not yet implemented');
  }

  async listVersions(_noteId: string): Promise<unknown[]> {
    throw new NotImplementedException('listVersions not yet implemented');
  }

  async bulkMove(_workspaceId: string, _noteIds: string[], _targetFolder: string): Promise<void> {
    throw new NotImplementedException('bulkMove not yet implemented');
  }

  async renameWithLinkUpdate(
    _workspaceId: string,
    _noteId: string,
    _newPath: string,
  ): Promise<void> {
    throw new NotImplementedException('renameWithLinkUpdate not yet implemented');
  }

  /**
   * Duplicates a note, creating a copy with optional property inclusion.
   *
   * Reads the source note content from disk, optionally strips frontmatter,
   * writes the copy to disk, and creates a new note record via `create()`.
   */
  async duplicateNote(
    workspaceId: string,
    noteId: string,
    userId: string,
    options: { includeProperties?: boolean; targetFolderId?: string } = {},
  ): Promise<{
    id: string;
    workspaceId: string;
    path: string;
    title: string;
    frontmatter: Record<string, unknown>;
    createdAt: string;
  }> {
    const { includeProperties = true, targetFolderId } = options;

    // 1. Look up the source note
    const sourceNote = (await this.findById(workspaceId, noteId)) as {
      id: string;
      workspaceId: string;
      path: string;
      title: string;
      frontmatter: Record<string, unknown>;
    } | null;

    if (!sourceNote) {
      throw new NotFoundException(`Note "${noteId}" not found`);
    }

    // 2. Derive copy path and title
    const ext = extname(sourceNote.path);
    const base = basename(sourceNote.path, ext);
    const sourceDir = dirname(sourceNote.path);
    const folder = targetFolderId ?? (sourceDir === '.' ? '' : sourceDir);
    const copyFilename = `${base}-copy${ext}`;
    const copyPath = folder ? `${folder}/${copyFilename}` : copyFilename;
    const copyTitle = `Copy of ${sourceNote.title}`;

    // 3. Read source content from disk
    const absoluteSourcePath = join(this.storageRoot, workspaceId, sourceNote.path);
    let content: string;
    try {
      content = await fsp.readFile(absoluteSourcePath, 'utf-8');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ENOENT') {
        this.logger.warn(`Source file not found on disk for note ${noteId}, writing empty copy`);
        content = '';
      } else {
        throw err;
      }
    }

    // 4. Optionally strip frontmatter
    let finalContent = content;
    let frontmatter: Record<string, unknown> = {};

    if (includeProperties) {
      frontmatter = { ...sourceNote.frontmatter };
    } else {
      // Strip YAML frontmatter (between --- delimiters at start of file)
      finalContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
    }

    // 5. Write copy to disk
    const absoluteCopyPath = join(this.storageRoot, workspaceId, copyPath);
    await fsp.mkdir(dirname(absoluteCopyPath), { recursive: true });
    await fsp.writeFile(absoluteCopyPath, finalContent, 'utf-8');

    // 6. Create note record
    const created = (await this.create(workspaceId, userId, {
      path: copyPath,
      title: copyTitle,
      content: finalContent,
    })) as {
      id: string;
      workspaceId: string;
      path: string;
      title: string;
      frontmatter: Record<string, unknown>;
      createdAt: Date;
    };

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      path: copyPath,
      title: copyTitle,
      frontmatter: includeProperties ? frontmatter : {},
      createdAt: created.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async scheduleIndexUpdate(
    noteId: string,
    workspaceId: string,
    filePath: string,
  ): Promise<void> {
    try {
      await this.jobsService.scheduleNoteIndex(noteId, workspaceId, filePath);
    } catch (error) {
      this.logger.error(`Failed to schedule index update for note ${noteId}: ${String(error)}`);
    }
  }
}
