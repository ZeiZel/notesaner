import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import type { UserPreference } from '@prisma/client';

// ─── Cache key helpers ──────────────────────────────────────────────────────

/** Cache key for all preferences of a user. */
const allPrefsKey = (userId: string) => `prefs:all:${userId}`;

/** Cache key for a single preference. */
const singlePrefKey = (userId: string, key: string) => `prefs:${userId}:${key}`;

/** Default TTL for cached preferences: 5 minutes (in seconds). */
const CACHE_TTL_SECONDS = 300;

// ─── Response types ─────────────────────────────────────────────────────────

export interface PreferenceResponse {
  key: string;
  value: unknown;
  updatedAt: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────────

  /**
   * Get all preferences for the authenticated user.
   * Results are cached in ValKey for fast subsequent reads.
   */
  async getAll(userId: string): Promise<PreferenceResponse[]> {
    // Try cache first
    const cacheKey = allPrefsKey(userId);
    const cached = await this.safeGetCache(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as PreferenceResponse[];
    }

    const prefs = await this.prisma.userPreference.findMany({
      where: { userId },
      orderBy: { key: 'asc' },
    });

    const response = prefs.map((p) => this.toResponse(p));

    // Populate cache
    await this.safeSetCache(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * Get a single preference by key for the authenticated user.
   * Throws NotFoundException if the key does not exist.
   */
  async getByKey(userId: string, key: string): Promise<PreferenceResponse> {
    // Try single-key cache first
    const cacheKey = singlePrefKey(userId, key);
    const cached = await this.safeGetCache(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as PreferenceResponse;
    }

    const pref = await this.prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!pref) {
      throw new NotFoundException(`Preference with key "${key}" not found`);
    }

    const response = this.toResponse(pref);

    await this.safeSetCache(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);

    return response;
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Set (upsert) a single preference for the authenticated user.
   * Creates the preference if it does not exist, updates it otherwise.
   * Invalidates related cache entries.
   */
  async set(userId: string, key: string, value: unknown): Promise<PreferenceResponse> {
    const pref = await this.prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: value as never },
      update: { value: value as never },
    });

    const response = this.toResponse(pref);

    // Invalidate cache
    await this.invalidateCache(userId, key);

    this.logger.debug(`Preference set: userId=${userId}, key=${key}`);

    return response;
  }

  /**
   * Bulk set (upsert) multiple preferences in a single transaction.
   * All preferences are created or updated atomically.
   * Invalidates all cache entries for the user.
   */
  async bulkSet(
    userId: string,
    entries: Array<{ key: string; value: unknown }>,
  ): Promise<PreferenceResponse[]> {
    const operations = entries.map((entry) =>
      this.prisma.userPreference.upsert({
        where: { userId_key: { userId, key: entry.key } },
        create: { userId, key: entry.key, value: entry.value as never },
        update: { value: entry.value as never },
      }),
    );

    const results = await this.prisma.$transaction(operations);

    const responses = results.map((p) => this.toResponse(p));

    // Invalidate all cache for this user (bulk update may affect many keys)
    await this.invalidateCacheAll(
      userId,
      entries.map((e) => e.key),
    );

    this.logger.debug(`Bulk preferences set: userId=${userId}, count=${entries.length}`);

    return responses;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  /**
   * Delete a single preference by key for the authenticated user.
   * Throws NotFoundException if the key does not exist.
   */
  async delete(userId: string, key: string): Promise<void> {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!existing) {
      throw new NotFoundException(`Preference with key "${key}" not found`);
    }

    await this.prisma.userPreference.delete({
      where: { userId_key: { userId, key } },
    });

    // Invalidate cache
    await this.invalidateCache(userId, key);

    this.logger.debug(`Preference deleted: userId=${userId}, key=${key}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private toResponse(pref: UserPreference): PreferenceResponse {
    return {
      key: pref.key,
      value: pref.value,
      updatedAt: pref.updatedAt.toISOString(),
    };
  }

  /**
   * Invalidate cache for a specific key and the "all preferences" list.
   */
  private async invalidateCache(userId: string, key: string): Promise<void> {
    try {
      await this.valkey.del(singlePrefKey(userId, key), allPrefsKey(userId));
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for user ${userId}: ${error}`);
    }
  }

  /**
   * Invalidate cache for multiple keys and the "all preferences" list.
   */
  private async invalidateCacheAll(userId: string, keys: string[]): Promise<void> {
    try {
      const cacheKeys = [allPrefsKey(userId), ...keys.map((k) => singlePrefKey(userId, k))];
      await this.valkey.del(...cacheKeys);
    } catch (error) {
      this.logger.warn(`Bulk cache invalidation failed for user ${userId}: ${error}`);
    }
  }

  /**
   * Safe cache get — returns null on any error instead of propagating.
   * Cache misses should never block the primary database read path.
   */
  private async safeGetCache(key: string): Promise<string | null> {
    try {
      return await this.valkey.get(key);
    } catch (error) {
      this.logger.warn(`Cache read failed for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Safe cache set — silently swallows errors.
   * Cache writes should never block the response.
   */
  private async safeSetCache(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.valkey.set(key, value, ttl);
    } catch (error) {
      this.logger.warn(`Cache write failed for key ${key}: ${error}`);
    }
  }
}
