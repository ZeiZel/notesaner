import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by RateLimitMiddleware to read per-route limits.
 *
 * Stored on both the route handler and the controller class so the middleware
 * can find the closest applicable limit.
 */
export const SLIDING_RATE_LIMIT_KEY = 'slidingRateLimit' as const;

/**
 * Per-route rate limit configuration attached by @SlidingRateLimit().
 */
export interface SlidingRateLimitOptions {
  /** Maximum number of requests allowed in the sliding window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

/**
 * Declares a custom sliding-window rate limit for a route or controller.
 *
 * When applied, RateLimitMiddleware uses these values instead of the global
 * defaults (100 req/min for API, 20 req/min for auth).
 *
 * The algorithm is a strict sliding window implemented in ValKey via a Lua
 * script: each request is stored as a scored member (score = timestamp ms)
 * in a sorted set. Entries older than the window are pruned on every request,
 * so the count always reflects the last `windowSeconds` of traffic.
 *
 * @param limit - Maximum number of requests allowed within the window.
 * @param windowSeconds - Duration of the sliding window in seconds.
 *
 * @example
 * // Custom limit on a specific route
 * @SlidingRateLimit(10, 60)
 * @Post('export')
 * exportNote() { ... }
 *
 * @example
 * // Tighter limit for an entire controller
 * @SlidingRateLimit(20, 60)
 * @Controller('auth')
 * class AuthController { ... }
 */
export const SlidingRateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata<typeof SLIDING_RATE_LIMIT_KEY, SlidingRateLimitOptions>(SLIDING_RATE_LIMIT_KEY, {
    limit,
    windowSeconds,
  });
