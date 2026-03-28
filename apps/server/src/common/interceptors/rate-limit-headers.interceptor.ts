import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_PROFILE_KEY, RATE_LIMIT_DEFAULTS } from '../decorators/throttle.decorator';
import type { RateLimitProfile } from '../decorators/throttle.decorator';
import { SKIP_THROTTLE_KEY } from '../decorators/skip-throttle.decorator';

/**
 * Interceptor that adds standard rate-limit headers to every response:
 *
 * - X-RateLimit-Limit: maximum requests allowed in the window
 * - X-RateLimit-Remaining: remaining requests in the current window
 * - X-RateLimit-Reset: Unix epoch seconds when the window resets
 *
 * These headers are set AFTER the ThrottlerGuard has run, using the
 * rate limit metadata attached to the request by the guard.
 *
 * The ThrottlerGuard from @nestjs/throttler v6 sets response headers
 * internally (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset,
 * Retry-After). This interceptor supplements any missing headers with
 * fallback values from the profile configuration.
 */
@Injectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipThrottle) {
      return next.handle();
    }

    // Determine which rate limit profile applies
    const profile =
      this.reflector.getAllAndOverride<RateLimitProfile | undefined>(RATE_LIMIT_PROFILE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'global';

    const config = RATE_LIMIT_DEFAULTS[profile];

    return next.handle().pipe(
      tap({
        next: () => {
          try {
            const response = context.switchToHttp().getResponse<Response>();
            if (!response || typeof response.getHeader !== 'function') return;

            // Only set headers that the ThrottlerGuard did not already set.
            // The guard sets them as lowercase in v6.
            if (
              !response.getHeader('x-ratelimit-limit') &&
              !response.getHeader('X-RateLimit-Limit')
            ) {
              response.setHeader('X-RateLimit-Limit', config.limit.toString());
            }

            // Ensure the reset header uses Unix epoch seconds
            if (
              !response.getHeader('x-ratelimit-reset') &&
              !response.getHeader('X-RateLimit-Reset')
            ) {
              const resetAt = Math.ceil(Date.now() / 1000) + Math.ceil(config.ttl / 1000);
              response.setHeader('X-RateLimit-Reset', resetAt.toString());
            }
          } catch {
            // Non-critical; do not break the response pipeline
          }
        },
      }),
    );
  }
}
