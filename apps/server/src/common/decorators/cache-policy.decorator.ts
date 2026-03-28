import { SetMetadata, applyDecorators } from '@nestjs/common';

export type CachePolicyType = 'public' | 'private' | 'static' | 'attachment' | 'no-store';

export const CACHE_POLICY_KEY = 'cachePolicy';
export const CACHE_CONTROL_OPTIONS_KEY = 'cacheControlOptions';

/**
 * Fine-grained Cache-Control options for use with @CacheControl() decorator.
 *
 * These allow per-route customisation of caching behaviour beyond the preset
 * policy types. When both @CachePolicy() and @CacheControl() are applied,
 * @CacheControl() takes precedence.
 */
export interface CacheControlOptions {
  /**
   * Whether the response is public (CDN/proxy cacheable) or private (browser only).
   * Defaults to 'private'.
   */
  scope?: 'public' | 'private';

  /**
   * max-age directive in seconds. How long the response is fresh.
   * Defaults to 0 (must revalidate).
   */
  maxAge?: number;

  /**
   * s-maxage directive in seconds. Overrides max-age for shared caches (CDN/proxy).
   * Only meaningful when scope is 'public'.
   */
  sMaxAge?: number;

  /**
   * stale-while-revalidate directive in seconds.
   * Allows serving stale content while revalidating in the background.
   */
  staleWhileRevalidate?: number;

  /**
   * stale-if-error directive in seconds.
   * Allows serving stale content when the origin returns an error.
   */
  staleIfError?: number;

  /** Mark the resource as immutable (never changes at this URL). */
  immutable?: boolean;

  /** no-cache — must revalidate with server every time (ETag/304 supported). */
  noCache?: boolean;

  /** no-store — do not cache at all (sensitive data). */
  noStore?: boolean;

  /** must-revalidate — stale responses must not be served. */
  mustRevalidate?: boolean;

  /** proxy-revalidate — stale responses must not be served by shared caches. */
  proxyRevalidate?: boolean;

  /**
   * Vary header value to include for correct CDN/proxy cache keying.
   * Example: 'Authorization, Accept-Encoding'
   */
  vary?: string;

  /**
   * Surrogate-Control header for CDN-specific caching that differs from
   * browser Cache-Control. Stripped by CDN before reaching the client.
   */
  surrogateControl?: string;
}

/**
 * Declares the caching policy for a route or controller using a preset.
 *
 * The CacheControlInterceptor reads this metadata to set appropriate
 * Cache-Control headers on the HTTP response.
 *
 * Policies:
 * - `public`     — safe for shared caches (CDN, proxies); max-age=300 (5 min)
 * - `private`    — user-specific, must not be stored in shared caches; no-cache
 * - `static`     — immutable public resources; max-age=31536000 (1 year), immutable
 * - `attachment` — user-uploaded files; public, max-age=86400 (1 day) with ETag
 * - `no-store`   — sensitive data; never cache (auth endpoints, tokens)
 *
 * Routes without this decorator default to `private, no-cache` (safest).
 *
 * @example
 * // Published note — cacheable by CDN
 * @CachePolicy('public')
 * @Get(':slug')
 * getPublishedNote(...) { ... }
 *
 * @example
 * // Static asset endpoint
 * @CachePolicy('static')
 * @Get('avatar/:id')
 * getAvatar(...) { ... }
 *
 * @example
 * // User-uploaded attachment
 * @CachePolicy('attachment')
 * @Get('files/:id')
 * getAttachment(...) { ... }
 */
export const CachePolicy = (policy: CachePolicyType) => SetMetadata(CACHE_POLICY_KEY, policy);

/**
 * Fine-grained Cache-Control decorator for per-route customisation.
 *
 * When applied, this takes precedence over @CachePolicy() and generates
 * a Cache-Control header string from the provided options.
 *
 * @example
 * // Custom: public, 1 hour cache with SWR
 * @CacheControl({ scope: 'public', maxAge: 3600, staleWhileRevalidate: 600 })
 * @Get('popular')
 * getPopular() { ... }
 *
 * @example
 * // Immutable static asset
 * @CacheControl({ scope: 'public', maxAge: 31536000, immutable: true })
 * @Get('static/:hash')
 * getStaticAsset() { ... }
 *
 * @example
 * // Sensitive endpoint — never cache
 * @CacheControl({ noStore: true })
 * @Post('auth/token')
 * issueToken() { ... }
 */
export const CacheControl = (options: CacheControlOptions) =>
  applyDecorators(SetMetadata(CACHE_CONTROL_OPTIONS_KEY, options));

/**
 * Build a Cache-Control header string from CacheControlOptions.
 *
 * Directive ordering follows HTTP/1.1 conventions:
 *   scope, no-store, no-cache, must-revalidate, proxy-revalidate,
 *   max-age, s-maxage, stale-while-revalidate, stale-if-error, immutable
 */
export function buildCacheControlHeader(options: CacheControlOptions): string {
  const directives: string[] = [];

  if (options.noStore) {
    directives.push('no-store', 'no-cache', 'must-revalidate', 'proxy-revalidate');
    return directives.join(', ');
  }

  // Scope
  directives.push(options.scope === 'public' ? 'public' : 'private');

  // Revalidation directives
  if (options.noCache) {
    directives.push('no-cache');
  }
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }
  if (options.proxyRevalidate) {
    directives.push('proxy-revalidate');
  }

  // Age directives
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  // Freshness extensions
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  // Immutability
  if (options.immutable) {
    directives.push('immutable');
  }

  return directives.join(', ');
}
