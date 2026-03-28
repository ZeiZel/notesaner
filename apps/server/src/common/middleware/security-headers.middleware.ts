import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware.
 *
 * Adds comprehensive security headers to all HTTP responses:
 * - Content-Security-Policy (CSP)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Strict-Transport-Security (HSTS)
 *
 * Helmet is applied in main.ts for base headers; this middleware adds
 * granular CSP and other headers that require runtime configuration.
 *
 * CSP for plugin iframes is handled separately via the plugin routes.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);

  private readonly cspDirectives: string;
  private readonly cspReportOnly: boolean;
  private readonly hstsMaxAge: number;
  private readonly permissionsPolicy: string;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    const allowedOrigins = this.config.get<string[]>('cors.allowedOrigins', [
      'http://localhost:3000',
    ]);

    // Build CSP connect-src dynamically: allow self + WebSocket connections
    const wsOrigins = allowedOrigins.map((origin) => origin.replace(/^http/, 'ws'));
    const connectSrc = ["'self'", ...wsOrigins, 'wss:'].join(' ');

    // CSP directives
    const directives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      `connect-src ${connectSrc}`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // Plugin iframes: sandboxed, allow scripts only
      "frame-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self'",
    ];

    // Override CSP via environment variable
    const customCsp = this.config.get<string>('security.csp', '');
    this.cspDirectives = customCsp || directives.join('; ');

    // CSP report-only mode (useful for testing in staging)
    this.cspReportOnly = this.config.get<boolean>('security.cspReportOnly', false);

    // HSTS: 1 year, include subdomains
    this.hstsMaxAge = this.config.get<number>('security.hstsMaxAge', 31536000);

    // Permissions-Policy: deny access to sensitive APIs
    const permissionsPolicyOverride = this.config.get<string>('security.permissionsPolicy', '');
    this.permissionsPolicy =
      permissionsPolicyOverride ||
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()';

    if (nodeEnv !== 'production' && !this.cspReportOnly) {
      this.logger.debug('Security headers middleware initialized (enforcement mode)');
    }
  }

  use(_req: Request, res: Response, next: NextFunction): void {
    // Content-Security-Policy
    const cspHeader = this.cspReportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    res.setHeader(cspHeader, this.cspDirectives);

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking — DENY for all pages except plugin iframe routes
    res.setHeader('X-Frame-Options', 'DENY');

    // Control referer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict access to browser features
    res.setHeader('Permissions-Policy', this.permissionsPolicy);

    // HSTS — only in production (browsers will reject non-HTTPS after seeing this)
    const isProduction = this.config.get<string>('nodeEnv') === 'production';
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', `max-age=${this.hstsMaxAge}; includeSubDomains`);
    }

    // Prevent DNS prefetching to reduce information leakage
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Prevent Flash/PDF cross-domain requests
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  }
}
