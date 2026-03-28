import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { ValkeyService } from '../../modules/valkey/valkey.service';

// ─── Decorator metadata keys ────────────────────────────────────────────────

export const PAGE_CACHE_KEY = 'pageCache';
export const PAGE_CACHE_TTL_KEY = 'pageCacheTtl';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PageCacheOptions {
  /**
   * TTL in seconds for the cached page.
   * @default 300 (5 minutes)
   */
  ttl?: number;

  /**
   * Custom cache key prefix. Defaults to 'page'.
   * The full key will be: `{prefix}:{slug}:{path}`
   */
  prefix?: string;

  /**
   * Whether to include query parameters in the cache key.
   * @default false
   */
  includeQuery?: boolean;
}

// ─── Decorator ──────────────────────────────────────────────────────────────

/**
 * Enables ValKey page caching for a route handler.
 *
 * Cached responses are stored as JSON in ValKey with a configurable TTL.
 * Subsequent requests for the same route will be served directly from cache,
 * bypassing the handler entirely.
 *
 * Use this for publicly accessible, read-heavy endpoints like published
 * note pages, vault indexes, and navigation trees.
 *
 * @example
 * // Cache published note page for 5 minutes (default)
 * @PageCache()
 * @Get(':slug/notes/*')
 * getPublishedNote(...) {}
 *
 * @example
 * // Cache with custom TTL (10 minutes) and prefix
 * @PageCache({ ttl: 600, prefix: 'vault' })
 * @Get(':slug')
 * getVaultIndex(...) {}
 */
export const PageCache = (options?: PageCacheOptions) => {
  const ttl = options?.ttl ?? 300;
  const prefix = options?.prefix ?? 'page';
  const includeQuery = options?.includeQuery ?? false;

  return SetMetadata(PAGE_CACHE_KEY, { ttl, prefix, includeQuery });
};

// ─── Cache key builder ──────────────────────────────────────────────────────

/**
 * Builds a cache key from the request path and optional query parameters.
 *
 * Format: `{prefix}:{path}` or `{prefix}:{path}?{sortedQueryString}`
 */
export function buildPageCacheKey(
  prefix: string,
  path: string,
  query?: Record<string, unknown>,
  includeQuery = false,
): string {
  // Normalise path: remove trailing slashes and decode
  const normalisedPath = decodeURIComponent(path).replace(/\/+$/, '') || '/';

  if (!includeQuery || !query || Object.keys(query).length === 0) {
    return `${prefix}:${normalisedPath}`;
  }

  // Sort query params for consistent cache keys
  const sorted = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');

  return sorted ? `${prefix}:${normalisedPath}?${sorted}` : `${prefix}:${normalisedPath}`;
}

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * Page cache interceptor that caches full JSON responses in ValKey.
 *
 * Only active on routes decorated with `@PageCache()`. Reads the cache
 * before the handler runs; writes the response to cache after the handler
 * completes successfully.
 *
 * Cache hits:
 * - Return the cached JSON response immediately (handler is not invoked).
 * - Set `X-Cache: HIT` header for observability.
 *
 * Cache misses:
 * - Run the handler, serialise the response to JSON, store in ValKey.
 * - Set `X-Cache: MISS` header.
 *
 * Only applies to GET and HEAD requests. Non-GET requests are passed through.
 *
 * This interceptor must be registered BEFORE the ETagInterceptor in the
 * interceptor chain, so that ETag headers are computed on the cached body.
 */
@Injectable()
export class PageCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PageCacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly valkeyService: ValkeyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Only cache GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle();
    }

    // Check for @PageCache() decorator
    const pageCacheConfig = this.reflector.getAllAndOverride<
      { ttl: number; prefix: string; includeQuery: boolean } | undefined
    >(PAGE_CACHE_KEY, [context.getHandler(), context.getClass()]);

    if (!pageCacheConfig) {
      return next.handle();
    }

    const { ttl, prefix, includeQuery } = pageCacheConfig;
    const cacheKey = buildPageCacheKey(
      prefix,
      req.path,
      req.query as Record<string, unknown>,
      includeQuery,
    );

    // --- Try cache hit ---
    try {
      const cached = await this.valkeyService.get(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        const parsed: unknown = JSON.parse(cached);
        return of(parsed);
      }
    } catch (err) {
      // Cache read failure should not block the request
      this.logger.warn(`Page cache read failed for key "${cacheKey}": ${String(err)}`);
    }

    // --- Cache miss: run handler and cache the result ---
    res.setHeader('X-Cache', 'MISS');

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          if (body === undefined || body === null) return;

          // Fire-and-forget: store in cache asynchronously
          void this.cacheResponse(cacheKey, body, ttl);
        },
        error: () => {
          // Do not cache error responses
        },
      }),
    );
  }

  private async cacheResponse(key: string, body: unknown, ttl: number): Promise<void> {
    try {
      const serialised = typeof body === 'string' ? body : JSON.stringify(body);
      await this.valkeyService.set(key, serialised, ttl);
    } catch (err) {
      this.logger.warn(`Page cache write failed for key "${key}": ${String(err)}`);
    }
  }
}
