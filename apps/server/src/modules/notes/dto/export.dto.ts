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
});

export type BatchExportDto = z.infer<typeof BatchExportSchema>;
