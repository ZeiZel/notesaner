/**
 * OIDC Controller
 *
 * Handles the two OIDC SP endpoints:
 *   GET /auth/oidc/:providerId          — initiate authorization code flow
 *   GET /auth/oidc/:providerId/callback — code exchange + token issuance
 *
 * Flow:
 *  1. Client calls GET /auth/oidc/:providerId (optionally with ?returnTo=/path)
 *  2. Server generates state, stores state + code_verifier in ValKey, redirects to IdP
 *  3. IdP redirects back to GET /auth/oidc/:providerId/callback with code + state
 *  4. Server validates state (CSRF), exchanges code for tokens, provisions user
 *  5. Server issues app JWT + refresh token, redirects frontend with access token in hash
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OidcStrategy } from './strategies/oidc.strategy';
import { AuthService } from './auth.service';

@Public()
@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidcStrategy: OidcStrategy,
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /auth/oidc/:providerId
   *
   * Initiates the OIDC authorization code flow. Generates state and optional
   * PKCE parameters, stores them in ValKey, then redirects to the IdP.
   *
   * Query params:
   *   returnTo  — optional relative path to redirect to after login
   */
  @Get(':providerId')
  async initiateLogin(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { authorizationUrl } = await this.oidcStrategy.initiateLogin(
      providerId,
      typeof returnTo === 'string' ? returnTo : undefined,
    );

    res.redirect(HttpStatus.FOUND, authorizationUrl);
  }

  /**
   * GET /auth/oidc/:providerId/callback
   *
   * OIDC redirect callback endpoint.
   * The IdP redirects here after the user authenticates.
   *
   * Flow:
   *  1. Validate state (CSRF) — stored in ValKey
   *  2. Exchange authorization code for tokens (with PKCE if configured)
   *  3. Extract user claims from ID token
   *  4. Find or provision the user in our database
   *  5. Issue JWT access token + refresh token
   *  6. Redirect frontend with access token in URL fragment
   */
  @Get(':providerId/callback')
  async handleCallback(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Collect all query parameters — openid-client needs them for callback validation
    const rawQuery = req.query as Record<string, string>;

    // Check for IdP-level error before proceeding
    if (rawQuery['error']) {
      const description = rawQuery['error_description'] ?? rawQuery['error'];
      throw new BadRequestException(`OIDC provider returned error: ${description}`);
    }

    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const { claims, providerId: validatedProviderId } = await this.oidcStrategy.handleCallback(
      providerId,
      rawQuery,
    );

    // loginOrProvisionOidcUser finds existing user by email or creates a new one
    const authResult = await this.authService.loginOrProvisionOidcUser(
      {
        email: claims.email,
        displayName: claims.displayName,
        avatarUrl: claims.avatarUrl,
        providerId: validatedProviderId,
        sub: claims.sub,
      },
      meta,
    );

    // Set refresh token in an httpOnly cookie (same pattern as SAML / local auth)
    res.cookie('refresh_token', authResult.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });

    // Retrieve returnTo from auth result (passed through via state → strategy → service)
    const returnTo = authResult.returnTo ?? '/';
    const safeReturnTo = sanitizeReturnTo(returnTo);
    const frontendUrl = this.buildFrontendRedirectUrl(
      safeReturnTo,
      authResult.accessToken,
      authResult.expiresIn,
    );

    res.redirect(HttpStatus.FOUND, frontendUrl);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildFrontendRedirectUrl(
    returnTo: string,
    accessToken: string,
    expiresIn: number,
  ): string {
    const frontendBase =
      process.env['FRONTEND_URL'] ?? process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3001';

    const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
    const hash = `access_token=${encodeURIComponent(accessToken)}&expires_in=${expiresIn}`;

    return `${frontendBase}${path}#${hash}`;
  }
}

/**
 * Ensures the returnTo URL is a relative path on the same origin.
 * Prevents open redirect attacks.
 */
function sanitizeReturnTo(returnTo: string): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return '/';
  }
  // Reject protocol-relative URLs like //evil.com
  if (returnTo.startsWith('//')) {
    return '/';
  }
  try {
    const url = new URL(returnTo, 'http://localhost');
    return url.pathname;
  } catch {
    return '/';
  }
}
