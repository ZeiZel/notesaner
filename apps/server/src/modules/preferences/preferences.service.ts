import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import type { UserPreference } from '@prisma/client';
import {
  CACHE_TTL_SECONDS,
  DEFAULT_PREFERENCES,
  MAX_PREFERENCE_VALUE_BYTES,
  MAX_PREFERENCES_PER_USER,
  PREFERENCE_NAMESPACES,
} from './preferences.constants';

// ─── Cache key helpers ──────────────────────────────────────────────────────

/** Cache key for all preferences of a user (key-value map). */
const allPrefsKey = (userId: string) => `prefs:${userId}`;

/** Cache key for a single preference. */
const singlePrefKey = (userId: string, key: string) => `prefs:${userId}:${key}`;

// ─── Response types ─────────────────────────────────────────────────────────

export interface PreferenceResponse {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Key-value map of all preferences for a user. */
export type PreferencesMap = Record<string, unknown>;

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  // ─── Validation helpers ─────────────────────────────────────────────────────

  /**
   * Validates that a preference key belongs to an allowed namespace.
   * Valid namespaces: theme.*, editor.*, sidebar.*, notifications.*, keybindings.*
   */
  validateNamespace(key: string): void {
    const isValid = PREFERENCE_NAMESPACES.some((ns) => key === ns || key.startsWith(`${ns}.`));

    if (!isValid) {
      throw new BadRequestException(
        `Invalid preference key "${key}". Keys must be namespaced with one of: ${PREFERENCE_NAMESPACES.join(', ')}`,
      );
    }
  }

  /**
   * Validates that a preference value does not exceed the max size (64 KB).
   */
  validateValueSize(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    const byteLength = Buffer.byteLength(serialized, 'utf-8');

    if (byteLength > MAX_PREFERENCE_VALUE_BYTES) {
      throw new BadRequestException(
        `Preference value for key "${key}" exceeds maximum size of ${MAX_PREFERENCE_VALUE_BYTES} bytes (got ${byteLength} bytes)`,
      );
    }
  }

  /**
   * Validates that adding `newKeysCount` preferences would not exceed the per-user limit.
   * Only counts keys that don't already exist for the user.
   */
  async validateKeyLimit(userId: string, newKeys: string[]): Promise<void> {
    const existingCount = await this.prisma.userPreference.count({
      where: { userId },
    });

    // Count how many of the new keys already exist (those won't increase the total)
    const existingNewKeys = await this.prisma.userPreference.count({
      where: {
        userId,
        key: { in: newKeys },
      },
    });

    const netNewKeys = newKeys.length - existingNewKeys;
    const projectedTotal = existingCount + netNewKeys;

    if (projectedTotal > MAX_PREFERENCES_PER_USER) {
      throw new BadRequestException(
        `Cannot exceed ${MAX_PREFERENCES_PER_USER} preferences per user. ` +
          `Current: ${existingCount}, attempting to add ${netNewKeys} new keys.`,
      );
    }
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /**
   * Get all preferences for the authenticated user as a key-value map.
   * Defaults are merged with stored values (stored values take precedence).
   * Results are cached in ValKey for fast subsequent reads.
   */
  async getAll(userId: string): Promise<PreferencesMap> {
    // Try cache first
    const cacheKey = allPrefsKey(userId);
    const cached = await this.safeGetCache(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as PreferencesMap;
    }

    const prefs = await this.prisma.userPreference.findMany({
      where: { userId },
      orderBy: { key: 'asc' },
    });

    // Merge defaults with stored values (stored values win)
    const map: PreferencesMap = { ...DEFAULT_PREFERENCES };
    for (const pref of prefs) {
      map[pref.key] = pref.value;
    }

    // Populate cache
    await this.safeSetCache(cacheKey, JSON.stringify(map), CACHE_TTL_SECONDS);

    return map;
  }

  /**
   * Get a single preference by key for the authenticated user.
   * Falls back to the default value if the key is not stored.
   * Throws NotFoundException if the key is neither stored nor has a default.
   */
  async getByKey(userId: string, key: string): Promise<PreferenceResponse> {
    this.validateNamespace(key);

    // Try single-key cache first
    const cacheKey = singlePrefKey(userId, key);
    const cached = await this.safeGetCache(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as PreferenceResponse;
    }

    const pref = await this.prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (pref) {
      const response = this.toResponse(pref);
      await this.safeSetCache(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
      return response;
    }

    // Fall back to default
    if (key in DEFAULT_PREFERENCES) {
      const response: PreferenceResponse = {
        key,
        value: DEFAULT_PREFERENCES[key],
        updatedAt: new Date(0).toISOString(), // epoch for defaults (never persisted)
      };
      await this.safeSetCache(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
      return response;
    }

    throw new NotFoundException(`Preference with key "${key}" not found`);
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Set (upsert) a single preference for the authenticated user.
   * Creates the preference if it does not exist, updates it otherwise.
   * Validates namespace, value size, and per-user key limit.
   * Invalidates related cache entries.
   */
  async set(userId: string, key: string, value: unknown): Promise<PreferenceResponse> {
    this.validateNamespace(key);
    this.validateValueSize(key, value);
    await this.validateKeyLimit(userId, [key]);

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
   * Validates namespaces, value sizes, and per-user key limit.
   * Invalidates all cache entries for the user.
   */
  async bulkSet(
    userId: string,
    entries: Array<{ key: string; value: unknown }>,
  ): Promise<PreferencesMap> {
    // Validate all entries before touching the database
    for (const entry of entries) {
      this.validateNamespace(entry.key);
      this.validateValueSize(entry.key, entry.value);
    }

    const keys = entries.map((e) => e.key);
    await this.validateKeyLimit(userId, keys);

    const operations = entries.map((entry) =>
      this.prisma.userPreference.upsert({
        where: { userId_key: { userId, key: entry.key } },
        create: { userId, key: entry.key, value: entry.value as never },
        update: { value: entry.value as never },
      }),
    );

    await this.prisma.$transaction(operations);

    // Invalidate all cache for this user (bulk update may affect many keys)
    await this.invalidateCacheAll(userId, keys);

    this.logger.debug(`Bulk preferences set: userId=${userId}, count=${entries.length}`);

    // Return the full updated map
    return this.getAll(userId);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  /**
   * Delete a single preference by key for the authenticated user.
   * Throws NotFoundException if the key does not exist.
   */
  async delete(userId: string, key: string): Promise<void> {
    this.validateNamespace(key);

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
   * Invalidate cache for a specific key and the "all preferences" map.
   */
  private async invalidateCache(userId: string, key: string): Promise<void> {
    try {
      await this.valkey.del(singlePrefKey(userId, key), allPrefsKey(userId));
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for user ${userId}: ${error}`);
    }
  }

  /**
   * Invalidate cache for multiple keys and the "all preferences" map.
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
   * Safe cache get -- returns null on any error instead of propagating.
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
   * Safe cache set -- silently swallows errors.
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
