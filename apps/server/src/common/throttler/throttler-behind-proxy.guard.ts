import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { SKIP_THROTTLE_KEY } from '../decorators/skip-throttle.decorator';

/**
 * Custom ThrottlerGuard that extracts the real client IP from proxy headers.
 *
 * In production, the NestJS server typically sits behind a reverse proxy
 * (nginx, Cloudflare, etc.), so req.ip would be the proxy's IP.
 * This guard reads X-Forwarded-For or X-Real-Ip to get the actual client IP.
 *
 * For authenticated endpoints, the tracker key includes the userId so rate
 * limits are per-user rather than per-IP. This prevents shared-IP issues
 * (e.g., corporate NATs) while still limiting individual abuse.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  /**
   * Extract the real client IP, falling back to req.ip.
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as {
      ips?: string[];
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      user?: { sub?: string };
    };

    // If the user is authenticated, use their userId as the tracker.
    // This provides per-user rate limiting regardless of IP.
    if (request.user?.sub) {
      return request.user.sub;
    }

    // For unauthenticated requests, use the real IP.
    // Express populates req.ips when trust proxy is enabled.
    if (request.ips && request.ips.length > 0) {
      return request.ips[0];
    }

    // Fallback: check common proxy headers
    const forwarded = request.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip.trim();
    }

    const realIp = request.headers?.['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return (request.ip as string) ?? '127.0.0.1';
  }

  /**
   * Skip throttling for routes decorated with @SkipThrottle().
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const reflector = this['reflector'] as Reflector | undefined;
    if (!reflector) return false;

    const skipThrottle = reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return skipThrottle === true;
  }
}
