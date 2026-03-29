import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, dirname } from 'path';
import { mkdir, rename, rm } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of days before a trashed note is eligible for auto-purge. */
export const TRASH_RETENTION_DAYS = 30;

/** Sub-directory within a workspace vault used to store trashed note files. */
const TRASH_DIR = '.trash';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrashListItem {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  trashedAt: Date;
  wordCount: number;
}

export interface TrashListResult {
  items: TrashListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages the trash lifecycle for notes:
 *  - moveToTrash:      soft-delete (sets trashedAt, moves file to .trash/)
 *  - restoreFromTrash: clears trashedAt, moves file back to original path
 *  - permanentDelete:  removes DB record and deletes file from .trash/
 *  - listTrash:        paginated list of trashed notes in a workspace
 *  - emptyTrash:       permanently deletes all trashed notes in a workspace
 *  - purgeExpired:     permanently deletes notes trashed more than 30 days ago
 */
@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);
  private readonly storageRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.storageRoot = configService.get<string>('storage.root') ?? '/var/lib/notesaner/workspaces';
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Soft-delete a note by setting trashedAt and moving the file to .trash/.
   *
   * Idempotent: calling on an already-trashed note is a no-op.
   */
  async moveToTrash(workspaceId: string, noteId: string): Promise<void> {
    const note = await this.findNoteOrFail(workspaceId, noteId);

    if (note.isTrashed) {
      this.logger.debug(`Note ${noteId} is already trashed — skipping`);
      return;
    }

    const trashedAt = new Date();
    const trashPath = this.buildTrashPath(note.path);

    // Move file first — if FS fails, we do NOT commit the DB change
    await this.moveFile(this.absPath(workspaceId, note.path), this.absPath(workspaceId, trashPath));

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isTrashed: true, trashedAt, path: trashPath },
    });

    this.logger.log(`Note ${noteId} moved to trash (path: ${trashPath})`);
  }

  /**
   * Restore a trashed note back to its original location.
   *
   * The original path is reconstructed by stripping the .trash/ prefix.
   * If the original path is already occupied by another note, throws BadRequestException.
   */
  async restoreFromTrash(workspaceId: string, noteId: string): Promise<void> {
    const note = await this.findNoteOrFail(workspaceId, noteId);

    if (!note.isTrashed) {
      this.logger.debug(`Note ${noteId} is not trashed — skipping restore`);
      return;
    }

    const originalPath = this.restoreOriginalPath(note.path);

    // Guard against path collision
    const collision = await this.prisma.note.findFirst({
      where: { workspaceId, path: originalPath, id: { not: noteId } },
      select: { id: true },
    });

    if (collision) {
      throw new BadRequestException(
        `Cannot restore note: a note already exists at path "${originalPath}". ` +
          'Please rename or move the existing note first.',
      );
    }

    await this.moveFile(
      this.absPath(workspaceId, note.path),
      this.absPath(workspaceId, originalPath),
    );

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isTrashed: false, trashedAt: null, path: originalPath },
    });

    this.logger.log(`Note ${noteId} restored from trash to path: ${originalPath}`);
  }

  /**
   * Permanently delete a note: removes the DB record and deletes the file.
   *
   * Only trashed notes can be permanently deleted via this method.
   * Use the regular delete endpoint to trash a non-trashed note first.
   */
  async permanentDelete(workspaceId: string, noteId: string): Promise<void> {
    const note = await this.findNoteOrFail(workspaceId, noteId);

    if (!note.isTrashed) {
      throw new BadRequestException(
        'Note must be in the trash before permanent deletion. ' +
          'Move it to trash first using POST /notes/:id/trash.',
      );
    }

    // Delete DB record first — cascades will handle relations
    await this.prisma.note.delete({ where: { id: noteId } });

    // Then delete the file (best-effort — DB is the source of truth)
    await this.deleteFile(this.absPath(workspaceId, note.path));

    this.logger.log(`Note ${noteId} permanently deleted`);
  }

  /**
   * List all trashed notes in a workspace with cursor-based pagination.
   *
   * @param workspaceId  Target workspace
   * @param cursor       Last note ID from previous page (optional)
   * @param limit        Page size (default: 20, max: 100)
   */
  async listTrash(workspaceId: string, cursor?: string, limit = 20): Promise<TrashListResult> {
    const pageSize = Math.min(Math.max(limit, 1), 100);

    const [items, total] = await Promise.all([
      this.prisma.note.findMany({
        where: { workspaceId, isTrashed: true },
        select: {
          id: true,
          workspaceId: true,
          path: true,
          title: true,
          trashedAt: true,
          wordCount: true,
        },
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { trashedAt: 'desc' },
      }),
      this.prisma.note.count({ where: { workspaceId, isTrashed: true } }),
    ]);

    const hasMore = items.length > pageSize;
    const page = hasMore ? items.slice(0, pageSize) : items;

    return {
      items: page.map((n) => ({
        ...n,
        trashedAt: n.trashedAt ?? new Date(0),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
      total,
    };
  }

  /**
   * Permanently delete all trashed notes in a workspace.
   *
   * Returns the count of deleted notes.
   */
  async emptyTrash(workspaceId: string): Promise<number> {
    const trashedNotes = await this.prisma.note.findMany({
      where: { workspaceId, isTrashed: true },
      select: { id: true, path: true },
    });

    if (trashedNotes.length === 0) {
      return 0;
    }

    const noteIds = trashedNotes.map((n) => n.id);

    // Delete all DB records in one query (cascade handles relations)
    await this.prisma.note.deleteMany({ where: { id: { in: noteIds } } });

    // Delete files best-effort (errors are logged but not propagated)
    let deletedFiles = 0;
    for (const note of trashedNotes) {
      try {
        await this.deleteFile(this.absPath(workspaceId, note.path));
        deletedFiles++;
      } catch (err) {
        this.logger.warn(
          `Failed to delete file for note ${note.id} during emptyTrash: ${String(err)}`,
        );
      }
    }

    this.logger.log(
      `Empty trash: deleted ${noteIds.length} notes (${deletedFiles} files) in workspace ${workspaceId}`,
    );

    return noteIds.length;
  }

  /**
   * Purge all notes that have been in the trash longer than retentionDays.
   *
   * Designed to be called by the TrashPurgeProcessor on a daily cron schedule.
   *
   * @param retentionDays  Days after which trashed notes are purged (default: 30)
   * @returns              Number of notes purged
   */
  async purgeExpired(retentionDays = TRASH_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const expiredNotes = await this.prisma.note.findMany({
      where: {
        isTrashed: true,
        trashedAt: { lte: cutoff },
      },
      select: { id: true, workspaceId: true, path: true },
    });

    if (expiredNotes.length === 0) {
      this.logger.debug('No expired trashed notes to purge');
      return 0;
    }

    this.logger.log(
      `Purging ${expiredNotes.length} note(s) trashed before ${cutoff.toISOString()}`,
    );

    const noteIds = expiredNotes.map((n) => n.id);

    // Bulk DB delete (cascades handle all relations)
    await this.prisma.note.deleteMany({ where: { id: { in: noteIds } } });

    // Delete files best-effort
    let deletedFiles = 0;
    for (const note of expiredNotes) {
      try {
        await this.deleteFile(this.absPath(note.workspaceId, note.path));
        deletedFiles++;
      } catch (err) {
        this.logger.warn(`Failed to delete file for note ${note.id} during purge: ${String(err)}`);
      }
    }

    this.logger.log(
      `Purge complete: ${noteIds.length} notes removed (${deletedFiles} files deleted)`,
    );

    return noteIds.length;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async findNoteOrFail(
    workspaceId: string,
    noteId: string,
  ): Promise<{ id: string; path: string; isTrashed: boolean; trashedAt: Date | null }> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId },
      select: { id: true, path: true, isTrashed: true, trashedAt: true },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    return note;
  }

  /**
   * Resolve the absolute filesystem path for a workspace-relative note path.
   */
  private absPath(workspaceId: string, relativePath: string): string {
    return join(this.storageRoot, workspaceId, relativePath);
  }

  /**
   * Compute the .trash/-prefixed path for a note being trashed.
   * e.g. "folder/note.md" -> ".trash/folder/note.md"
   */
  private buildTrashPath(originalPath: string): string {
    return join(TRASH_DIR, originalPath);
  }

  /**
   * Reconstruct the original path from a .trash/-prefixed path.
   * e.g. ".trash/folder/note.md" -> "folder/note.md"
   */
  private restoreOriginalPath(trashPath: string): string {
    const prefix = TRASH_DIR + '/';
    if (trashPath.startsWith(prefix)) {
      return trashPath.slice(prefix.length);
    }
    // Fallback: path was not in .trash/ — return as-is
    return trashPath;
  }

  /**
   * Move a file from src to dest, creating the destination directory if needed.
   */
  private async moveFile(src: string, dest: string): Promise<void> {
    await mkdir(dirname(dest), { recursive: true });
    await rename(src, dest);
  }

  /**
   * Delete a file, ignoring ENOENT (file already gone).
   * All other errors are logged and swallowed — DB is the source of truth.
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await rm(filePath, { force: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to delete file ${filePath}: ${String(err)}`);
      }
    }
  }
}
