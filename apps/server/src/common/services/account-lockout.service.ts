import { Injectable, Inject, Logger, HttpException, HttpStatus } from '@nestjs/common';
import type Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { VALKEY_CLIENT } from '../../modules/valkey/valkey.constants';

/**
 * Account lockout service.
 *
 * Tracks failed login attempts per IP or email in ValKey.
 * After N consecutive failures (default: 10), the account/IP is
 * locked for a cooldown period (default: 30 minutes).
 *
 * Key design:
 * - `lockout:ip:{ip}` — failed attempts by IP (protects against brute force)
 * - `lockout:email:{email}` — failed attempts by email (protects against credential stuffing)
 * - `lockout:locked:{identifier}` — lock marker with TTL
 *
 * All state is stored in ValKey with automatic TTL expiration.
 */
@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  private readonly maxFailedAttempts: number;
  private readonly lockoutDurationSeconds: number;
  private readonly failedAttemptWindowSeconds: number;

  private readonly PREFIX_IP = 'lockout:ip:';
  private readonly PREFIX_EMAIL = 'lockout:email:';
  private readonly PREFIX_LOCKED = 'lockout:locked:';

  constructor(
    @Inject(VALKEY_CLIENT) private readonly client: Redis,
    private readonly config: ConfigService,
  ) {
    this.maxFailedAttempts = this.config.get<number>('rateLimit.accountLockout.maxAttempts', 10);
    this.lockoutDurationSeconds = this.config.get<number>(
      'rateLimit.accountLockout.lockoutDurationSeconds',
      1800, // 30 minutes
    );
    this.failedAttemptWindowSeconds = this.config.get<number>(
      'rateLimit.accountLockout.windowSeconds',
      3600, // 1 hour window for tracking failures
    );
  }

  /**
   * Checks if the given identifier (IP or email) is currently locked out.
   * Throws a 429 HttpException if locked.
   */
  async assertNotLocked(ip: string, email?: string): Promise<void> {
    const identifiers = [
      `${this.PREFIX_LOCKED}ip:${ip}`,
      ...(email ? [`${this.PREFIX_LOCKED}email:${email}`] : []),
    ];

    try {
      for (const key of identifiers) {
        const locked = await this.client.exists(key);
        if (locked) {
          const ttl = await this.client.ttl(key);
          const retryAfter = ttl > 0 ? ttl : this.lockoutDurationSeconds;

          this.logger.warn(`Account locked out: ${key}, retry after ${retryAfter}s`);

          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message:
                'Account temporarily locked due to too many failed login attempts. Please try again later.',
              code: 'ACCOUNT_LOCKED',
              retryAfter,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Fail open if ValKey is unreachable
      this.logger.error('Lockout check failed', error);
    }
  }

  /**
   * Records a failed login attempt. If the threshold is exceeded,
   * the account is locked for the configured duration.
   */
  async recordFailedAttempt(ip: string, email?: string): Promise<void> {
    try {
      // Increment both IP and email counters
      const ipKey = `${this.PREFIX_IP}${ip}`;
      const ipCount = await this.atomicIncrement(ipKey, this.failedAttemptWindowSeconds);

      let emailCount = 0;
      if (email) {
        const emailKey = `${this.PREFIX_EMAIL}${email}`;
        emailCount = await this.atomicIncrement(emailKey, this.failedAttemptWindowSeconds);
      }

      // Check if either counter exceeds the threshold
      if (ipCount >= this.maxFailedAttempts) {
        await this.lockIdentifier(`ip:${ip}`);
        this.logger.warn(`IP ${ip} locked after ${ipCount} failed attempts`);
      }

      if (email && emailCount >= this.maxFailedAttempts) {
        await this.lockIdentifier(`email:${email}`);
        this.logger.warn(`Email ${email} locked after ${emailCount} failed attempts`);
      }
    } catch (error) {
      // Non-critical: do not block login flow if tracking fails
      this.logger.error('Failed to record failed attempt', error);
    }
  }

  /**
   * Resets the failed attempt counters for a successful login.
   * Called after a successful authentication.
   */
  async resetAttempts(ip: string, email?: string): Promise<void> {
    try {
      const keys = [`${this.PREFIX_IP}${ip}`, ...(email ? [`${this.PREFIX_EMAIL}${email}`] : [])];
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error('Failed to reset attempt counters', error);
    }
  }

  /**
   * Retrieves lockout status for a user (used by admin API).
   */
  async getLockoutStatus(userId: string): Promise<{
    isLocked: boolean;
    remainingLockoutSeconds: number;
    failedAttempts: number;
  }> {
    try {
      // Check email-based lockout (we use userId as a lookup key variant)
      const lockedKey = `${this.PREFIX_LOCKED}email:${userId}`;
      const emailKey = `${this.PREFIX_EMAIL}${userId}`;

      const [isLockedRaw, ttl, attemptsRaw] = await Promise.all([
        this.client.exists(lockedKey),
        this.client.ttl(lockedKey),
        this.client.get(emailKey),
      ]);

      return {
        isLocked: isLockedRaw > 0,
        remainingLockoutSeconds: Math.max(0, ttl),
        failedAttempts: attemptsRaw ? parseInt(attemptsRaw, 10) : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get lockout status for ${userId}`, error);
      return { isLocked: false, remainingLockoutSeconds: 0, failedAttempts: 0 };
    }
  }

  /**
   * Admin action: manually unlock an account.
   */
  async unlockAccount(userId: string): Promise<void> {
    try {
      const keys = [
        `${this.PREFIX_LOCKED}email:${userId}`,
        `${this.PREFIX_LOCKED}ip:${userId}`,
        `${this.PREFIX_EMAIL}${userId}`,
        `${this.PREFIX_IP}${userId}`,
      ];
      await this.client.del(...keys);
      this.logger.log(`Admin unlocked account: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to unlock account ${userId}`, error);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async atomicIncrement(key: string, windowSeconds: number): Promise<number> {
    const result = await this.client.incr(key);
    if (result === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return result;
  }

  private async lockIdentifier(identifier: string): Promise<void> {
    const key = `${this.PREFIX_LOCKED}${identifier}`;
    await this.client.set(key, '1', 'EX', this.lockoutDurationSeconds);
  }
}
