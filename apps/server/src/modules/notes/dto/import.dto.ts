import { z } from 'zod';

// -----------------------------------------------
// Supported import sources
// -----------------------------------------------
export const ImportSource = z.enum(['obsidian', 'notion', 'logseq', 'markdown']);
export type ImportSource = z.infer<typeof ImportSource>;

// -----------------------------------------------
// Conflict resolution strategies
// -----------------------------------------------
/**
 * Defines what to do when a target note already exists at the destination path.
 *
 * - `skip`      — leave the existing file untouched, increment skippedFiles count
 * - `overwrite` — replace the existing file with the imported content
 * - `rename`    — append a numeric suffix to the imported note's filename
 *                 (e.g. "My Note.md" → "My Note (1).md")
 */
export const ConflictStrategy = z.enum(['skip', 'overwrite', 'rename']);
export type ConflictStrategy = z.infer<typeof ConflictStrategy>;

// -----------------------------------------------
// Import options
// -----------------------------------------------
export const ImportOptionsSchema = z.object({
  source: ImportSource,
  /** Whether to preserve the original folder structure */
  preserveFolderStructure: z.boolean().default(true),
  /** Target folder path within the workspace (defaults to root) */
  targetFolder: z.string().default(''),
  /** Whether to convert internal links to Notesaner wiki-link format */
  convertLinks: z.boolean().default(true),
  /** Whether to import attachments (images, etc.) */
  importAttachments: z.boolean().default(true),
  /**
   * What to do when a target note already exists.
   * Defaults to `rename` to avoid data loss.
   */
  conflictStrategy: ConflictStrategy.default('rename'),
  /**
   * Obsidian-specific: parse .obsidian/workspace.json to determine which
   * notes were recently open. When enabled those notes are marked in the
   * preview with `wasRecentlyOpen: true`.
   */
  parseObsidianWorkspace: z.boolean().default(false),
});

export type ImportOptionsDto = z.infer<typeof ImportOptionsSchema>;

// -----------------------------------------------
// Obsidian workspace config shape
// -----------------------------------------------

/** Subset of the Obsidian workspace.json we care about. */
export interface ObsidianWorkspaceConfig {
  /** Paths of the last-opened notes (relative to vault root). */
  lastOpenFiles?: string[];
}

// -----------------------------------------------
// Frontmatter / properties extracted from a note
// -----------------------------------------------

export interface ParsedFrontmatter {
  /** Raw title from frontmatter, if present */
  title?: string;
  /** Tags extracted from frontmatter (normalized, no # prefix) */
  tags: string[];
  /** Aliases defined in frontmatter */
  aliases: string[];
  /**
   * Additional key-value pairs from frontmatter.
   * Values are kept as strings; callers may cast as needed.
   */
  extra: Record<string, unknown>;
}

// -----------------------------------------------
// Import preview (returned before actual import)
// -----------------------------------------------
export interface ImportPreviewNote {
  originalPath: string;
  targetPath: string;
  title: string;
  sizeBytes: number;
  hasAttachments: boolean;
  linkCount: number;
  warnings: string[];
  /** Tags extracted from Obsidian frontmatter, if any */
  tags?: string[];
  /** Whether this note was in the last-open list of the Obsidian workspace */
  wasRecentlyOpen?: boolean;
}

export interface ImportPreviewResult {
  source: ImportSource;
  totalNotes: number;
  totalAttachments: number;
  totalSizeBytes: number;
  notes: ImportPreviewNote[];
  warnings: string[];
}

// -----------------------------------------------
// Import progress (returned during / after import)
// -----------------------------------------------
export interface ImportProgressEvent {
  phase: 'parsing' | 'converting' | 'importing' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  errors: ImportError[];
}

export interface ImportError {
  file: string;
  message: string;
  recoverable: boolean;
}

export interface ImportResult {
  importedNotes: number;
  importedAttachments: number;
  skippedFiles: number;
  errors: ImportError[];
  duration: number;
}
