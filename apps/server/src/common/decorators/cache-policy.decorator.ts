import { SetMetadata } from '@nestjs/common';

export type CachePolicyType = 'public' | 'private' | 'static';

export const CACHE_POLICY_KEY = 'cachePolicy';

/**
 * Declares the caching policy for a route or controller.
 *
 * The CacheControlInterceptor reads this metadata to set appropriate
 * Cache-Control headers on the HTTP response.
 *
 * Policies:
 * - `public`  — safe for shared caches (CDN, proxies); max-age=300 (5 min)
 * - `private` — user-specific, must not be stored in shared caches; no-cache
 * - `static`  — immutable public resources (images, fonts, etc.); max-age=86400 (1 day)
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
 */
export const CachePolicy = (policy: CachePolicyType) => SetMetadata(CACHE_POLICY_KEY, policy);
