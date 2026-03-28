import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  CACHE_POLICY_KEY,
  CACHE_CONTROL_OPTIONS_KEY,
  buildCacheControlHeader,
  type CachePolicyType,
  type CacheControlOptions,
} from '../decorators/cache-policy.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ─── Cache-Control directives ─────────────────────────────────────────────────

export const CACHE_CONTROL_HEADER = 'Cache-Control';
export const VARY_HEADER = 'Vary';
export const SURROGATE_CONTROL_HEADER = 'Surrogate-Control';

/**
 * Cache-Control header values for each preset policy.
 *
 * - `private`    — authenticated user data; browsers may cache, shared caches must not.
 * - `public`     — published / anonymous content; CDN and proxies may cache for 5 min.
 * - `static`     — immutable public assets (hashed filenames); CDN may cache for 1 year.
 * - `attachment` — user-uploaded images/files; public, 24h cache with ETag revalidation.
 * - `no-store`   — sensitive data; never cache (auth, tokens).
 */
export const CACHE_CONTROL_VALUES: Record<CachePolicyType | 'default', string> = {
  private: 'private, no-cache',
  public: 'public, max-age=300, stale-while-revalidate=60',
  static: 'public, max-age=31536000, immutable',
  attachment: 'public, max-age=86400, stale-while-revalidate=3600',
  'no-store': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  default: 'private, no-cache',
};

/**
 * Vary header values for each preset policy.
 * Only set when the policy benefits from Vary-based cache keying.
 */
const VARY_VALUES: Partial<Record<CachePolicyType | 'default', string>> = {
  private: 'Authorization, Accept-Encoding',
  public: 'Accept-Encoding',
  attachment: 'Accept-Encoding',
  default: 'Authorization, Accept-Encoding',
};

/**
 * Surrogate-Control values for CDN-specific caching.
 * Only set for policies where CDN TTL should differ from browser TTL.
 */
const SURROGATE_VALUES: Partial<Record<CachePolicyType, string>> = {
  public: 'max-age=300',
  static: 'max-age=31536000',
  attachment: 'max-age=86400',
};

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * Sets `Cache-Control`, `Vary`, and `Surrogate-Control` headers on HTTP
 * responses based on route metadata.
 *
 * Resolution order (first match wins):
 * 1. `@CacheControl({...})` decorator — fine-grained per-route options.
 * 2. `@CachePolicy('...')` decorator — preset policy on handler or controller.
 * 3. `@Public()` decorator — treated as `public, max-age=300`.
 * 4. Default fallback — `private, no-cache` (safe for authenticated data).
 *
 * Only applies to GET and HEAD requests. Mutating methods are passed through.
 *
 * @example
 * // Fine-grained control
 * @CacheControl({ scope: 'public', maxAge: 3600, staleWhileRevalidate: 600 })
 * @Get('popular')
 * getPopular(...) {}
 *
 * @example
 * // Preset policy
 * @CachePolicy('static')
 * @Get('assets/:hash')
 * getAsset(...) {}
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string }>();
    const res = http.getResponse<{
      setHeader: (name: string, value: string) => void;
      getHeader: (name: string) => string | undefined;
    }>();

    // Only touch GET/HEAD — other methods should not be cached.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle();
    }

    // 1. Check for @CacheControl() fine-grained options (highest precedence)
    const cacheControlOptions = this.reflector.getAllAndOverride<CacheControlOptions | undefined>(
      CACHE_CONTROL_OPTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (cacheControlOptions) {
      res.setHeader(CACHE_CONTROL_HEADER, buildCacheControlHeader(cacheControlOptions));

      if (cacheControlOptions.vary) {
        this.mergeVary(res, cacheControlOptions.vary);
      }
      if (cacheControlOptions.surrogateControl) {
        res.setHeader(SURROGATE_CONTROL_HEADER, cacheControlOptions.surrogateControl);
      }

      return next.handle();
    }

    // 2. Check for @CachePolicy() preset
    const policy = this.resolvePolicy(context);
    res.setHeader(CACHE_CONTROL_HEADER, CACHE_CONTROL_VALUES[policy]);

    // Set Vary header for correct proxy/CDN cache keying
    const vary = VARY_VALUES[policy];
    if (vary) {
      this.mergeVary(res, vary);
    }

    // Set Surrogate-Control for CDN-specific TTLs
    const surrogateControl = SURROGATE_VALUES[policy as CachePolicyType];
    if (surrogateControl) {
      res.setHeader(SURROGATE_CONTROL_HEADER, surrogateControl);
    }

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

  /**
   * Merge a new Vary value with any existing Vary header, deduplicating tokens.
   */
  private mergeVary(
    res: {
      setHeader: (name: string, value: string) => void;
      getHeader: (name: string) => string | undefined;
    },
    newVary: string,
  ): void {
    const existing = res.getHeader('Vary');
    if (!existing) {
      res.setHeader('Vary', newVary);
      return;
    }

    const existingTokens = new Set(existing.split(',').map((t) => t.trim().toLowerCase()));
    const newTokens = newVary.split(',').map((t) => t.trim());
    const merged: string[] = [...existing.split(',').map((t) => t.trim())];

    for (const token of newTokens) {
      if (!existingTokens.has(token.toLowerCase())) {
        merged.push(token);
      }
    }

    res.setHeader('Vary', merged.join(', '));
  }
}
