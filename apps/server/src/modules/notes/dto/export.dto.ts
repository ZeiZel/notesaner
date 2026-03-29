import { z } from 'zod';

// -----------------------------------------------
// Supported export formats
// -----------------------------------------------
export const ExportFormat = z.enum(['md', 'html', 'pdf', 'docx']);
export type ExportFormat = z.infer<typeof ExportFormat>;

// -----------------------------------------------
// Single note export query params
// -----------------------------------------------
export const ExportQuerySchema = z.object({
  format: ExportFormat,
});

export type ExportQueryDto = z.infer<typeof ExportQuerySchema>;

// -----------------------------------------------
// Batch export request body
// -----------------------------------------------
export const BatchExportSchema = z.object({
  noteIds: z
    .array(z.string().uuid('Each noteId must be a valid UUID'))
    .min(1, 'At least one note ID is required')
    .max(100, 'Cannot export more than 100 notes at once'),
  format: ExportFormat,
  /** Preserve original folder structure inside the ZIP (default: true) */
  preserveFolderStructure: z.boolean().default(true),
  /** Include note attachments alongside the exported files (default: true) */
  includeAttachments: z.boolean().default(true),
  /** Rewrite [[wiki links]] and [md links] to relative paths inside the ZIP (default: true) */
  rewriteInternalLinks: z.boolean().default(true),
});

export type BatchExportDto = z.infer<typeof BatchExportSchema>;

// -----------------------------------------------
// Workspace export request body
// -----------------------------------------------
export const WorkspaceExportSchema = z.object({
  format: ExportFormat,
  /** Preserve original folder structure inside the ZIP (default: true) */
  preserveFolderStructure: z.boolean().default(true),
  /** Include note attachments alongside the exported files (default: true) */
  includeAttachments: z.boolean().default(true),
  /** Rewrite [[wiki links]] and [md links] to relative paths inside the ZIP (default: true) */
  rewriteInternalLinks: z.boolean().default(true),
  /** Skip trashed notes from the export (default: true) */
  excludeTrashed: z.boolean().default(true),
});

export type WorkspaceExportDto = z.infer<typeof WorkspaceExportSchema>;
