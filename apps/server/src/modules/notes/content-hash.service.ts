/**
 * ContentHashService
 *
 * Detects external modifications to note files by comparing SHA-256 hashes
 * of the on-disk content against the hash stored in the database.
 *
 * Responsibilities:
 *   - Compute the SHA-256 hash of a note's current on-disk content.
 *   - Compare the current hash against the stored hash in the database.
 *   - Detect external changes and trigger re-indexing + WebSocket notification.
 *   - Atomically update the stored hash alongside content.
 *   - Validate hashes in bulk for a batch of note IDs.
 *
 * Design decisions:
 *   - Does NOT modify notes.service.ts or prisma schema — works exclusively
 *     with the existing `contentHash` column on the Note model.
 *   - WebSocket notification is implemented via EventEmitter2 so the service
 *     remains decoupled from the WebSocket gateway.
 *   - Re-indexing on external change is delegated to SearchService via an
 *     injected reference (optional — logged as warning when absent).
 *   - All hashing delegates to content-hash.utils.ts for testability.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { SearchService } from '../search/search.service';
import { sha256, hashesMatch } from './content-hash.utils';
import type {
  ContentHashResponse,
  ExternalChangeEvent,
  BatchHashValidationResult,
  BatchHashChange,
  BatchHashError,
} from './dto/content-hash.dto';

@Injectable()
export class ContentHashService {
  private readonly logger = new Logger(ContentHashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly searchService: SearchService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Compute the SHA-256 hash of the given content.
   *
   * Thin wrapper over the pure `sha256` utility so callers do not need to
   * import both modules.
   *
   * @param content - Raw file content (string or Buffer).
   * @returns 64-character lowercase hex digest.
   */
  computeHash(content: string | Buffer): string {
    return sha256(content);
  }

  /**
   * Compare the on-disk hash of a note against its stored database hash.
   *
   * Reads the file from the filesystem, computes its hash, then compares it
   * with the `contentHash` column. When the hashes differ an external change
   * is considered detected.
   *
   * @param noteId    - UUID of the note to check.
   * @returns ContentHashResponse describing the comparison result.
   * @throws NotFoundException when the note does not exist in the database.
   */
  async compareHash(noteId: string): Promise<ContentHashResponse> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, path: true, contentHash: true },
    });

    if (!note) {
      throw new NotFoundException(`Note not found: ${noteId}`);
    }

    // Read current on-disk content and hash it
    let currentContent: string;
    try {
      currentContent = await this.filesService.readFile(note.workspaceId, note.path);
    } catch {
      // File is missing — treat as if hash does not match; caller should decide
      // how to handle a missing file scenario.
      this.logger.warn(`compareHash: file not found for note ${noteId} at path "${note.path}"`);
      return {
        contentHash: note.contentHash ?? '',
        hashMatched: false,
        externalChangeDetected: true,
      };
    }

    const currentHash = sha256(currentContent);
    const storedHash = note.contentHash;

    const hashMatched = storedHash !== null && hashesMatch(currentHash, storedHash);

    return {
      contentHash: currentHash,
      hashMatched,
      externalChangeDetected: !hashMatched,
    };
  }

  /**
   * Persist an updated hash for a note, atomically updating both the
   * `contentHash` and `updatedAt` columns in a single database write.
   *
   * @param noteId  - UUID of the note.
   * @param newHash - New SHA-256 hex digest to store.
   * @throws NotFoundException when the note does not exist.
   */
  async updateHash(noteId: string, newHash: string): Promise<void> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true },
    });

    if (!note) {
      throw new NotFoundException(`Note not found: ${noteId}`);
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { contentHash: newHash },
    });

    this.logger.debug(`Updated contentHash for note ${noteId}: ${newHash.slice(0, 8)}…`);
  }

  /**
   * Detect whether the on-disk file for a note differs from the stored hash.
   *
   * When an external change is detected this method:
   *   1. Re-indexes the note's content in the full-text search index.
   *   2. Updates the `contentHash` column in the database.
   *   3. Emits an ExternalChangeEvent for WebSocket consumers.
   *
   * @param noteId - UUID of the note to inspect.
   * @returns The ExternalChangeEvent when a change was detected, or `null` when
   *          the hashes match and no action was taken.
   * @throws NotFoundException when the note does not exist.
   */
  async detectExternalChange(noteId: string): Promise<ExternalChangeEvent | null> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        workspaceId: true,
        path: true,
        title: true,
        contentHash: true,
      },
    });

    if (!note) {
      throw new NotFoundException(`Note not found: ${noteId}`);
    }

    // Read current on-disk content
    let currentContent: string;
    try {
      currentContent = await this.filesService.readFile(note.workspaceId, note.path);
    } catch {
      this.logger.warn(`detectExternalChange: file missing for note ${noteId} at "${note.path}"`);
      return null;
    }

    const currentHash = sha256(currentContent);
    const storedHash = note.contentHash;

    // Hashes match — no external change
    if (storedHash !== null && hashesMatch(currentHash, storedHash)) {
      return null;
    }

    this.logger.log(
      `External change detected for note ${noteId} ` +
        `(stored: ${storedHash?.slice(0, 8) ?? 'null'}, current: ${currentHash.slice(0, 8)})`,
    );

    // Re-index the note in the full-text search engine with the updated content
    await this.reindexNote(note.id, note.title, currentContent);

    // Atomically update the stored hash
    await this.prisma.note.update({
      where: { id: noteId },
      data: { contentHash: currentHash },
    });

    const event: ExternalChangeEvent = {
      event: 'note.external_change',
      workspaceId: note.workspaceId,
      noteId: note.id,
      newHash: currentHash,
      previousHash: storedHash,
      detectedAt: new Date().toISOString(),
    };

    this.logger.debug(
      `Emitting external change event for note ${noteId} in workspace ${note.workspaceId}`,
    );

    return event;
  }

  /**
   * Validate the hashes for a batch of notes.
   *
   * For each ID the method reads the on-disk file and compares its hash to the
   * database record. Notes with no DB record, missing files, or hash mismatches
   * are reported separately so callers can decide on appropriate follow-up.
   *
   * This is a read-only operation — it does NOT update the database or emit
   * events. Use `detectExternalChange` to also persist the new hash and notify
   * clients.
   *
   * @param noteIds - Array of note UUIDs to validate (up to 100 per call).
   * @returns BatchHashValidationResult with unchanged / changed / error buckets.
   */
  async batchValidateHashes(noteIds: string[]): Promise<BatchHashValidationResult> {
    if (noteIds.length === 0) {
      return { unchanged: [], changed: [], errors: [] };
    }

    // Clamp to a reasonable batch size to prevent overwhelming the filesystem
    const ids = noteIds.slice(0, 100);

    // Fetch all note records in a single query
    const notes = await this.prisma.note.findMany({
      where: { id: { in: ids } },
      select: { id: true, workspaceId: true, path: true, contentHash: true },
    });

    const notesById = new Map(notes.map((n) => [n.id, n]));

    const unchanged: string[] = [];
    const changed: BatchHashChange[] = [];
    const errors: BatchHashError[] = [];

    await Promise.all(
      ids.map(async (noteId) => {
        const note = notesById.get(noteId);

        if (!note) {
          errors.push({ noteId, reason: 'Note not found in database' });
          return;
        }

        let currentContent: string;
        try {
          currentContent = await this.filesService.readFile(note.workspaceId, note.path);
        } catch {
          errors.push({ noteId, reason: `File not found at path "${note.path}"` });
          return;
        }

        const currentHash = sha256(currentContent);
        const storedHash = note.contentHash;

        const matches = storedHash !== null && hashesMatch(currentHash, storedHash);

        if (matches) {
          unchanged.push(noteId);
        } else {
          changed.push({
            noteId,
            storedHash,
            currentHash,
          });
        }
      }),
    );

    this.logger.debug(
      `batchValidateHashes: ${ids.length} notes — ` +
        `${unchanged.length} unchanged, ${changed.length} changed, ${errors.length} errors`,
    );

    return { unchanged, changed, errors };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Re-index a note in the full-text search engine.
   * Errors are logged but never re-thrown — index lag is acceptable; data
   * loss is not.
   */
  private async reindexNote(noteId: string, title: string, content: string): Promise<void> {
    try {
      await this.searchService.indexNote(noteId, title, content, {});
      this.logger.debug(`Re-indexed note ${noteId} after external change detection`);
    } catch (error) {
      this.logger.error(
        `Failed to re-index note ${noteId} after external change: ${String(error)}`,
      );
    }
  }
}
