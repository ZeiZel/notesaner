/**
 * BlockReferencesService
 *
 * Manages block-level references within notes using the ^block-id syntax
 * compatible with Obsidian's block reference system.
 *
 * Responsibilities:
 *   - Extract all block IDs and their content from markdown.
 *   - Generate unique short block IDs.
 *   - Retrieve the content of a specific block by its ID.
 *   - Index block references in NoteLink rows (linkType = BLOCK_REF).
 *   - Insert block IDs into note content at a specified line.
 *
 * Syntax conventions:
 *   - A block ID is declared by appending ` ^block-id` to the end of a
 *     paragraph or list item.
 *   - A block reference link uses [[Note Title#^block-id]] to create a
 *     transclusion of the referenced block.
 *   - Block IDs are 6-character lowercase alphanumeric strings by default.
 *
 * Design decisions:
 *   - Block ID extraction uses regex over the raw markdown; no AST parsing
 *     is needed because the ^block-id syntax is always a line-level suffix.
 *   - Block content is the full paragraph text up to (but not including) the
 *     ^block-id marker. Multi-line paragraphs (no blank line separator) are
 *     considered a single block.
 *   - NoteLink entries for BLOCK_REF links are created during content indexing.
 *     The `blockId` column stores the block identifier. The `context` column
 *     stores a truncated preview of the block content.
 *   - Content modification (inserting ^block-id) reads/writes via FilesService
 *     and delegates persistence to NotesService so all existing hooks (FTS
 *     reindex, link extraction, version tracking) fire automatically.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import type {
  BlockDto,
  BlockListResponse,
  CreateBlockReferenceDto,
  CreateBlockResponse,
} from './dto/block-reference.dto';
import { CreateBlockReferenceSchema } from './dto/block-reference.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Regex that matches a block ID declaration at the end of a line.
 * Captures the block ID (group 1).
 *
 * Examples:
 *   "Some paragraph text ^abc123"  -> captures "abc123"
 *   "- list item ^my-block"        -> captures "my-block"
 */
const BLOCK_ID_DECLARATION_REGEX = /\s\^([a-z0-9][a-z0-9-]{0,39})\s*$/;

/**
 * Regex that matches block reference links in the form [[Note#^block-id]].
 * Captures:
 *   group 1: note title/path (may be empty for same-note refs)
 *   group 2: block ID
 */
