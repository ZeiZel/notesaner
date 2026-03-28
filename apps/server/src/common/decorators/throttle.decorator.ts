import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Named rate limit profiles.
 *
 * Each profile defines the throttler name, limit, and TTL that
 * override the global defaults for specific route groups.
 *
 * These are used with the @nestjs/throttler @Throttle() decorator.
 */
export const RATE_LIMIT_PROFILE_KEY = 'rateLimitProfile';

export type RateLimitProfile = 'auth' | 'search' | 'upload' | 'global';

/**
 * Rate limit configuration per profile.
 * Values can be overridden via environment variables (see configuration.ts).
 *
 * Defaults:
 * - global:  100 requests / 60 seconds (per user or IP)
 * - auth:      5 requests / 60 seconds (per IP)
 * - search:   30 requests / 60 seconds (per user)
 * - upload:   10 requests / 60 seconds (per user)
 */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitProfile, { limit: number; ttl: number }> = {
  global: { limit: 100, ttl: 60_000 }, // 100 req/min
  auth: { limit: 5, ttl: 60_000 }, // 5 req/min
  search: { limit: 30, ttl: 60_000 }, // 30 req/min
  upload: { limit: 10, ttl: 60_000 }, // 10 req/min
};

/**
 * Applies a named rate limit profile to a route or controller.
 *
 * @example
 * @RateLimit('auth')
 * @Post('login')
 * async login() { ... }
 */
export function RateLimit(profile: RateLimitProfile) {
  const config = RATE_LIMIT_DEFAULTS[profile];
  return applyDecorators(
    SetMetadata(RATE_LIMIT_PROFILE_KEY, profile),
    Throttle({
      default: {
        limit: config.limit,
        ttl: config.ttl,
      },
    }),
  );
}

/**
 * Auth rate limit: 5 requests per minute per IP.
 * Applied to login, register, forgot-password, etc.
 */
export const AuthRateLimit = () => RateLimit('auth');

/**
 * Search rate limit: 30 requests per minute per user.
 */
export const SearchRateLimit = () => RateLimit('search');

/**
 * Upload rate limit: 10 requests per minute per user.
 */
export const UploadRateLimit = () => RateLimit('upload');
