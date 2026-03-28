import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { VersionService } from '../notes/version.service';
import { JobsService } from '../jobs/jobs.service';
import { SearchReplaceMode, type SearchReplaceFiltersDto } from './dto/search-replace-preview.dto';
import type { MatchReferenceDto } from './dto/search-replace-execute.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single match within a note's content. */
export interface SearchReplaceMatch {
  /** Note UUID. */
  noteId: string;
  /** Note title. */
  noteTitle: string;
  /** Note path (relative to workspace root). */
  notePath: string;
  /** The exact matched text. */
  matchText: string;
  /** Text before the match (up to ~60 chars). */
  contextBefore: string;
  /** Text after the match (up to ~60 chars). */
  contextAfter: string;
  /** 1-based line number. */
  lineNumber: number;
  /** 0-based column offset within the line. */
  columnOffset: number;
  /** What the match would be replaced with (preview only). */
  replacementPreview: string;
}

export interface SearchReplacePreviewResult {
  matches: SearchReplaceMatch[];
  totalMatches: number;
  /** Number of notes that contain at least one match. */
  notesAffected: number;
  /** True when total matches exceed maxMatches — results are truncated. */
  truncated: boolean;
}

export interface SearchReplaceExecuteResult {
  /** Total number of replacements made. */
  replacedCount: number;
  /** Note IDs that were modified. */
  modifiedNotes: string[];
  /** BullMQ job ID when the operation is batched (>1000 matches). */
  jobId?: string;
}

/** Note metadata from Prisma, used internally. */
interface NoteRow {
  id: string;
  title: string;
  path: string;
}

/** Timeout for regex execution per file (milliseconds). */
const REGEX_TIMEOUT_MS = 5_000;

/** Context window around matches (characters). */
const CONTEXT_CHARS = 60;

