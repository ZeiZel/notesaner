import { Injectable, Inject, Logger, HttpStatus } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from '../../modules/valkey/valkey.constants';
import {
  SLIDING_RATE_LIMIT_KEY,
  type SlidingRateLimitOptions,
} from '../decorators/rate-limit.decorator';

/**
 * Default limits applied when no @SlidingRateLimit() decorator is present.
 *
 * The auth default is intentionally lower than the API default because
 * credential-stuffing and brute-force attacks target auth endpoints.
 *
 * - API routes:  100 requests per 60-second window
 * - Auth routes: 20 requests per 60-second window  (/api/auth/*)
 */
const DEFAULT_API_LIMIT = 100;
const DEFAULT_AUTH_LIMIT = 20;
const DEFAULT_WINDOW_SECONDS = 60;

/** Path prefix used to detect auth routes that get the tighter default. */
const AUTH_PATH_PREFIX = '/api/auth';

/**
 * Lua script implementing an atomic sliding-window counter in ValKey.
 *
 * Algorithm:
 *   1. Remove all entries with score < (now - windowMs).
 *   2. Count remaining entries.
 *   3. If count < limit, add current request with score = now.
 *   4. Refresh the key TTL so it expires after the window.
 *   5. Return {count_after_add, window_remaining_ms}.
 *
 * KEYS[1] = sorted-set key
 * ARGV[1] = current timestamp (ms)
 * ARGV[2] = window duration (ms)
 * ARGV[3] = limit (max requests per window)
 * ARGV[4] = unique member for this request (timestamp:random)
 *
 * Returns: [allowed, count, windowRemainingMs]
 *   allowed        — 1 if the request is within the limit, 0 if blocked
 *   count          — current request count (after potential insertion)
 *   windowRemainingMs — ms until the oldest request in the window expires
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local cutoff = now - windowMs

-- Remove entries older than the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

-- Count current entries in the window
local count = redis.call('ZCARD', key)

if count < limit then
  -- Under limit: record this request
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, windowMs)
  return {1, count + 1, windowMs}
else
  -- Over limit: find when the oldest entry will expire
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2]) or now
  local retryAfterMs = (oldestScore + windowMs) - now
  if retryAfterMs < 0 then retryAfterMs = 0 end
  return {0, count, retryAfterMs}
end
`;

/**
 * Sliding window rate limiting middleware backed by ValKey.
 *
 * Applies distributed rate limiting to every HTTP request before it reaches
 * the NestJS route handler. Limits are resolved in the following priority:
 *
 *   1. @SlidingRateLimit() decorator on the route handler (most specific)
 *   2. @SlidingRateLimit() decorator on the controller class
 *   3. Default auth limit (20 req/min) for paths starting with /api/auth
 *   4. Default API limit (100 req/min) for all other paths
 *
 * Rate limit key format: `ratelimit:{ip|userId}:{path_without_params}`
 *
 * On ValKey failure the middleware **fails open** (allows the request) to
 * prevent a Redis outage from taking down the entire API. A warning is logged.
 *
 * Response headers set on every request:
 *   X-RateLimit-Limit     — window limit
 *   X-RateLimit-Remaining — remaining requests in the current window
 *   X-RateLimit-Reset     — Unix epoch seconds when the window resets
 *   Retry-After           — seconds to wait (only on 429 responses)
 */
