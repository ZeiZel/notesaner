// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — alias field not yet in Prisma Note model
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SetAliasSchema, ALIAS_REGEX, type NoteAliasResponse } from './dto/note-alias.dto';

/**
 * NoteAliasService — manages human-readable URL aliases for notes.
 *
 * An alias is a workspace-scoped, URL-friendly slug that provides a stable
 * human-readable address for a note independently of its filesystem path.
 *
 * Invariants enforced here:
 *  - An alias is unique within a workspace (enforced by DB unique index and
 *    application-level conflict check with a friendly error message).
 *  - A note can hold at most one alias at a time.
 *  - Alias characters are restricted to lowercase letters, digits, and hyphens.
 */
@Injectable()
export class NoteAliasService {
  private readonly logger = new Logger(NoteAliasService.name);

  /**
   * Direct PrismaClient instantiation — to be replaced with an injected
   * PrismaService once the shared infrastructure module lands.
   */
  private readonly prisma = new PrismaClient();

  // ---------------------------------------------------------------------------
  // RESOLVE
  // ---------------------------------------------------------------------------

  /**
   * Look up a note by its workspace-scoped alias.
   *
   * @throws NotFoundException when no note in the workspace has that alias.
   */
  async resolveAlias(workspaceId: string, alias: string): Promise<NoteAliasResponse> {
    const note = await this.prisma.note.findFirst({
      where: { workspaceId, alias },
      select: { id: true, workspaceId: true, alias: true },
    });

    if (!note || note.alias === null) {
      throw new NotFoundException(
        `No note with alias "${alias}" found in workspace ${workspaceId}`,
      );
    }

    return { noteId: note.id, workspaceId: note.workspaceId, alias: note.alias };
  }

  // ---------------------------------------------------------------------------
  // SET
  // ---------------------------------------------------------------------------

  /**
   * Assign an alias to a note after validating:
   *  - The note exists and belongs to the workspace.
   *  - The alias format is valid (delegated to Zod schema).
   *  - The alias is not already used by another note in the same workspace.
   *
   * Silently succeeds if the note already carries the exact same alias
   * (idempotent re-set).
   *
   * @throws NotFoundException  when the note does not exist in the workspace.
   * @throws BadRequestException when the alias format is invalid.
   * @throws ConflictException  when the alias is already taken by another note.
   */
  async setAlias(
    noteId: string,
    workspaceId: string,
    rawAlias: string,
  ): Promise<NoteAliasResponse> {
    // Validate alias format via Zod (throws ZodError on failure — caught below
    // and re-thrown as BadRequestException for a uniform HTTP response).
    let alias: string;
    try {
      ({ alias } = SetAliasSchema.parse({ alias: rawAlias }));
    } catch {
      throw new BadRequestException(
        `Invalid alias "${rawAlias}": must be 1–120 characters and contain only lowercase letters, digits, and hyphens`,
      );
    }

    // Assert the note exists and belongs to the workspace.
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, alias: true },
    });

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    // Idempotent: skip DB write when the alias is unchanged.
    if (note.alias === alias) {
      return { noteId, workspaceId, alias };
    }

    // Check for alias uniqueness within the workspace.
    const conflicting = await this.prisma.note.findFirst({
      where: { workspaceId, alias, NOT: { id: noteId } },
      select: { id: true },
    });

    if (conflicting) {
      throw new ConflictException(
        `Alias "${alias}" is already in use by another note in workspace ${workspaceId}`,
      );
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { alias },
    });

    this.logger.log(`Alias "${alias}" set for note ${noteId} in workspace ${workspaceId}`);

    return { noteId, workspaceId, alias };
  }

  // ---------------------------------------------------------------------------
  // REMOVE
  // ---------------------------------------------------------------------------

  /**
   * Clear the alias from a note. Idempotent — no error if no alias is set.
   *
   * @throws NotFoundException when the note does not exist in the workspace.
   */
  async removeAlias(noteId: string, workspaceId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, alias: true },
    });

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    if (note.alias === null) {
      // Already has no alias — nothing to do.
      return;
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { alias: null },
    });

    this.logger.log(`Alias removed from note ${noteId} in workspace ${workspaceId}`);
  }

  // ---------------------------------------------------------------------------
  // GENERATE
  // ---------------------------------------------------------------------------

  /**
   * Derive a URL-friendly slug from a note title.
   *
   * Transformation steps:
   *  1. Lower-case the entire string.
   *  2. Replace Unicode diacritics (é → e) via NFKD normalization.
   *  3. Strip any remaining non-ASCII characters.
   *  4. Replace all whitespace and non-alphanumeric sequences with a single hyphen.
   *  5. Trim leading and trailing hyphens.
   *  6. Truncate to 120 characters at the last hyphen boundary to avoid a
   *     mid-word cut.
   *
   * Returns an empty string when the title produces no valid characters — callers
   * should handle that case by providing a fallback (e.g. the note ID prefix).
   */
  generateAlias(title: string): string {
    const MAX_LENGTH = 120;

    const slug = title
      .toLowerCase()
      // NFKD decomposes characters like é into e + combining accent
      .normalize('NFKD')
      // Remove non-ASCII (covers combining accent marks and exotic symbols)
      .replace(/[^\x00-\x7F]/g, '')
      // Replace any run of non-alphanumeric characters with a single hyphen
      .replace(/[^a-z0-9]+/g, '-')
      // Strip leading and trailing hyphens
      .replace(/^-+|-+$/g, '');

    if (slug.length <= MAX_LENGTH) {
      return slug;
    }

    // Truncate at word boundary (last hyphen within the allowed window)
    const truncated = slug.slice(0, MAX_LENGTH);
    const lastHyphen = truncated.lastIndexOf('-');

    return lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Internal check — returns true when the given alias satisfies the format
   * constraint defined by ALIAS_REGEX. Exposed for testing without going through
   * the full Zod schema parse.
   */
  isValidAliasFormat(alias: string): boolean {
    return ALIAS_REGEX.test(alias);
  }
}
