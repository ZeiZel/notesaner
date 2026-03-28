import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { CACHE_POLICY_KEY, type CachePolicyType } from '../decorators/cache-policy.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ─── Cache-Control directives ─────────────────────────────────────────────────

export const CACHE_CONTROL_HEADER = 'Cache-Control';

/**
 * Cache-Control header values for each policy.
 *
 * - `private`: authenticated user data; browsers may cache, shared caches must not.
 * - `public`: published / anonymous content; CDN and proxies may cache for 5 min.
 * - `static`: immutable public assets; CDN may cache for 24 h.
 */
export const CACHE_CONTROL_VALUES: Record<CachePolicyType | 'default', string> = {
  private: 'private, no-cache',
  public: 'public, max-age=300',
  static: 'public, max-age=86400, immutable',
  default: 'private, no-cache',
};

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * Sets `Cache-Control` headers on HTTP responses based on route metadata.
 *
 * Resolution order (first match wins):
 * 1. `@CachePolicy('...')` decorator on the handler or controller.
 * 2. `@Public()` decorator → treated as `public, max-age=300`.
 * 3. Default fallback → `private, no-cache` (safe for authenticated data).
 *
 * Only applies to GET and HEAD requests.  Mutating methods are passed through.
 *
 * @example
 * // Published note — cacheable by CDN
 * @CachePolicy('public')
 * @Get(':slug')
 * getPublishedNote(...) {}
 *
 * @example
 * // Authenticated endpoint — explicit private
 * @CachePolicy('private')
 * @Get('me')
 * getProfile(...) {}
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string }>();
    const res = http.getResponse<{ setHeader: (name: string, value: string) => void }>();

    // Only touch GET/HEAD — other methods should not be cached.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle();
    }

    const policy = this.resolvePolicy(context);
    res.setHeader(CACHE_CONTROL_HEADER, CACHE_CONTROL_VALUES[policy]);

    return next.handle();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private resolvePolicy(context: ExecutionContext): CachePolicyType | 'default' {
    // Explicit @CachePolicy() decorator takes highest precedence.
    const explicitPolicy = this.reflector.getAllAndOverride<CachePolicyType | undefined>(
      CACHE_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (explicitPolicy) {
      return explicitPolicy;
    }

    // @Public() routes serve anonymous content — treat as public cache.
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return 'public';
    }

    return 'default';
  }
}
