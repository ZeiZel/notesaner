import { z } from 'zod';

// -----------------------------------------------
// Share permission enum
// -----------------------------------------------

export const SharePermissionEnum = z.enum(['VIEW', 'COMMENT', 'EDIT']);
export type SharePermission = z.infer<typeof SharePermissionEnum>;

// -----------------------------------------------
// Create a share (by user email or link)
// -----------------------------------------------

export const CreateShareByEmailSchema = z.object({
  type: z.literal('email'),
  email: z.string().email('Invalid email address'),
  permission: SharePermissionEnum.default('VIEW'),
  expiresAt: z.string().datetime({ message: 'Invalid ISO 8601 date' }).nullable().optional(),
});

export type CreateShareByEmailDto = z.infer<typeof CreateShareByEmailSchema>;

export const CreateShareByLinkSchema = z.object({
  type: z.literal('link'),
  permission: SharePermissionEnum.default('VIEW'),
  password: z
    .string()
    .min(4, 'Password must be at least 4 characters')
    .max(128, 'Password is too long')
    .nullable()
    .optional(),
  expiresAt: z.string().datetime({ message: 'Invalid ISO 8601 date' }).nullable().optional(),
});

export type CreateShareByLinkDto = z.infer<typeof CreateShareByLinkSchema>;

export const CreateShareSchema = z.discriminatedUnion('type', [
  CreateShareByEmailSchema,
  CreateShareByLinkSchema,
]);

export type CreateShareDto = z.infer<typeof CreateShareSchema>;

// -----------------------------------------------
// Verify share link password
// -----------------------------------------------

export const VerifySharePasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type VerifySharePasswordDto = z.infer<typeof VerifySharePasswordSchema>;

// -----------------------------------------------
// Share response
// -----------------------------------------------

export interface NoteShareResponse {
  id: string;
  noteId: string;
  sharedBy: string;
  sharedWith: string | null;
  sharedWithEmail: string | null;
  sharedWithName: string | null;
  permission: SharePermission;
  token: string;
  hasPassword: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

// -----------------------------------------------
// Public share access response (for guests)
// -----------------------------------------------

export interface PublicShareAccessResponse {
  noteId: string;
  noteTitle: string;
  permission: SharePermission;
  requiresPassword: boolean;
  isExpired: boolean;
  sharedByName: string;
}
