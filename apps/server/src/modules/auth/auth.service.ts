import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import { EmailService } from '../email/email.service';
import { ForgotPasswordSchema, ResetPasswordSchema } from './dto/password-reset.dto';
import { VerifyEmailSchema, ResendVerificationSchema } from './dto/email-verification.dto';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Password reset token TTL: 1 hour. */
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Email verification token TTL: 24 hours. */
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Max password reset requests per email per hour. */
const PASSWORD_RESET_RATE_LIMIT = 3;

/** Rate limit window for password resets: 1 hour in seconds. */
const PASSWORD_RESET_RATE_LIMIT_WINDOW_S = 3600;

/** Max verification email resends per email per hour. */
const VERIFICATION_RESEND_RATE_LIMIT = 3;

/** Rate limit window for verification resends: 1 hour in seconds. */
const VERIFICATION_RESEND_RATE_LIMIT_WINDOW_S = 3600;

/** ValKey key prefix for password reset rate limiting. */
const RATE_LIMIT_RESET_PREFIX = 'rate:pw-reset:';

/** ValKey key prefix for verification resend rate limiting. */
const RATE_LIMIT_VERIFY_PREFIX = 'rate:verify-resend:';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthProvider {
  id: string;
  type: string;
  name: string;
  loginUrl: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly frontendUrl: string;
  private readonly requireEmailVerification: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('frontendUrl', 'http://localhost:3000');
    this.requireEmailVerification = this.config.get<boolean>('auth.requireEmailVerification', true);
  }

  // ===========================================================================
  // Existing stubs (unchanged)
  // ===========================================================================

  async loginLocal(_email: string, _password: string, _totpCode?: string): Promise<AuthTokens> {
    throw new NotImplementedException('loginLocal not yet implemented');
  }

  async register(_dto: { email: string; password: string; displayName: string }): Promise<unknown> {
    throw new NotImplementedException('register not yet implemented');
  }

  async refreshTokens(_refreshToken: string): Promise<AuthTokens> {
    throw new NotImplementedException('refreshTokens not yet implemented');
  }

  async logout(_sessionId: string): Promise<void> {
    throw new NotImplementedException('logout not yet implemented');
  }

  async getMe(_userId: string): Promise<unknown> {
    throw new NotImplementedException('getMe not yet implemented');
  }

  async getUserSessions(_userId: string): Promise<unknown[]> {
    throw new NotImplementedException('getUserSessions not yet implemented');
  }

  async revokeSession(_userId: string, _sessionId: string): Promise<void> {
    throw new NotImplementedException('revokeSession not yet implemented');
  }

  async getEnabledProviders(): Promise<{
    providers: AuthProvider[];
    localEnabled: boolean;
  }> {
    throw new NotImplementedException('getEnabledProviders not yet implemented');
  }

  async enableTotp(_userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    throw new NotImplementedException('enableTotp not yet implemented');
  }

  async verifyTotp(_userId: string, _token: string): Promise<{ enabled: boolean }> {
    throw new NotImplementedException('verifyTotp not yet implemented');
  }

  async disableTotp(_userId: string): Promise<void> {
    throw new NotImplementedException('disableTotp not yet implemented');
  }

  // ===========================================================================
  // Password Reset
  // ===========================================================================

  /**
   * Initiates the password reset flow by sending a reset email.
   *
   * Security considerations:
   * - Always returns a success message regardless of whether the email exists
   *   (prevents email enumeration).
   * - Rate-limited to 3 requests per hour per email via ValKey.
   * - Token is a 32-byte URL-safe random string; only its SHA-256 hash is stored.
   * - Expires after 1 hour.
   */
  async forgotPassword(rawDto: unknown): Promise<{ message: string }> {
    const dto = this.parseOrThrow(ForgotPasswordSchema, rawDto);

    // Always return the same message to prevent email enumeration
    const successMessage = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    // Rate limit check
    const isLimited = await this.checkRateLimit(
      `${RATE_LIMIT_RESET_PREFIX}${dto.email}`,
      PASSWORD_RESET_RATE_LIMIT,
      PASSWORD_RESET_RATE_LIMIT_WINDOW_S,
    );

    if (isLimited) {
      // Still return success to avoid leaking whether the email exists
      this.logger.warn(`Password reset rate limit exceeded for email=${dto.email}`);
      return successMessage;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, displayName: true, email: true, passwordHash: true },
    });

    // No user, or user has no local password (SSO-only) — silently succeed
    if (!user || !user.passwordHash) {
      return successMessage;
    }

    // Generate a secure random token
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    // Invalidate any existing unused reset tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Store new token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    // Increment rate limit counter
    await this.incrementRateLimit(
      `${RATE_LIMIT_RESET_PREFIX}${dto.email}`,
      PASSWORD_RESET_RATE_LIMIT_WINDOW_S,
    );

    // Send reset email
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${rawToken}`;

    await this.emailService.send({
      to: user.email,
      template: 'password-reset',
      variables: {
        displayName: user.displayName,
        resetUrl,
        expiryMinutes: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60_000),
      },
    });

    this.logger.log(`Password reset email sent for userId=${user.id}`);

    return successMessage;
  }

  /**
   * Validates a password reset token without consuming it.
   * Used by the frontend to check if the token is valid before showing the form.
   */
  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { expiresAt: true, usedAt: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true };
  }

  /**
   * Resets the user's password using a valid reset token.
   *
   * After successful reset:
   * - The token is marked as used.
   * - All existing sessions for the user are deleted (force logout everywhere).
   * - The password hash is updated.
   */
  async resetPassword(rawDto: unknown): Promise<{ message: string }> {
    const dto = this.parseOrThrow(ResetPasswordSchema, rawDto);
    const tokenHash = this.hashToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash the new password using Node.js crypto (scrypt)
    const newPasswordHash = await this.hashPassword(dto.password);

    // Atomically: update password, mark token as used, delete all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    this.logger.log(
      `Password reset completed for userId=${resetToken.userId}, all sessions invalidated`,
    );

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  // ===========================================================================
  // Email Verification
  // ===========================================================================

  /**
   * Creates and sends an email verification token for a user.
   * Called internally during registration or when resending verification.
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, isEmailVerified: true },
    });

    if (!user) {
      this.logger.warn(`sendVerificationEmail: user not found userId=${userId}`);
      return;
    }

    if (user.isEmailVerified) {
      this.logger.debug(`sendVerificationEmail: user already verified userId=${userId}`);
      return;
    }

    // Generate a secure random token
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    // Invalidate any existing unused verification tokens for this user
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Store new token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
      },
    });

    // Send verification email
    const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${rawToken}`;

    await this.emailService.send({
      to: user.email,
      template: 'verification',
      variables: {
        displayName: user.displayName,
        verificationUrl,
        expiryHours: Math.round(EMAIL_VERIFICATION_TOKEN_TTL_MS / 3_600_000),
      },
    });

    this.logger.log(`Verification email sent for userId=${user.id}`);
  }

  /**
   * Verifies a user's email address using the provided token.
   *
   * On success:
   * - The token is marked as used.
   * - The user's isEmailVerified flag is set to true.
   */
  async verifyEmail(rawDto: unknown): Promise<{ message: string }> {
    const dto = this.parseOrThrow(VerifyEmailSchema, rawDto);
    const tokenHash = this.hashToken(dto.token);

    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isEmailVerified: true } } },
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (verificationToken.user.isEmailVerified) {
      // Token is valid but user is already verified — mark token as used anyway
      await this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });
      return { message: 'Email address is already verified.' };
    }

    // Atomically: verify the user and consume the token
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for userId=${verificationToken.userId}`);

    return { message: 'Email address verified successfully.' };
  }

  /**
   * Resends the verification email.
   *
   * Security considerations:
   * - Always returns a success message regardless of whether the email exists.
   * - Rate-limited to 3 requests per hour per email via ValKey.
   */
  async resendVerificationEmail(rawDto: unknown): Promise<{ message: string }> {
    const dto = this.parseOrThrow(ResendVerificationSchema, rawDto);

    const successMessage = {
      message:
        'If an account with that email exists and is unverified, a verification email has been sent.',
    };

    // Rate limit check
    const isLimited = await this.checkRateLimit(
      `${RATE_LIMIT_VERIFY_PREFIX}${dto.email}`,
      VERIFICATION_RESEND_RATE_LIMIT,
      VERIFICATION_RESEND_RATE_LIMIT_WINDOW_S,
    );

    if (isLimited) {
      this.logger.warn(`Verification resend rate limit exceeded for email=${dto.email}`);
      return successMessage;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, isEmailVerified: true },
    });

    if (!user || user.isEmailVerified) {
      return successMessage;
    }

    // Increment rate limit counter
    await this.incrementRateLimit(
      `${RATE_LIMIT_VERIFY_PREFIX}${dto.email}`,
      VERIFICATION_RESEND_RATE_LIMIT_WINDOW_S,
    );

    await this.sendVerificationEmail(user.id);

    return successMessage;
  }

  /**
   * Returns whether email verification is required for login.
   * Used by other parts of the auth module to gate login.
   */
  isEmailVerificationRequired(): boolean {
    return this.requireEmailVerification;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Hashes a raw token string using SHA-256.
   * We never store plaintext tokens in the database.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hashes a password using Node.js built-in scrypt.
   *
   * Format: `scrypt:<salt>:<hash>` where salt and hash are hex-encoded.
   * scrypt params: N=16384, r=8, p=1, keyLen=64
   */
  private async hashPassword(password: string): Promise<string> {
    const { scrypt, randomBytes: rb } = await import('crypto');
    const salt = rb(16).toString('hex');

    return new Promise<string>((resolve, reject) => {
      scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Checks whether the rate limit has been exceeded for a given key.
   * Returns true if the limit is exceeded.
   */
  private async checkRateLimit(
    key: string,
    maxRequests: number,
    _windowSeconds: number,
  ): Promise<boolean> {
    try {
      const current = await this.valkey.get(key);
      if (current !== null && parseInt(current, 10) >= maxRequests) {
        return true;
      }
      return false;
    } catch (error) {
      // If ValKey is unavailable, allow the request (fail open for availability)
      this.logger.error('Rate limit check failed', error);
      return false;
    }
  }

  /**
   * Increments the rate limit counter for a given key.
   * Sets the TTL on first increment so the window auto-expires.
   */
  private async incrementRateLimit(key: string, windowSeconds: number): Promise<void> {
    try {
      const client = this.valkey.getClient();
      const result = await client.incr(key);

      // Set expiry only on the first increment (when value becomes 1)
      if (result === 1) {
        await client.expire(key, windowSeconds);
      }
    } catch (error) {
      // Non-critical: if rate limiting fails, the operation still proceeds
      this.logger.error('Rate limit increment failed', error);
    }
  }

  /**
   * Parses input against a Zod schema. Throws BadRequestException on failure.
   */
  private parseOrThrow<T>(
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        data?: T;
        error?: { errors: Array<{ path: (string | number)[]; message: string }> };
      };
    },
    input: unknown,
  ): T {
    const result = schema.safeParse(input);

    if (!result.success) {
      const messages = (result.error?.errors ?? []).map(
        (e) => `${e.path.join('.') || 'body'}: ${e.message}`,
      );
      throw new BadRequestException(messages.join('; '));
    }

    return result.data as T;
  }
}
