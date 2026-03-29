import { z } from 'zod';

/**
 * Request body for POST /workspaces/:workspaceId/notes/:noteId/duplicate
 */
export const DuplicateNoteSchema = z.object({
  /**
   * ID of the target folder in which to place the duplicate.
   * When omitted the duplicate is created in the same folder as the source.
   */
  targetFolderId: z.string().uuid('targetFolderId must be a valid UUID').optional(),

  /**
   * When true the source note's frontmatter properties are copied verbatim
   * to the duplicate.  Defaults to true.
   */
  includeProperties: z.boolean().default(true),
});

export type DuplicateNoteDto = z.infer<typeof DuplicateNoteSchema>;

/**
 * Shape returned by the duplicate endpoint.
 */
export interface DuplicateNoteResponse {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
  createdAt: string;
}
