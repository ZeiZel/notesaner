import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFile } from 'fs/promises';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  INDEX_NOTE_JOB,
  NOTE_INDEX_QUEUE,
  REINDEX_WORKSPACE_JOB,
} from '../jobs.constants';
import type {
  IndexNoteJobData,
  IndexNoteJobResult,
  ReindexWorkspaceJobData,
  ReindexWorkspaceJobResult,
} from '../jobs.types';
import { MarkdownExtractor } from './markdown-extractor';

/**
 * BullMQ processor for full-text search indexing of notes.
 *
 * Handles two job types:
 *   - index-note: index a single note after save (debounced)
 *   - reindex-workspace: batch reindex all notes in a workspace
 *
 * Weighted tsvector layout:
 *   A — title
 *   B — headings (## heading text)
 *   C — body text (paragraphs, lists, etc.)
 *   D — tags + frontmatter values
 */
@Processor(NOTE_INDEX_QUEUE)
export class NoteIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(NoteIndexingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(
    job: Job<IndexNoteJobData | ReindexWorkspaceJobData>,
  ): Promise<IndexNoteJobResult | ReindexWorkspaceJobResult> {
    switch (job.name) {
      case INDEX_NOTE_JOB:
        return this.processIndexNote(job as Job<IndexNoteJobData>);
      case REINDEX_WORKSPACE_JOB:
        return this.processReindexWorkspace(job as Job<ReindexWorkspaceJobData>);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Single note indexing
  // ---------------------------------------------------------------------------

  private async processIndexNote(job: Job<IndexNoteJobData>): Promise<IndexNoteJobResult> {
    const { noteId, workspaceId, filePath } = job.data;
    const start = Date.now();

    this.logger.debug(`Indexing note ${noteId} from ${filePath}`);

    // Verify the note still exists (may have been deleted before job ran)
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId, isTrashed: false },
      select: { id: true, title: true, tags: { select: { tag: { select: { name: true } } } } },
    });

    if (!note) {
      this.logger.warn(`Note ${noteId} not found or trashed — skipping index`);
      return { noteId, indexed: false, durationMs: Date.now() - start };
    }

    // Read raw markdown from filesystem
    let rawContent: string;
    try {
      rawContent = await readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.error(
        `Cannot read file ${filePath} for note ${noteId}: ${String(error)}`,
      );
      return { noteId, indexed: false, durationMs: Date.now() - start };
    }

    // Parse and extract text segments
    const { bodyText, headingsText, frontmatter } =
      MarkdownExtractor.extract(rawContent);

    // Build tag string from database relation
    const tagsText = note.tags.map((t) => t.tag.name).join(' ');

    // Build frontmatter search string from property values
    const frontmatterText = MarkdownExtractor.frontmatterToSearchText(frontmatter);

    // Persist tsvector to database via raw SQL (Prisma does not model tsvector natively)
    await this.prisma.$executeRaw`
      SELECT update_note_search_vector(
        ${noteId}::uuid,
        ${note.title},
        ${headingsText},
        ${bodyText},
        ${tagsText},
        ${frontmatterText},
        'english'::regconfig
      )
    `;

    const durationMs = Date.now() - start;
    this.logger.debug(`Indexed note ${noteId} in ${durationMs}ms`);

    return { noteId, indexed: true, durationMs };
  }

  // ---------------------------------------------------------------------------
  // Workspace batch reindex
  // ---------------------------------------------------------------------------

  private async processReindexWorkspace(
    job: Job<ReindexWorkspaceJobData>,
  ): Promise<ReindexWorkspaceJobResult> {
    const { workspaceId } = job.data;
    const start = Date.now();

    this.logger.log(`Starting batch reindex for workspace ${workspaceId}`);

    // Fetch workspace storage path so we can resolve file paths
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, storagePath: true },
    });

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // Paginate through all non-trashed notes
    const PAGE_SIZE = 50;
    let cursor: string | undefined;
    let total = 0;
    let succeeded = 0;
    let failed = 0;

    do {
      const notes = await this.prisma.note.findMany({
        where: { workspaceId, isTrashed: false },
        select: {
          id: true,
          path: true,
          title: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
      });

      if (notes.length === 0) break;

      total += notes.length;
      cursor = notes[notes.length - 1].id;

      for (const note of notes) {
        const filePath = `${workspace.storagePath}/${note.path}`;
        try {
          const rawContent = await readFile(filePath, 'utf-8');
          const { bodyText, headingsText, frontmatter } =
            MarkdownExtractor.extract(rawContent);

          const tagsText = note.tags.map((t) => t.tag.name).join(' ');
          const frontmatterText = MarkdownExtractor.frontmatterToSearchText(frontmatter);

          await this.prisma.$executeRaw`
            SELECT update_note_search_vector(
              ${note.id}::uuid,
              ${note.title},
              ${headingsText},
              ${bodyText},
              ${tagsText},
              ${frontmatterText},
              'english'::regconfig
            )
          `;
          succeeded++;
        } catch (error) {
          this.logger.warn(
            `Failed to index note ${note.id} (${note.path}): ${String(error)}`,
          );
          failed++;
        }
      }

      // Report batch progress back to BullMQ
      await job.updateProgress(Math.round((succeeded + failed) / Math.max(total, 1) * 100));
    } while (true);

    const durationMs = Date.now() - start;
    this.logger.log(
      `Reindex complete for workspace ${workspaceId}: ` +
      `${succeeded}/${total} indexed, ${failed} failed in ${durationMs}ms`,
    );

    return { workspaceId, total, succeeded, failed, durationMs };
  }
}