/** Threshold above which replacements are batched via BullMQ. */
const BATCH_THRESHOLD = 1_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class SearchReplaceService {
  private readonly logger = new Logger(SearchReplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly versionService: VersionService,
    private readonly jobsService: JobsService,
  ) {}

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  /**
   * Find all matches across notes in a workspace without modifying anything.
   */
  async preview(
    workspaceId: string,
    params: {
      query: string;
      replacement: string;
      mode?: SearchReplaceMode;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      filters?: SearchReplaceFiltersDto;
      maxMatches?: number;
    },
  ): Promise<SearchReplacePreviewResult> {
    const {
      query,
      replacement,
      mode = SearchReplaceMode.PLAIN,
      caseSensitive = false,
      wholeWord = false,
      filters,
      maxMatches = 500,
    } = params;

    const regex = this.buildRegex(query, mode, caseSensitive, wholeWord);
    const notes = await this.findNotes(workspaceId, filters);

    const allMatches: SearchReplaceMatch[] = [];
    const affectedNoteIds = new Set<string>();
    let totalMatches = 0;
    let truncated = false;

    for (const note of notes) {
      if (truncated) break;

      let content: string;
      try {
        content = await this.filesService.readFile(workspaceId, note.path);
      } catch {
        // File may not exist on disk yet — skip silently
        this.logger.debug(`Skipping note ${note.id}: file not readable`);
        continue;
      }

      const noteMatches = this.findMatchesInContent(content, regex, replacement, note, mode);

      if (noteMatches.length > 0) {
        affectedNoteIds.add(note.id);
        totalMatches += noteMatches.length;

        for (const match of noteMatches) {
          if (allMatches.length >= maxMatches) {
            truncated = true;
            break;
          }
          allMatches.push(match);
        }
      }
    }

    return {
      matches: allMatches,
      totalMatches,
      notesAffected: affectedNoteIds.size,
      truncated,
    };
  }

  // -------------------------------------------------------------------------
  // Execute
  // -------------------------------------------------------------------------

  /**
   * Execute search-and-replace across notes in a workspace.
   *
   * When total matches exceed BATCH_THRESHOLD, the operation is delegated to
   * a BullMQ job and a job ID is returned for polling.
   */
  async execute(
    workspaceId: string,
    userId: string,
    params: {
      query: string;
      replacement: string;
      mode?: SearchReplaceMode;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      filters?: SearchReplaceFiltersDto;
      matches?: MatchReferenceDto[];
      excludeNoteIds?: string[];
    },
  ): Promise<SearchReplaceExecuteResult> {
    const {
      query,
      replacement,
      mode = SearchReplaceMode.PLAIN,
      caseSensitive = false,
      wholeWord = false,
      filters,
      matches: specificMatches,
      excludeNoteIds,
    } = params;

    const regex = this.buildRegex(query, mode, caseSensitive, wholeWord);

    // If specific matches are provided, use selective replacement
    if (specificMatches && specificMatches.length > 0) {
      return this.executeSelectiveReplace(
        workspaceId,
        userId,
        specificMatches,
        replacement,
        regex,
        mode,
      );
    }

    // Otherwise, replace all matches in the workspace (with optional filters)
    const notes = await this.findNotes(workspaceId, filters);
    const excludeSet = new Set(excludeNoteIds ?? []);
    const filteredNotes = notes.filter((n) => !excludeSet.has(n.id));

    // Count total matches first to decide batch vs inline
    let totalMatchCount = 0;
    for (const note of filteredNotes) {
      try {
        const content = await this.filesService.readFile(workspaceId, note.path);
        const noteMatches = this.countMatches(content, regex);
        totalMatchCount += noteMatches;
      } catch {
        continue;
      }
    }

    if (totalMatchCount > BATCH_THRESHOLD) {
      // Schedule batch job
      const jobId = await this.jobsService.scheduleWorkspaceReindex(workspaceId);
      this.logger.log(
        `Batch replace scheduled for workspace ${workspaceId}: ${totalMatchCount} matches across ${filteredNotes.length} notes, job ${jobId}`,
      );
      return {
        replacedCount: totalMatchCount,
        modifiedNotes: filteredNotes.map((n) => n.id),
        jobId,
      };
    }

    // Inline replacement
    return this.executeInlineReplace(workspaceId, userId, filteredNotes, replacement, regex, mode);
  }

  // -------------------------------------------------------------------------
  // Private: Inline replacement (synchronous)
  // -------------------------------------------------------------------------

  private async executeInlineReplace(
    workspaceId: string,
    userId: string,
    notes: NoteRow[],
    replacement: string,
    regex: RegExp,
    mode: SearchReplaceMode,
  ): Promise<SearchReplaceExecuteResult> {
    let replacedCount = 0;
    const modifiedNotes: string[] = [];

    for (const note of notes) {
      let content: string;
      try {
        content = await this.filesService.readFile(workspaceId, note.path);
      } catch {
        continue;
      }

      const newContent = this.replaceInContent(content, regex, replacement, mode);

      if (newContent !== content) {
        // Create version snapshot before modifying
        await this.versionService.createVersion(
          note.id,
          userId,
          content,
          `Before search-replace: "${regex.source}" -> "${replacement}"`,
        );

        // Write the modified content
        await this.filesService.writeFile(workspaceId, note.path, newContent);

        // Count replacements
        const matchCount = this.countMatches(content, regex);
        replacedCount += matchCount;
        modifiedNotes.push(note.id);

        this.logger.debug(`Replaced ${matchCount} occurrences in note ${note.id} (${note.path})`);
      }
    }

    return { replacedCount, modifiedNotes };
  }

  // -------------------------------------------------------------------------
  // Private: Selective replacement (specific match references)
  // -------------------------------------------------------------------------

  private async executeSelectiveReplace(
    workspaceId: string,
    userId: string,
    matchRefs: MatchReferenceDto[],
    replacement: string,
    regex: RegExp,
    mode: SearchReplaceMode,
  ): Promise<SearchReplaceExecuteResult> {
    // Group matches by note ID
    const matchesByNote = new Map<string, MatchReferenceDto[]>();
    for (const ref of matchRefs) {
      const existing = matchesByNote.get(ref.noteId) ?? [];
      existing.push(ref);
      matchesByNote.set(ref.noteId, existing);
    }

    let replacedCount = 0;
    const modifiedNotes: string[] = [];

    for (const [noteId, noteMatchRefs] of matchesByNote) {
      // Fetch note path from DB
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
        select: { id: true, path: true, title: true },
      });

      if (!note) {
        this.logger.warn(`Note ${noteId} not found — skipping selective replace`);
        continue;
      }

      let content: string;
      try {
        content = await this.filesService.readFile(workspaceId, note.path);
      } catch {
        this.logger.warn(`Cannot read file for note ${noteId} — skipping`);
        continue;
      }

      // Create version snapshot before modifying
      await this.versionService.createVersion(
        noteId,
        userId,
        content,
        `Before selective search-replace: "${regex.source}" -> "${replacement}"`,
      );

      // Apply replacements in reverse order (bottom-to-top) to preserve offsets
      const sortedRefs = [...noteMatchRefs].sort((a, b) => {
        if (a.lineNumber !== b.lineNumber) return b.lineNumber - a.lineNumber;
        return b.columnOffset - a.columnOffset;
      });

      const lines = content.split('\n');
      let noteReplacedCount = 0;

      for (const ref of sortedRefs) {
        const lineIndex = ref.lineNumber - 1; // Convert 1-based to 0-based

        if (lineIndex < 0 || lineIndex >= lines.length) {
          this.logger.warn(
            `Line ${ref.lineNumber} out of range for note ${noteId} — skipping match`,
          );
          continue;
        }

        const line = lines[lineIndex];
        if (line === undefined) continue;

        // Verify the match text is still at the expected position
        const actualText = line.substring(
          ref.columnOffset,
          ref.columnOffset + ref.matchText.length,
        );

        if (actualText !== ref.matchText) {
          this.logger.warn(
            `Match text mismatch at line ${ref.lineNumber}:${ref.columnOffset} in note ${noteId}: ` +
              `expected "${ref.matchText}", found "${actualText}" — skipping`,
          );
          continue;
        }

        // Compute the actual replacement text (support regex backreferences)
        let actualReplacement: string;
        if (mode === SearchReplaceMode.REGEX) {
          actualReplacement = ref.matchText.replace(regex, replacement);
        } else {
          actualReplacement = replacement;
        }

        // Apply the replacement
        lines[lineIndex] =
          line.substring(0, ref.columnOffset) +
          actualReplacement +
          line.substring(ref.columnOffset + ref.matchText.length);

        noteReplacedCount++;
      }

      if (noteReplacedCount > 0) {
        const newContent = lines.join('\n');
        await this.filesService.writeFile(workspaceId, note.path, newContent);
        replacedCount += noteReplacedCount;
        modifiedNotes.push(noteId);
      }
    }

    return { replacedCount, modifiedNotes };
  }

  // -------------------------------------------------------------------------
  // Private: Pattern building
  // -------------------------------------------------------------------------

  /**
   * Build a RegExp from the search parameters.
   *
   * For regex mode, validates the pattern and applies a safety timeout.
   * For plain mode, escapes special characters.
   */
  private buildRegex(
    query: string,
    mode: SearchReplaceMode,
    caseSensitive: boolean,
    wholeWord: boolean,
  ): RegExp {
    let pattern: string;

    if (mode === SearchReplaceMode.REGEX) {
      // Validate the regex syntax
      try {
        new RegExp(query);
      } catch (error) {
        throw new BadRequestException(
          `Invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      pattern = query;
    } else {
      // Escape special regex characters for plain text search
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = caseSensitive ? 'gm' : 'gim';

    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      throw new BadRequestException(
        `Failed to compile search pattern: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Private: Content searching
  // -------------------------------------------------------------------------

  /**
   * Find all matches in a note's content and return structured match objects.
   */
  private findMatchesInContent(
    content: string,
    regex: RegExp,
    replacement: string,
    note: NoteRow,
    mode: SearchReplaceMode,
  ): SearchReplaceMatch[] {
    const matches: SearchReplaceMatch[] = [];
    const lines = content.split('\n');

    // Build a line offset map for efficient line/column lookup
    const lineOffsets: number[] = [];
    let offset = 0;
    for (const line of lines) {
      lineOffsets.push(offset);
      offset += line.length + 1; // +1 for newline character
    }

    // Reset regex state
    regex.lastIndex = 0;

    const startTime = Date.now();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Safety timeout for regex execution
      if (Date.now() - startTime > REGEX_TIMEOUT_MS) {
        this.logger.warn(
          `Regex timeout (${REGEX_TIMEOUT_MS}ms) reached for note ${note.id} — truncating results`,
        );
        break;
      }

      const matchOffset = match.index;
      const matchText = match[0];

      // Find which line this match is on via binary search
      const lineIndex = this.findLineIndex(lineOffsets, matchOffset);
      const lineOffset = lineOffsets[lineIndex];
      if (lineOffset === undefined) continue;
      const columnOffset = matchOffset - lineOffset;

      // Build context strings
      const contextBefore = content.substring(
        Math.max(0, matchOffset - CONTEXT_CHARS),
        matchOffset,
      );
      const contextAfter = content.substring(
        matchOffset + matchText.length,
        Math.min(content.length, matchOffset + matchText.length + CONTEXT_CHARS),
      );

      // Compute replacement preview
      let replacementPreview: string;
      if (mode === SearchReplaceMode.REGEX) {
        try {
          replacementPreview = matchText.replace(regex, replacement);
          // Reset regex lastIndex after replacement preview
          regex.lastIndex = matchOffset + matchText.length;
        } catch {
          replacementPreview = replacement;
        }
      } else {
        replacementPreview = replacement;
      }

      matches.push({
        noteId: note.id,
        noteTitle: note.title,
        notePath: note.path,
        matchText,
        contextBefore,
        contextAfter,
        lineNumber: lineIndex + 1, // 1-based
        columnOffset,
        replacementPreview,
      });

      // Prevent infinite loop on zero-length matches
      if (matchText.length === 0) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * Count the number of matches in content without building match objects.
   */
  private countMatches(content: string, regex: RegExp): number {
    regex.lastIndex = 0;
    let count = 0;
    const startTime = Date.now();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (Date.now() - startTime > REGEX_TIMEOUT_MS) break;
      count++;
      if (match[0].length === 0) regex.lastIndex++;
    }

    return count;
  }

  /**
   * Replace all matches in content and return the new content.
   */
  private replaceInContent(
    content: string,
    regex: RegExp,
    replacement: string,
    _mode: SearchReplaceMode,
  ): string {
    regex.lastIndex = 0;
    return content.replace(regex, replacement);
  }

  // -------------------------------------------------------------------------
  // Private: Note querying
  // -------------------------------------------------------------------------

  /**
   * Find notes in a workspace, optionally filtered.
   */
  private async findNotes(
    workspaceId: string,
    filters?: SearchReplaceFiltersDto,
  ): Promise<NoteRow[]> {
    // Build where clause
    const where: Record<string, unknown> = {
      workspaceId,
      isTrashed: false,
    };

    if (filters?.folder) {
      where['path'] = { startsWith: filters.folder };
    }

    if (filters?.fileExtension) {
      where['path'] = {
        ...(typeof where['path'] === 'object' ? (where['path'] as Record<string, unknown>) : {}),
        endsWith: `.${filters.fileExtension}`,
      };
    }

    if (filters?.updatedAfter || filters?.updatedBefore) {
      const updatedAt: Record<string, Date> = {};
      if (filters.updatedAfter) updatedAt['gte'] = new Date(filters.updatedAfter);
      if (filters.updatedBefore) updatedAt['lte'] = new Date(filters.updatedBefore);
      where['updatedAt'] = updatedAt;
    }

    if (filters?.tagIds && filters.tagIds.length > 0) {
      where['tags'] = {
        some: {
          tagId: { in: filters.tagIds },
        },
      };
    }

    const notes = await this.prisma.note.findMany({
      where,
      select: {
        id: true,
        title: true,
        path: true,
      },
      orderBy: { path: 'asc' },
    });

    return notes;
  }

  // -------------------------------------------------------------------------
  // Private: Utility
  // -------------------------------------------------------------------------

  /**
   * Binary search to find the line index for a given character offset.
   */
  private findLineIndex(lineOffsets: number[], offset: number): number {
    let low = 0;
    let high = lineOffsets.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const midOffset = lineOffsets[mid];
      if (midOffset === undefined) break;

      if (midOffset <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  }
}
