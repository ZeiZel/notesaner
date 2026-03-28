import { Injectable, Logger } from '@nestjs/common';
import { ValkeyService } from '../../modules/valkey/valkey.service';

// ─── Cache key prefixes ─────────────────────────────────────────────────────

/**
 * Default prefix for page cache keys. Matches the default in @PageCache() decorator.
 */
export const PAGE_CACHE_PREFIX = 'page';

/**
 * Prefix for public vault cache keys used by PublicVaultService.
 */
export const PUBLIC_VAULT_PREFIX = 'pv';

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * PageCacheService — centralised cache invalidation for page-level caches.
 *
 * Provides methods to invalidate cache entries by pattern, prefix, or exact key.
 * Used by services that mutate data (note update, publish/unpublish) to bust
 * stale cached responses.
 *
 * Cache key conventions:
 * - `page:/p/{slug}` — public vault page (served by PageCacheInterceptor)
 * - `page:/p/{slug}/notes/{path}` — individual published note page
 * - `pv:index:{slug}` — vault index (set directly by PublicVaultService)
 * - `pv:notes:{slug}:{query}` — paginated note list
 * - `pv:note:{slug}:{path}` — individual note detail
 */
@Injectable()
export class PageCacheService {
  private readonly logger = new Logger(PageCacheService.name);

  constructor(private readonly valkeyService: ValkeyService) {}

  /**
   * Invalidate all page cache entries for a given public vault slug.
   *
   * This busts both the PageCacheInterceptor entries (prefix: `page:`)
   * and the PublicVaultService entries (prefix: `pv:`).
   *
   * Should be called when:
   * - A note is published or unpublished
   * - A published note's content is updated
   * - The vault's public configuration changes
   */
  async invalidateVaultCache(publicSlug: string): Promise<number> {
    const patterns = [
      // PageCacheInterceptor keys
      `${PAGE_CACHE_PREFIX}:/p/${publicSlug}*`,
      `${PAGE_CACHE_PREFIX}:/public/${publicSlug}*`,
      // PublicVaultService keys
      `${PUBLIC_VAULT_PREFIX}:index:${publicSlug}`,
      `${PUBLIC_VAULT_PREFIX}:notes:${publicSlug}:*`,
      `${PUBLIC_VAULT_PREFIX}:note:${publicSlug}:*`,
    ];

    return this.invalidateByPatterns(patterns, `vault:${publicSlug}`);
  }

  /**
   * Invalidate a specific published note's cache entries.
   *
   * More targeted than `invalidateVaultCache` — only busts the note page
   * and the vault index (since the note count or list may have changed).
   */
  async invalidateNoteCache(publicSlug: string, notePath: string): Promise<number> {
    const normalisedPath = notePath.endsWith('.md') ? notePath : `${notePath}.md`;

    const patterns = [
      // Direct note page
      `${PAGE_CACHE_PREFIX}:/p/${publicSlug}/${normalisedPath}*`,
      `${PAGE_CACHE_PREFIX}:/public/${publicSlug}/notes/${normalisedPath}*`,
      // Note detail in PublicVaultService
      `${PUBLIC_VAULT_PREFIX}:note:${publicSlug}:${normalisedPath}`,
      // Note lists may have changed order/count
      `${PUBLIC_VAULT_PREFIX}:notes:${publicSlug}:*`,
      // Vault index (published note count may have changed)
      `${PUBLIC_VAULT_PREFIX}:index:${publicSlug}`,
    ];

    return this.invalidateByPatterns(patterns, `note:${publicSlug}/${notePath}`);
  }

  /**
   * Invalidate all page cache entries matching a prefix.
   *
   * @param prefix — the cache key prefix to match (e.g. 'page:/api/v1')
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    return this.invalidateByPatterns([`${prefix}*`], prefix);
  }

  /**
   * Invalidate a single cache key.
   */
  async invalidateKey(key: string): Promise<boolean> {
    try {
      const deleted = await this.valkeyService.del(key);
      return deleted > 0;
    } catch (err) {
      this.logger.warn(`Failed to invalidate key "${key}": ${String(err)}`);
      return false;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Scan ValKey for keys matching the given patterns and delete them all.
   * Returns the total number of keys deleted.
   */
  private async invalidateByPatterns(patterns: string[], context: string): Promise<number> {
    const keysToDelete: string[] = [];

    try {
      const client = this.valkeyService.getClient();

      for (const pattern of patterns) {
        // For exact keys (no wildcard), add directly
        if (!pattern.includes('*')) {
          keysToDelete.push(pattern);
          continue;
        }

        // Scan for matching keys
        let cursor = '0';
        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            keysToDelete.push(...keys);
          }
        } while (cursor !== '0');
      }
    } catch (err) {
      this.logger.warn(`Cache scan failed for context "${context}": ${String(err)}`);
      return 0;
    }

    if (keysToDelete.length === 0) {
      return 0;
    }

    // Deduplicate keys before deletion
    const uniqueKeys = [...new Set(keysToDelete)];

    try {
      const deleted = await this.valkeyService.del(...uniqueKeys);
      this.logger.debug(
        `Invalidated ${deleted} cache key(s) for context "${context}" ` +
          `(${uniqueKeys.length} unique keys scanned)`,
      );
      return deleted;
    } catch (err) {
      this.logger.warn(`Cache deletion failed for context "${context}": ${String(err)}`);
      return 0;
    }
  }
}