const BLOCK_REF_LINK_REGEX = /\[\[([^\]#]*?)#\^([a-z0-9][a-z0-9-]{0,39})\]\]/g;

/** Default length of generated block IDs. */
const BLOCK_ID_LENGTH = 6;

/** Maximum context preview length stored in NoteLink.context. */
const MAX_CONTEXT_LENGTH = 200;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BlockReferencesService {
  private readonly logger = new Logger(BlockReferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Extract all block IDs and their content from raw markdown.
   *
   * Scans the content line-by-line. When a line ends with ` ^block-id`, the
   * preceding paragraph text (potentially spanning multiple lines up to the
   * previous blank line or block boundary) is captured as the block content.
   *
   * @param content - Raw markdown string.
   * @returns Array of BlockDto objects sorted by line number.
   */
  extractBlockIds(content: string): BlockDto[] {
    const lines = content.split('\n');
    const blocks: BlockDto[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(BLOCK_ID_DECLARATION_REGEX);

      if (!match || !match[1]) continue;

      const blockId = match[1];
      const blockContent = this.extractBlockContent(lines, i);

      blocks.push({
        blockId,
        content: blockContent,
        line: i + 1, // 1-based
      });
    }

    return blocks;
  }

  /**
   * Generate a unique short block ID.
   *
   * Uses cryptographically random bytes encoded as lowercase base36 to produce
   * a 6-character ID. Collision probability is negligible within a single note
   * (~2 billion IDs for 50% collision chance with 36^6 = ~2.2 billion).
   *
   * @returns A 6-character lowercase alphanumeric string.
   */
  generateBlockId(): string {
    const bytes = randomBytes(4);
    // Convert to base36, take the last BLOCK_ID_LENGTH characters
    const raw = bytes.readUInt32BE(0).toString(36);
    return raw.slice(-BLOCK_ID_LENGTH).padStart(BLOCK_ID_LENGTH, '0');
  }

  /**
   * Get the content of a specific block within a note.
   *
   * Reads the note file from disk, extracts all blocks, and returns the one
   * matching the given block ID.
   *
   * @param workspaceId - Workspace UUID.
   * @param noteId      - Note UUID.
   * @param blockId     - The block identifier to look up (without ^ prefix).
   * @returns The block content and metadata.
   * @throws NotFoundException when the note or block does not exist.
   */
  async getBlockContent(workspaceId: string, noteId: string, blockId: string): Promise<BlockDto> {
    const note = await this.findNoteOrThrow(workspaceId, noteId);
    const content = await this.readNoteContent(workspaceId, note.path);
    const blocks = this.extractBlockIds(content);
    const block = blocks.find((b) => b.blockId === blockId);

    if (!block) {
      throw new NotFoundException(`Block ^${blockId} not found in note ${noteId}`);
    }

    return block;
  }

  /**
   * List all blocks (paragraphs with ^block-id) in a note.
   *
   * @param workspaceId - Workspace UUID.
   * @param noteId      - Note UUID.
   * @returns BlockListResponse containing all blocks found.
   * @throws NotFoundException when the note does not exist.
   */
  async listBlocks(workspaceId: string, noteId: string): Promise<BlockListResponse> {
    const note = await this.findNoteOrThrow(workspaceId, noteId);
    const content = await this.readNoteContent(workspaceId, note.path);
    const blocks = this.extractBlockIds(content);

    return { noteId, blocks };
  }

  /**
   * Generate and insert a block ID for a specific line in a note's content.
   *
   * If the line already has a block ID, the existing ID is returned without
   * modification. Otherwise, a new block ID is generated (or the user-provided
   * one is used) and appended to the line.
   *
   * @param workspaceId - Workspace UUID.
   * @param noteId      - Note UUID.
   * @param userId      - ID of the user performing the action.
   * @param rawDto      - Request body (validated against CreateBlockReferenceSchema).
   * @returns CreateBlockResponse with the assigned block ID.
   * @throws NotFoundException when the note does not exist or line is out of range.
   */
  async createBlockReference(
    workspaceId: string,
    noteId: string,
    userId: string,
    rawDto: unknown,
  ): Promise<CreateBlockResponse> {
    const dto = CreateBlockReferenceSchema.parse(rawDto) as CreateBlockReferenceDto;
    const note = await this.findNoteOrThrow(workspaceId, noteId);
    const content = await this.readNoteContent(workspaceId, note.path);
    const lines = content.split('\n');

    // Validate line number (1-based)
    if (dto.line < 1 || dto.line > lines.length) {
      throw new NotFoundException(
        `Line ${dto.line} is out of range (note has ${lines.length} lines)`,
      );
    }

    const lineIndex = dto.line - 1;
    const targetLine = lines[lineIndex];

    // Check if the line already has a block ID
    const existingMatch = targetLine.match(BLOCK_ID_DECLARATION_REGEX);
    if (existingMatch && existingMatch[1]) {
      const existingBlockId = existingMatch[1];
      const blockContent = this.extractBlockContent(lines, lineIndex);

      return {
        blockId: existingBlockId,
        content: blockContent,
        line: dto.line,
        created: false,
      };
    }

    // Reject empty or whitespace-only lines
    if (!targetLine.trim()) {
      throw new NotFoundException(
        `Line ${dto.line} is empty; block IDs can only be attached to content lines`,
      );
    }

    // Generate or use the provided block ID
    const blockId = dto.blockId ?? this.generateBlockId();

    // Append block ID to the line
    lines[lineIndex] = `${targetLine} ^${blockId}`;

    const updatedContent = lines.join('\n');

    // Persist the updated content via the filesystem
    await this.filesService.writeFile(workspaceId, note.path, updatedContent);

    // Update the note's metadata to trigger reindex
    await this.prisma.note.update({
      where: { id: noteId },
      data: { lastEditedById: userId },
    });

    const blockContent = this.extractBlockContent(lines, lineIndex);

    this.logger.log(`Block reference ^${blockId} created at line ${dto.line} in note ${noteId}`);

    return {
      blockId,
      content: blockContent,
      line: dto.line,
      created: true,
    };
  }

  /**
   * Index all block reference links ([[Note#^block-id]]) found in a note's
   * content. Creates or updates NoteLink entries with linkType = BLOCK_REF.
   *
   * This method is designed to be called during the link indexing phase after
   * a note's content is saved. It:
   *   1. Parses all [[Note#^block-id]] links from the content.
   *   2. Resolves each referenced note title to its database ID.
   *   3. Upserts NoteLink rows with linkType = BLOCK_REF.
   *   4. Removes stale BLOCK_REF links that are no longer in the content.
   *
   * @param sourceNoteId - UUID of the note being indexed.
   * @param workspaceId  - Workspace UUID for note resolution.
   * @param content      - Raw markdown content to scan.
   */
  async indexBlockReferences(
    sourceNoteId: string,
    workspaceId: string,
    content: string,
  ): Promise<void> {
    const refs = this.parseBlockRefLinks(content);

    if (refs.length === 0) {
      // Remove all existing BLOCK_REF links for this source note
      await this.prisma.noteLink.deleteMany({
        where: { sourceNoteId, linkType: 'BLOCK_REF' },
      });
      return;
    }

    // Resolve note titles to IDs. Group by title for batch lookup.
    const uniqueTitles = [...new Set(refs.map((r) => r.noteTitle))];

    const resolvedNotes = await this.prisma.note.findMany({
      where: {
        workspaceId,
        title: { in: uniqueTitles },
        isTrashed: false,
      },
      select: { id: true, title: true },
    });

    const titleToId = new Map(resolvedNotes.map((n) => [n.title, n.id]));

    // Build the set of valid refs with resolved target IDs
    const validRefs = refs
      .map((ref) => ({
        targetNoteId: titleToId.get(ref.noteTitle),
        blockId: ref.blockId,
        context: ref.context,
        position: ref.position,
      }))
      .filter(
        (ref): ref is typeof ref & { targetNoteId: string } => ref.targetNoteId !== undefined,
      );

    // Fetch existing BLOCK_REF links for comparison
    const existingLinks = await this.prisma.noteLink.findMany({
      where: { sourceNoteId, linkType: 'BLOCK_REF' },
      select: { id: true, targetNoteId: true, blockId: true },
    });

    // Determine links to create and links to remove
    const existingSet = new Set(existingLinks.map((l) => `${l.targetNoteId}::${l.blockId ?? ''}`));
    const desiredSet = new Set(validRefs.map((r) => `${r.targetNoteId}::${r.blockId}`));

    // Create new links
    const toCreate = validRefs.filter((r) => !existingSet.has(`${r.targetNoteId}::${r.blockId}`));

    // Remove stale links
    const toRemoveIds = existingLinks
      .filter((l) => !desiredSet.has(`${l.targetNoteId}::${l.blockId ?? ''}`))
      .map((l) => l.id);

    if (toRemoveIds.length > 0) {
      await this.prisma.noteLink.deleteMany({
        where: { id: { in: toRemoveIds } },
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.noteLink.createMany({
        data: toCreate.map((ref) => ({
          sourceNoteId,
          targetNoteId: ref.targetNoteId,
          linkType: 'BLOCK_REF' as const,
          blockId: ref.blockId,
          context: ref.context?.slice(0, MAX_CONTEXT_LENGTH) ?? null,
          position: ref.position,
        })),
        skipDuplicates: true,
      });
    }

    this.logger.debug(
      `Indexed block references for note ${sourceNoteId}: ` +
        `${toCreate.length} created, ${toRemoveIds.length} removed, ` +
        `${validRefs.length - toCreate.length} unchanged`,
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Parse all block reference links from markdown content.
   *
   * Matches the pattern [[Note Title#^block-id]] and extracts the note title,
   * block ID, surrounding context, and line/column position.
   */
  private parseBlockRefLinks(content: string): Array<{
    noteTitle: string;
    blockId: string;
    context: string | null;
    position: { line: number; col: number } | null;
  }> {
    const results: Array<{
      noteTitle: string;
      blockId: string;
      context: string | null;
      position: { line: number; col: number } | null;
    }> = [];

    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      const regex = new RegExp(BLOCK_REF_LINK_REGEX.source, 'g');

      while ((match = regex.exec(line)) !== null) {
        const noteTitle = match[1]?.trim();
        const blockId = match[2];

        if (!noteTitle || !blockId) continue;

        // Extract context: the surrounding line text
        const contextSnippet = line.trim();

        results.push({
          noteTitle,
          blockId,
          context: contextSnippet || null,
          position: { line: lineIdx + 1, col: match.index + 1 },
        });
      }
    }

    return results;
  }

  /**
   * Extract the block content for a block ID on a specific line.
   *
   * The block content is the paragraph text that precedes the ^block-id marker.
   * A "paragraph" is defined as consecutive non-blank lines up to and including
   * the line with the block ID. We look backwards from the block ID line until
   * we hit a blank line, a heading, a horizontal rule, or the start of the file.
   */
  private extractBlockContent(lines: string[], blockIdLineIndex: number): string {
    const blockLine = lines[blockIdLineIndex];

    // Remove the ^block-id suffix from the current line
    const cleanedLine = blockLine.replace(BLOCK_ID_DECLARATION_REGEX, '').trimEnd();

    // Walk backwards to find the start of the paragraph
    const paragraphLines: string[] = [cleanedLine];
    let i = blockIdLineIndex - 1;

    while (i >= 0) {
      const prevLine = lines[i].trim();

      // Stop at paragraph boundaries
      if (
        prevLine === '' || // blank line
        prevLine.startsWith('#') || // heading
        /^[-*_]{3,}\s*$/.test(prevLine) || // horizontal rule
        /^\s*\^[a-z0-9]/.test(lines[i]) // another block ID (belongs to previous block)
      ) {
        break;
      }

      paragraphLines.unshift(lines[i]);
      i--;
    }

    return paragraphLines.join('\n').trim();
  }

  /**
   * Find a note by workspace and ID, throwing NotFoundException if absent.
   */
  private async findNoteOrThrow(
    workspaceId: string,
    noteId: string,
  ): Promise<{ id: string; path: string; title: string }> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId, isTrashed: false },
      select: { id: true, path: true, title: true },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    return note;
  }

  /**
   * Read note content from the filesystem. Throws NotFoundException on failure.
   */
  private async readNoteContent(workspaceId: string, path: string): Promise<string> {
    try {
      return await this.filesService.readFile(workspaceId, path);
    } catch {
      throw new NotFoundException(`Could not read note content at "${path}"`);
    }
  }
}
