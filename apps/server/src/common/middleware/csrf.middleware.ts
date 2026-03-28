import { Injectable, NestMiddleware, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * Double-submit cookie CSRF protection middleware.
 *
 * Strategy:
 * 1. On every request, if no CSRF token cookie exists, generate one and set it
 *    as a non-HttpOnly cookie (so JS can read it).
 * 2. For state-changing requests (POST, PUT, PATCH, DELETE), validate that the
 *    X-CSRF-Token header matches the csrf cookie value.
 *
 * This approach works well with SPAs:
 * - The frontend reads the cookie and sends it as a header.
 * - An attacker on a different origin cannot read the cookie (SameSite + secure).
 *
 * API-key-authenticated requests are exempt (server-to-server communication).
 * Paths that are explicitly public (like OIDC callbacks) can be excluded.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);

  private readonly cookieName: string;
  private readonly headerName: string;
  private readonly isProduction: boolean;
  private readonly enabled: boolean;

  /** Paths that are exempt from CSRF validation. */
  private readonly exemptPaths: string[];

  /** HTTP methods that require CSRF validation. */
  private readonly protectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private readonly config: ConfigService) {
    this.cookieName = this.config.get<string>('security.csrfCookieName', '_csrf');
    this.headerName = this.config.get<string>('security.csrfHeaderName', 'x-csrf-token');
    this.isProduction = this.config.get<string>('nodeEnv') === 'production';
    this.enabled = this.config.get<boolean>('security.csrfEnabled', true);

    // Paths exempt from CSRF (webhooks, OIDC callbacks, health checks)
    this.exemptPaths = [
      '/health',
      '/api/auth/oidc/',
      '/api/v1/', // API-key authenticated routes
    ];
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.enabled) {
      return next();
    }

    // Generate CSRF token cookie if not present
    const existingToken = req.cookies?.[this.cookieName] as string | undefined;
    if (!existingToken) {
      const token = randomBytes(32).toString('hex');
      res.cookie(this.cookieName, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: this.isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge: 86400 * 1000, // 24 hours
      });
    }

    // Only validate state-changing methods
    if (!this.protectedMethods.has(req.method)) {
      return next();
    }

    // Check exemptions
    if (this.isExemptPath(req.path)) {
      return next();
    }

    // Skip CSRF for API-key-authenticated requests
    if (req.headers['x-api-key']) {
      return next();
    }

    // Validate: header token must match cookie token
    const cookieToken = req.cookies?.[this.cookieName] as string | undefined;
    const headerToken = req.headers[this.headerName] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      this.logger.warn(`CSRF validation failed: ${req.method} ${req.path} (IP: ${req.ip})`);
      throw new ForbiddenException({
        statusCode: 403,
        message: 'CSRF token validation failed',
        code: 'CSRF_INVALID',
      });
    }

    next();
  }

  private isExemptPath(path: string): boolean {
    return this.exemptPaths.some((exempt) => path.startsWith(exempt));
  }
}
