/**
 * Unit tests for ValkeyThrottlerStorage.
 *
 * Covers:
 * - increment(): atomic counter with TTL via Lua script
 * - increment(): fail-open behavior when ValKey is unreachable
 * - increment(): blocked state when limit exceeded
 * - getRecord(): retrieves current state without incrementing
 * - reset(): clears the rate-limit counter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValkeyThrottlerStorage } from '../throttler/valkey-throttler-storage.service';

// ─── Mock Redis client ──────────────────────────────────────────────────────

function createMockRedis(overrides: Record<string, unknown> = {}) {
  return {
    eval: vi.fn().mockResolvedValue([1, 60000]),
    get: vi.fn().mockResolvedValue(null),
    pttl: vi.fn().mockResolvedValue(-2),
    del: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ValkeyThrottlerStorage', () => {
  let storage: ValkeyThrottlerStorage;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    storage = new ValkeyThrottlerStorage(mockRedis as never);
  });

  // ── increment ─────────────────────────────────────────────────────────────

  describe('increment', () => {
    it('calls eval with the correct Lua script and returns record', async () => {
      mockRedis.eval.mockResolvedValue([3, 45000]);

      const result = await storage.increment('test-key', 60000, 100, 0, 'default');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        1,
        'throttler:test-key',
        '60000',
      );
      expect(result).toEqual({
        totalHits: 3,
        timeToExpire: 45, // 45000ms -> 45s
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('detects blocked state when totalHits > limit', async () => {
      mockRedis.eval.mockResolvedValue([101, 30000]);

      const result = await storage.increment('blocked-key', 60000, 100, 0, 'default');

      expect(result.isBlocked).toBe(true);
      expect(result.totalHits).toBe(101);
    });

    it('extends TTL when blocked and blockDuration > 0', async () => {
      mockRedis.eval.mockResolvedValue([11, 5000]);

      await storage.increment('block-extend', 60000, 10, 120000, 'default');

      expect(mockRedis.pexpire).toHaveBeenCalledWith('throttler:block-extend', 120000);
    });

    it('does not extend TTL when not blocked', async () => {
      mockRedis.eval.mockResolvedValue([5, 55000]);

      await storage.increment('not-blocked', 60000, 100, 120000, 'default');

      expect(mockRedis.pexpire).not.toHaveBeenCalled();
    });

    it('fails open when ValKey throws', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Connection refused'));

      const result = await storage.increment('fail-key', 60000, 100, 0, 'default');

      expect(result).toEqual({
        totalHits: 0,
        timeToExpire: 60, // fallback: ttl/1000
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('uses the correct key prefix', async () => {
      mockRedis.eval.mockResolvedValue([1, 60000]);

      await storage.increment('my:custom:key', 60000, 100, 0, 'default');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'throttler:my:custom:key',
        expect.any(String),
      );
    });
  });

  // ── getRecord ─────────────────────────────────────────────────────────────

  describe('getRecord', () => {
    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await storage.getRecord('nonexistent');

      expect(result).toBeNull();
    });

    it('returns hit count and TTL when key exists', async () => {
      mockRedis.get.mockResolvedValue('42');
      mockRedis.pttl.mockResolvedValue(30000);

      const result = await storage.getRecord('existing');

      expect(result).toEqual({ totalHits: 42, ttl: 30 });
      expect(mockRedis.get).toHaveBeenCalledWith('throttler:existing');
      expect(mockRedis.pttl).toHaveBeenCalledWith('throttler:existing');
    });

    it('clamps negative TTL to 0', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.pttl.mockResolvedValue(-1);

      const result = await storage.getRecord('expiring');

      expect(result).toEqual({ totalHits: 5, ttl: 0 });
    });

    it('returns null on ValKey error', async () => {
      mockRedis.get.mockRejectedValue(new Error('timeout'));

      const result = await storage.getRecord('error-key');

      expect(result).toBeNull();
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('deletes the key from ValKey', async () => {
      await storage.reset('user123');

      expect(mockRedis.del).toHaveBeenCalledWith('throttler:user123');
    });

    it('does not throw on ValKey error', async () => {
      mockRedis.del.mockRejectedValue(new Error('disconnect'));

      await expect(storage.reset('error-key')).resolves.toBeUndefined();
    });
  });
});
