import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from '../../modules/valkey/valkey.constants';

/**
 * Shape returned by the ThrottlerStorage.increment() method.
 * Defined locally because @nestjs/throttler v6 does not export it as a standalone type.
 */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * ValKey-backed storage adapter for @nestjs/throttler.
 *
 * Stores rate-limit counters in ValKey with TTL so they auto-expire.
 * This enables rate limiting across multiple server instances (horizontal scaling).
 *
 * Key format: `throttler:{key}` with an atomic INCR + EXPIRE pattern.
 */
@Injectable()
export class ValkeyThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(ValkeyThrottlerStorage.name);
  private readonly PREFIX = 'throttler:';

  constructor(@Inject(VALKEY_CLIENT) private readonly client: Redis) {}

  /**
   * Increments the request count for the given key.
   * Uses a Lua script for atomicity: INCR + conditional EXPIRE.
   *
   * Returns the current state: total hits, remaining TTL, whether blocked,
   * and the expiration timestamp.
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const storeKey = `${this.PREFIX}${key}`;

    try {
      // Lua script: atomically increment and set TTL on first hit
      const luaScript = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        local pttl = redis.call('PTTL', KEYS[1])
        return {current, pttl}
      `;

      const ttlMs = ttl; // @nestjs/throttler v6 passes ttl in milliseconds
      const result = (await this.client.eval(luaScript, 1, storeKey, ttlMs.toString())) as [
        number,
        number,
      ];

      const totalHits = result[0];
      const remainingTtlMs = result[1];

      const isBlocked = totalHits > limit;
      const timeToExpire = remainingTtlMs > 0 ? remainingTtlMs : ttlMs;

      // If blocked and blockDuration > 0, extend the TTL to enforce the block
      if (isBlocked && blockDuration > 0) {
        await this.client.pexpire(storeKey, blockDuration);
      }

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked,
        timeToBlockExpire: isBlocked
          ? Math.ceil((blockDuration > 0 ? blockDuration : timeToExpire) / 1000)
          : 0,
      };
    } catch (error) {
      // Fail open: if ValKey is unreachable, allow the request
      this.logger.error(`Failed to increment throttle key ${storeKey}`, error);
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  /**
   * Retrieves the current rate-limit state for a key without incrementing.
   * Used by the admin API for diagnostics.
   */
  async getRecord(key: string): Promise<{ totalHits: number; ttl: number } | null> {
    const storeKey = `${this.PREFIX}${key}`;

    try {
      const [value, pttl] = await Promise.all([
        this.client.get(storeKey),
        this.client.pttl(storeKey),
      ]);

      if (value === null) return null;

      return {
        totalHits: parseInt(value, 10),
        ttl: Math.max(0, Math.ceil(pttl / 1000)),
      };
    } catch (error) {
      this.logger.error(`Failed to get throttle record for ${storeKey}`, error);
      return null;
    }
  }

  /**
   * Resets the rate-limit counter for a given key.
   * Used by admin actions.
   */
  async reset(key: string): Promise<void> {
    const storeKey = `${this.PREFIX}${key}`;
    try {
      await this.client.del(storeKey);
    } catch (error) {
      this.logger.error(`Failed to reset throttle key ${storeKey}`, error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Client lifecycle is managed by ValkeyModule, nothing to clean up here.
  }
}
