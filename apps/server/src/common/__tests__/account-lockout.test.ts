/**
 * Unit tests for AccountLockoutService.
 *
 * Covers:
 * - assertNotLocked(): passes when not locked
 * - assertNotLocked(): throws 429 when IP is locked
 * - assertNotLocked(): throws 429 when email is locked
 * - assertNotLocked(): fail-open when ValKey is down
 * - recordFailedAttempt(): increments counters
 * - recordFailedAttempt(): locks account at threshold
 * - resetAttempts(): clears counters
 * - getLockoutStatus(): returns status object
 * - unlockAccount(): removes all keys
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AccountLockoutService } from '../services/account-lockout.service';

// ─── Mock Redis client ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-2),
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

function createMockConfig(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'rateLimit.accountLockout.maxAttempts': 10,
    'rateLimit.accountLockout.lockoutDurationSeconds': 1800,
    'rateLimit.accountLockout.windowSeconds': 3600,
    ...overrides,
  };
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => defaults[key] ?? defaultValue),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockConfig = createMockConfig();
    service = new AccountLockoutService(mockRedis as never, mockConfig as never);
  });

  // ── assertNotLocked ─────────────────────────────────────────────────────

  describe('assertNotLocked', () => {
    it('does not throw when IP is not locked', async () => {
      mockRedis.exists.mockResolvedValue(0);

      await expect(service.assertNotLocked('1.2.3.4')).resolves.toBeUndefined();
    });

    it('throws 429 when IP is locked', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(900);

      await expect(service.assertNotLocked('1.2.3.4')).rejects.toThrow(HttpException);

      try {
        await service.assertNotLocked('1.2.3.4');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = httpError.getResponse() as Record<string, unknown>;
        expect(response.code).toBe('ACCOUNT_LOCKED');
        expect(response.retryAfter).toBe(900);
      }
    });

    it('throws 429 when email is locked', async () => {
      // First call (IP) returns not locked, second call (email) returns locked
      mockRedis.exists
        .mockResolvedValueOnce(0) // IP check
        .mockResolvedValueOnce(1); // email check
      mockRedis.ttl.mockResolvedValue(600);

      await expect(service.assertNotLocked('1.2.3.4', 'user@test.com')).rejects.toThrow(
        HttpException,
      );
    });

    it('fails open when ValKey throws', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Connection refused'));

      await expect(service.assertNotLocked('1.2.3.4')).resolves.toBeUndefined();
    });
  });

  // ── recordFailedAttempt ─────────────────────────────────────────────────

  describe('recordFailedAttempt', () => {
    it('increments IP counter', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.recordFailedAttempt('1.2.3.4');

      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:ip:1.2.3.4');
      expect(mockRedis.expire).toHaveBeenCalledWith('lockout:ip:1.2.3.4', 3600);
    });

    it('increments both IP and email counters', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.recordFailedAttempt('1.2.3.4', 'user@test.com');

      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:ip:1.2.3.4');
      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:email:user@test.com');
    });

    it('locks IP when threshold is reached', async () => {
      mockRedis.incr.mockResolvedValue(10); // reaches maxAttempts

      await service.recordFailedAttempt('1.2.3.4');

      expect(mockRedis.set).toHaveBeenCalledWith('lockout:locked:ip:1.2.3.4', '1', 'EX', 1800);
    });

    it('locks email when threshold is reached', async () => {
      mockRedis.incr
        .mockResolvedValueOnce(5) // IP counter (not at threshold)
        .mockResolvedValueOnce(10); // email counter (at threshold)

      await service.recordFailedAttempt('1.2.3.4', 'user@test.com');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lockout:locked:email:user@test.com',
        '1',
        'EX',
        1800,
      );
    });

    it('does not throw on ValKey error', async () => {
      mockRedis.incr.mockRejectedValue(new Error('timeout'));

      await expect(
        service.recordFailedAttempt('1.2.3.4', 'user@test.com'),
      ).resolves.toBeUndefined();
    });

    it('sets expire only on first increment', async () => {
      mockRedis.incr.mockResolvedValue(5); // not the first increment

      await service.recordFailedAttempt('1.2.3.4');

      // expire should NOT be called since incr didn't return 1
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  // ── resetAttempts ─────────────────────────────────────────────────────────

  describe('resetAttempts', () => {
    it('deletes IP counter', async () => {
      await service.resetAttempts('1.2.3.4');

      expect(mockRedis.del).toHaveBeenCalledWith('lockout:ip:1.2.3.4');
    });

    it('deletes both IP and email counters', async () => {
      await service.resetAttempts('1.2.3.4', 'user@test.com');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'lockout:ip:1.2.3.4',
        'lockout:email:user@test.com',
      );
    });

    it('does not throw on ValKey error', async () => {
      mockRedis.del.mockRejectedValue(new Error('disconnect'));

      await expect(service.resetAttempts('1.2.3.4')).resolves.toBeUndefined();
    });
  });

  // ── getLockoutStatus ──────────────────────────────────────────────────────

  describe('getLockoutStatus', () => {
    it('returns not locked when no lock key exists', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getLockoutStatus('user123');

      expect(result).toEqual({
        isLocked: false,
        remainingLockoutSeconds: 0,
        failedAttempts: 0,
      });
    });

    it('returns locked status with remaining TTL', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(900);
      mockRedis.get.mockResolvedValue('8');

      const result = await service.getLockoutStatus('user123');

      expect(result).toEqual({
        isLocked: true,
        remainingLockoutSeconds: 900,
        failedAttempts: 8,
      });
    });

    it('returns safe defaults on ValKey error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('timeout'));

      const result = await service.getLockoutStatus('user123');

      expect(result).toEqual({
        isLocked: false,
        remainingLockoutSeconds: 0,
        failedAttempts: 0,
      });
    });
  });

  // ── unlockAccount ─────────────────────────────────────────────────────────

  describe('unlockAccount', () => {
    it('deletes all lockout keys for the user', async () => {
      await service.unlockAccount('user123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'lockout:locked:email:user123',
        'lockout:locked:ip:user123',
        'lockout:email:user123',
        'lockout:ip:user123',
      );
    });
  });
});
