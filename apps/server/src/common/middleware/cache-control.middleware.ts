import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { resolveCachePolicyForPath, DEFAULT_CACHE_CONTROL } from '../../config/cache-policy';

/**
 * CacheControlMiddleware -- sets Cache-Control, Vary, and Surrogate-Control
 * headers on responses based on route pattern matching.
 *
 * This middleware runs early in the pipeline and sets default cache headers
 * based on the URL path. The CacheControlInterceptor (running later) can
 * override these values if a route has an explicit @CachePolicy() decorator.
 *
 * Order of precedence (later overrides earlier):
 *   1. This middleware (route pattern matching from cache-policy.ts)
 *   2. CacheControlInterceptor (@CachePolicy decorator or @Public inference)
 *
 * Only applies to GET and HEAD requests. Mutating methods (POST, PUT, DELETE)
 * always receive `no-store` to prevent caching of state-changing responses.
 */
@Injectable()
export class CacheControlMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Mutating methods must never be cached
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Cache-Control', 'no-store');
      next();
      return;
    }

    const policy = resolveCachePolicyForPath(req.path);

    if (policy) {
      res.setHeader('Cache-Control', policy.cacheControl);

      if (policy.vary) {
        res.setHeader('Vary', policy.vary);
      }

      // Surrogate-Control is consumed by CDN proxies (Fastly, Cloudflare, etc.)
      // and stripped before reaching the client. It allows CDN-specific TTLs
      // that differ from the browser Cache-Control.
      if (policy.surrogateControl) {
        res.setHeader('Surrogate-Control', policy.surrogateControl);
      }
    } else {
      // Default: private, no-cache (safe for authenticated data)
      res.setHeader('Cache-Control', DEFAULT_CACHE_CONTROL);
    }

    next();
  }
}