@Injectable()
export class RateLimitMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly PREFIX = 'ratelimit:';

  constructor(@Inject(VALKEY_CLIENT) private readonly client: Redis) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { limit, windowSeconds } = this.resolveLimit(req);
    const windowMs = windowSeconds * 1000;

    const identifier = this.extractIdentifier(req);
    const routeKey = this.buildRouteKey(req);
    const storeKey = `${this.PREFIX}${identifier}:${routeKey}`;

    try {
      const nowMs = Date.now();
      // Unique member prevents duplicate-score collisions in the sorted set
      const member = `${nowMs}:${Math.random().toString(36).slice(2, 9)}`;

      const result = (await this.client.eval(
        SLIDING_WINDOW_LUA,
        1,
        storeKey,
        nowMs.toString(),
        windowMs.toString(),
        limit.toString(),
        member,
      )) as [number, number, number];

      const [allowed, currentCount, windowRemainingMs] = result;

      const remaining = Math.max(0, limit - currentCount);
      const resetAt = Math.ceil((nowMs + windowRemainingMs) / 1000);

      // Always set informational headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetAt.toString());

      if (allowed === 0) {
        const retryAfterSeconds = Math.ceil(windowRemainingMs / 1000);

        this.logger.warn(
          `Rate limit exceeded: ${storeKey} (${currentCount}/${limit} in ${windowSeconds}s window)`,
        );

        res.setHeader('Retry-After', retryAfterSeconds.toString());
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      // Fail open: if ValKey is unreachable, allow the request but log the error
      this.logger.error(
        `Rate limit check failed for ${storeKey} — failing open`,
        error instanceof Error ? error.message : String(error),
      );
      next();
    }
  }

  /**
   * Resolves the effective rate limit for the incoming request.
   *
   * Reads @SlidingRateLimit() metadata from the Express route handler or its
   * parent controller. Falls back to path-based defaults when no decorator
   * is present.
   *
   * NestJS attaches route handler metadata to the Express layer stack via
   * `Reflect.getMetadata`. The target function is accessible as
   * `req.route?.stack[n]?.handle`.
   */
  private resolveLimit(req: Request): { limit: number; windowSeconds: number } {
    // Attempt to read decorator metadata from the matched route handler.
    // Express stores the handler chain in req.route.stack when the route
    // has been matched; at middleware time the route may already be matched.
    const expressReq = req as Request & {
      route?: { stack?: Array<{ handle?: unknown }> };
    };

    const handlers = expressReq.route?.stack ?? [];

    for (const layer of handlers) {
      if (typeof layer.handle === 'function') {
        const meta = Reflect.getMetadata(SLIDING_RATE_LIMIT_KEY, layer.handle) as
          | SlidingRateLimitOptions
          | undefined;

        if (meta) {
          return meta;
        }
      }
    }

    // Path-based defaults when no decorator is found
    const isAuthPath = req.path.startsWith(AUTH_PATH_PREFIX);

    return {
      limit: isAuthPath ? DEFAULT_AUTH_LIMIT : DEFAULT_API_LIMIT,
      windowSeconds: DEFAULT_WINDOW_SECONDS,
    };
  }

  /**
   * Extracts a stable identifier for the requester.
   *
   * Authenticated users are keyed by their userId (from JWT `sub`) to provide
   * per-user limits that are immune to shared-IP issues (corporate NATs, etc.).
   * Unauthenticated requests fall back to IP address.
   */
  private extractIdentifier(req: Request): string {
    const authedReq = req as Request & { user?: { sub?: string } };

    if (authedReq.user?.sub) {
      return `user:${authedReq.user.sub}`;
    }

    // Respect X-Forwarded-For for deployments behind a reverse proxy
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return `ip:${ip.trim()}`;
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return `ip:${Array.isArray(realIp) ? realIp[0] : realIp}`;
    }

    return `ip:${req.ip ?? '127.0.0.1'}`;
  }

  /**
   * Builds a normalised route key that strips dynamic path segments.
   *
   * Using the raw `req.path` directly would create a unique key for every
   * note UUID, etc., causing an unbounded key explosion in ValKey.
   *
   * NestJS exposes the route pattern (with :param placeholders) on
   * `req.route.path`. We use that when available; otherwise we normalise
   * the raw path by replacing UUID-like segments with `:id`.
   */
  private buildRouteKey(req: Request): string {
    const expressReq = req as Request & { route?: { path?: string } };

    if (expressReq.route?.path && typeof expressReq.route.path === 'string') {
      return `${req.method}:${expressReq.route.path}`;
    }

    // Fallback: replace UUIDs and numeric IDs with a placeholder
    const normalised = req.path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+(?=\/|$)/g, '/:id');

    return `${req.method}:${normalised}`;
  }
}
