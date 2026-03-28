import { z } from 'zod';

// -----------------------------------------------
// Supported import sources
// -----------------------------------------------
export const ImportSource = z.enum(['obsidian', 'notion', 'logseq', 'markdown']);
export type ImportSource = z.infer<typeof ImportSource>;

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
});

export type ImportOptionsDto = z.infer<typeof ImportOptionsSchema>;

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
