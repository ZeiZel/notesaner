/**
 * DTOs for the block reference system.
 *
 * Block references use the Obsidian-compatible ^block-id syntax.
 * A block ID is a short alphanumeric identifier appended to a paragraph,
 * e.g. "Some paragraph content ^abc123".
 *
 * The [[Note#^block-id]] syntax creates a transclusion that embeds the
 * referenced block's content inline.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex for a valid block ID: 1-40 lowercase alphanumeric chars and hyphens. */
export const BLOCK_ID_REGEX = /^[a-z0-9][a-z0-9-]{0,39}$/;

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/**
 * Body for POST /workspaces/:workspaceId/notes/:noteId/blocks
 *
 * Generate a block ID for a specific paragraph identified by its line number
 * or content. If a blockId is provided it will be used; otherwise one is
 * generated automatically.
 */
export const CreateBlockReferenceSchema = z.object({
  /** 1-based line number of the paragraph to tag with a block ID. */
  line: z.number().int().positive('Line number must be positive'),

  /**
   * Optional custom block ID. When omitted the service generates one.
   * Must be lowercase alphanumeric with optional hyphens, 1-40 chars.
   */
  blockId: z
    .string()
    .regex(BLOCK_ID_REGEX, 'Block ID must be lowercase alphanumeric with hyphens, 1-40 chars')
    .optional(),
});

export type CreateBlockReferenceDto = z.infer<typeof CreateBlockReferenceSchema>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** A single block extracted from a note's markdown content. */
export interface BlockDto {
  /** The block identifier (without the ^ prefix). */
  blockId: string;
  /** The full text content of the block (without the ^blockId suffix). */
  content: string;
  /** 1-based line number where this block starts in the source file. */
  line: number;
}

/** Response for GET /workspaces/:workspaceId/notes/:noteId/blocks */
export interface BlockListResponse {
  /** UUID of the note. */
  noteId: string;
  /** All blocks found in the note, ordered by line number. */
  blocks: BlockDto[];
}

/** Response for POST /workspaces/:workspaceId/notes/:noteId/blocks */
export interface CreateBlockResponse {
  /** The block ID that was assigned (generated or user-provided). */
  blockId: string;
  /** The content of the block. */
  content: string;
  /** The 1-based line number where the block ID was inserted. */
  line: number;
  /** Whether a new block ID was created (false if the line already had one). */
  created: boolean;
}
