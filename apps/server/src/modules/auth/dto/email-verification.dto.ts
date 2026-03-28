import { z } from 'zod';

// ---------------------------------------------------------------------------
// Verify email — consumes the verification token
// ---------------------------------------------------------------------------

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

// ---------------------------------------------------------------------------
// Resend verification email
// ---------------------------------------------------------------------------

export const ResendVerificationSchema = z.object({
  email: z
    .string()
    .email({ message: 'Must be a valid email address' })
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
});

export type ResendVerificationDto = z.infer<typeof ResendVerificationSchema>;
