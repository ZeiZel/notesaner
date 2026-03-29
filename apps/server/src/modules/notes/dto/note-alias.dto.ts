import { z } from 'zod';

/**
 * Regex that defines a valid alias slug:
 *  - Only lowercase letters, digits, and hyphens
 *  - Must start and end with a letter or digit (no leading/trailing hyphens)
 *  - 1–120 characters
 */
export const ALIAS_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const SetAliasSchema = z.object({
  alias: z
    .string()
    .min(1, 'Alias must be at least 1 character')
    .max(120, 'Alias must be at most 120 characters')
    .regex(ALIAS_REGEX, 'Alias must contain only lowercase letters, digits, and hyphens'),
});

export type SetAliasDto = z.infer<typeof SetAliasSchema>;

export interface NoteAliasResponse {
  noteId: string;
  workspaceId: string;
  alias: string;
}
