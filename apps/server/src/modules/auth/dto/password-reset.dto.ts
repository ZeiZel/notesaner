import { z } from 'zod';

// ---------------------------------------------------------------------------
// Forgot password — initiates the reset flow
// ---------------------------------------------------------------------------

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .email({ message: 'Must be a valid email address' })
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

// ---------------------------------------------------------------------------
// Validate reset token — checks token validity before showing the form
// ---------------------------------------------------------------------------

export const ValidateResetTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type ValidateResetTokenDto = z.infer<typeof ValidateResetTokenSchema>;

// ---------------------------------------------------------------------------
// Reset password — sets a new password using the token
// ---------------------------------------------------------------------------

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
