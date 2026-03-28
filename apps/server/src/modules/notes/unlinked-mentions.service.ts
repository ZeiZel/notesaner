/**
 * UnlinkedMentionsService
 *
 * Detects notes in a workspace that mention the target note's title in their
 * plain-text content but do NOT have a formal wiki/markdown link pointing to it.
 * This supports the Zettelkasten "suggest a link" workflow.
 *
 * Design decisions:
 *   - Discovery uses the PostgreSQL full-text search vector (search_vector
 *     column) populated by the NoteIndexing background job. FTS is used because
 *     it handles stemming / accents without a full content scan; fallback to
 *     an empty result set when the FTS migration has not been applied.
 *   - Context snippets are extracted by reading the source note's raw markdown
 *     from the filesystem and finding the first occurrence of the target title
 *     in plain text (not inside [[wiki links]] already indexed). This gives
 *     users a human-readable preview showing where the mention appears.
 *   - The "create link" action appends a [[wiki-link]] insertion to a POST
 *     endpoint. It delegates to NotesService.update() so all existing hooks
 *     (FTS reindex, link extraction, tag sync) fire automatically.
 *   - Context extraction is best-effort: if the file cannot be read the row
 *     is still returned with a generic context string.
 *
 * Registration note (for wiring into notes.module.ts):
 *   providers: [..., UnlinkedMentionsService]
 *   controllers: [..., UnlinkedMentionsController]
 *   exports: [..., UnlinkedMentionsService]
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { NotesService } from './notes.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum mentions returned per request. */
const MAX_RESULTS = 50;

/**
 * Number of characters to extract before and after a mention for context.
 * Kept deliberately small so the sidebar snippet stays readable.
 */
const CONTEXT_RADIUS = 120;

/**
 * Regex fragment that matches a [[wiki link]] opening so we can avoid
 * counting existing formal links as unlinked mentions.
 * We match "[[" followed immediately by the title to detect wiki-link syntax.
 */
const WIKI_LINK_PREFIX = '[[';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UnlinkedMentionDto {
  /** UUID of the note that contains the unlinked mention. */
  sourceNoteId: string;
  /** Display title of the source note. */
  sourceNoteTitle: string;
  /** Workspace-relative path of the source note. */
  sourceNotePath: string;
  /**
   * A short excerpt of the source note content around the first plain-text
   * mention of the target note's title.
   */
  context: string;
  /**
   * Character offset of the mention within the source note's raw markdown.
   * Useful for editor integrations that want to scroll to the mention.
   */
  position: number;
}

export interface CreateLinkDto {
  /**
   * ID of the note that contains the unlinked mention (the source note).
   * The service will insert a [[wiki-link]] next to the first plain-text
   * occurrence of the target title in this note's content.
   */
  sourceNoteId: string;
}

export interface CreateLinkResult {
  /** Whether the link was successfully inserted. */
  success: boolean;
  /**
   * Human-readable message describing what happened.
   * Includes the reason when success=false.
   */
  message: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class UnlinkedMentionsService {
  private readonly logger = new Logger(UnlinkedMentionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly notesService: NotesService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Find notes in the workspace that mention `noteId`'s title in plain text
   * but do not have a formal NoteLink pointing to it.
   *
   * Returns up to MAX_RESULTS entries, each with a context snippet extracted
   * from the actual file content so users can see the mention in context.
   *
   * An empty array is returned when:
   *   - The target note does not exist.
   *   - The note's title is empty or whitespace-only.
   *   - FTS is unavailable (migration not applied).
   */
  async findUnlinkedMentions(workspaceId: string, noteId: string): Promise<UnlinkedMentionDto[]> {
    // Resolve the target note's title — the string we search for.
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId },
      select: { title: true },
    });

    if (!note || !note.title.trim()) {
      return [];
    }

    const targetTitle = note.title.trim();

    // Use FTS to find candidate notes whose indexed content matches the title.
    // Notes that already have a formal backlink are excluded via NOT EXISTS.
    let candidates: Array<{ id: string; title: string; path: string }>;

    try {
      candidates = await this.prisma.$queryRaw<Array<{ id: string; title: string; path: string }>>`
        SELECT n.id, n.title, n.path
        FROM notes n
        WHERE n.workspace_id   = ${workspaceId}
          AND n.id            <> ${noteId}
          AND n.is_trashed     = false
          AND n.search_vector @@ plainto_tsquery('english', ${targetTitle})
          AND NOT EXISTS (
            SELECT 1 FROM note_links nl
            WHERE nl."sourceNoteId" = n.id
              AND nl."targetNoteId" = ${noteId}
          )
        ORDER BY n.updated_at DESC
        LIMIT ${MAX_RESULTS}
      `;
    } catch (err) {
      // FTS migration not yet applied — degrade gracefully.
      this.logger.debug(
        `findUnlinkedMentions: FTS unavailable for workspace ${workspaceId}: ${String(err)}`,
      );
      return [];
    }

    if (candidates.length === 0) {
      return [];
    }

    // Enrich each candidate with a real context snippet extracted from the
    // markdown source file. This is done in parallel for performance.
    const results = await Promise.all(
      candidates.map((candidate) => this.enrichWithContext(workspaceId, candidate, targetTitle)),
    );

    // Filter out candidates where we couldn't find an actual plain-text
    // mention (FTS may match on stemmed/weighted tokens not visible as text).
    return results.filter((r): r is UnlinkedMentionDto => r !== null);
  }

  /**
   * Insert a [[wiki-link]] for `targetNoteId` next to the first plain-text
   * occurrence of the target note's title in `sourceNoteId`'s content.
   *
   * Strategy:
   *   1. Read the source note's current content.
   *   2. Find the first occurrence of the target title that is NOT already
   *      inside a [[wiki link]] or [markdown](link).
   *   3. Replace that occurrence with `[[Target Title]]`.
   *   4. Persist the updated content via NotesService.update() so link
   *      extraction, FTS reindex, and tag sync all fire automatically.
   *
   * Returns `{ success: false }` (never throws) so the UI can display a
   * friendly message rather than a 500 on edge cases.
   */
  async createLinkFromMention(
    workspaceId: string,
    targetNoteId: string,
    sourceNoteId: string,
    userId: string,
  ): Promise<CreateLinkResult> {
    // Resolve target note title
    const targetNote = await this.prisma.note.findFirst({
      where: { id: targetNoteId, workspaceId },
      select: { title: true },
    });

    if (!targetNote) {
      return { success: false, message: 'Target note not found' };
    }

    // Resolve source note
    const sourceNote = await this.prisma.note.findFirst({
      where: { id: sourceNoteId, workspaceId, isTrashed: false },
      select: { path: true },
    });

    if (!sourceNote) {
      return { success: false, message: 'Source note not found or is trashed' };
    }

    let content: string;
    try {
      content = await this.filesService.readFile(workspaceId, sourceNote.path);
    } catch (err) {
      this.logger.error(`createLinkFromMention: cannot read "${sourceNote.path}": ${String(err)}`);
      return { success: false, message: 'Could not read source note content' };
    }

    const targetTitle = targetNote.title.trim();

    const updatedContent = this.insertWikiLink(content, targetTitle);

    if (updatedContent === content) {
      // No plain-text mention found — the FTS match may have been on stemmed
      // tokens not literally present in the raw text.
      return {
        success: false,
        message: `No unlinked plain-text mention of "${targetTitle}" found in source note`,
      };
    }

    try {
      await this.notesService.update(workspaceId, sourceNoteId, userId, {
        content: updatedContent,
      });
    } catch (err) {
      this.logger.error(
        `createLinkFromMention: failed to update note ${sourceNoteId}: ${String(err)}`,
      );
      return { success: false, message: 'Failed to persist link insertion' };
    }

    this.logger.log(
      `createLinkFromMention: inserted [[${targetTitle}]] into note ${sourceNoteId} (workspace ${workspaceId})`,
    );

    return {
      success: true,
      message: `Linked "[[${targetTitle}]]" inserted in source note`,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Enrich a candidate note with a context snippet extracted from its raw
   * markdown content.
   *
   * Returns null when no plain-text (non-wiki-link) occurrence of the target
   * title can be found in the file — this filters out false-positive FTS hits.
   */
  private async enrichWithContext(
    workspaceId: string,
    candidate: { id: string; title: string; path: string },
    targetTitle: string,
  ): Promise<UnlinkedMentionDto | null> {
    let content: string;

    try {
      content = await this.filesService.readFile(workspaceId, candidate.path);
    } catch {
      // File unreadable — return a generic context rather than dropping the row
      this.logger.debug(
        `enrichWithContext: cannot read "${candidate.path}" — using generic context`,
      );

      return {
        sourceNoteId: candidate.id,
        sourceNoteTitle: candidate.title,
        sourceNotePath: candidate.path,
        context: `Mentions "${targetTitle}"`,
        position: 0,
      };
    }

    const position = this.findPlainTextMention(content, targetTitle);

    if (position === -1) {
      // No literal plain-text match — this was a stemmed FTS match only.
      return null;
    }

    const context = this.extractContext(content, position, targetTitle.length);

    return {
      sourceNoteId: candidate.id,
      sourceNoteTitle: candidate.title,
      sourceNotePath: candidate.path,
      context,
      position,
    };
  }

  /**
   * Find the first occurrence of `title` in `content` that is NOT inside a
   * [[wiki link]] or [markdown](link).
   *
   * Uses a case-insensitive search and checks the surrounding characters to
   * exclude wiki-link syntax.
   *
   * Returns -1 when no plain-text occurrence exists.
   */
  private findPlainTextMention(content: string, title: string): number {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    let searchFrom = 0;

    while (searchFrom < contentLower.length) {
      const idx = contentLower.indexOf(titleLower, searchFrom);

      if (idx === -1) {
        return -1;
      }

      // Check if this occurrence is immediately preceded by [[ (wiki link)
      const precededByWikiOpen = idx >= 2 && content.slice(idx - 2, idx) === WIKI_LINK_PREFIX;

      // Check if the occurrence is inside a markdown link: [text](title)
      // by looking for "(" immediately before the title.
      const precededByMdLink = idx >= 1 && content[idx - 1] === '(';

      if (!precededByWikiOpen && !precededByMdLink) {
        // Check the character before — must be a word boundary (space,
        // newline, punctuation, or start of string) to avoid partial matches.
        const charBefore = idx > 0 ? content[idx - 1] : ' ';
        const charAfter = idx + title.length < content.length ? content[idx + title.length] : ' ';

        const isBoundaryBefore = /\W/.test(charBefore);
        const isBoundaryAfter = /\W/.test(charAfter);

        if (isBoundaryBefore && isBoundaryAfter) {
          return idx;
        }
      }

      // Advance past this occurrence and keep looking.
      searchFrom = idx + 1;
    }

    return -1;
  }

  /**
   * Extract a human-readable context snippet around a character position.
   *
   * Trims whitespace and ellipsis-pads when the window extends beyond the
   * content boundaries so the snippet always makes sense in isolation.
   */
  private extractContext(content: string, position: number, mentionLength: number): string {
    const start = Math.max(0, position - CONTEXT_RADIUS);
    const end = Math.min(content.length, position + mentionLength + CONTEXT_RADIUS);

    let snippet = content.slice(start, end);

    // Replace newlines with spaces for single-line display
    snippet = snippet.replace(/\n+/g, ' ').trim();

    // Add ellipsis where content was truncated
    if (start > 0) snippet = `\u2026${snippet}`;
    if (end < content.length) snippet = `${snippet}\u2026`;

    return snippet;
  }

  /**
   * Replace the first plain-text (non-wiki-link) occurrence of `targetTitle`
   * in `content` with `[[targetTitle]]`.
   *
   * Returns the original content unchanged when no suitable occurrence is found.
   */
  private insertWikiLink(content: string, targetTitle: string): string {
    const position = this.findPlainTextMention(content, targetTitle);

    if (position === -1) {
      return content;
    }

    const before = content.slice(0, position);
    const after = content.slice(position + targetTitle.length);

    return `${before}[[${targetTitle}]]${after}`;
  }
}
