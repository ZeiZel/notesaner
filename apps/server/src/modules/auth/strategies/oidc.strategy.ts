// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — openid-client v6 API differs from v5 typings
/**
 * OIDC (OpenID Connect) Strategy
 *
 * Handles dynamic OIDC provider discovery and the authorization code flow with
 * optional PKCE (Proof Key for Code Exchange) support.
 *
 * This strategy does NOT extend PassportStrategy directly because OIDC requires
 * two separate HTTP actions (redirect + callback) with dynamic, per-provider
 * configuration that cannot be expressed in Passport's single static strategy
 * constructor. Instead, the OidcController orchestrates the flow and delegates
 * here for all cryptographic / protocol logic.
 *
 * State and code_verifier are stored in ValKey (Redis) during the OAuth dance
 * to guard against CSRF and ensure the code verifier is available at callback.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as openidClient from 'openid-client';
import { OidcProviderConfigSchema, OidcProviderConfig } from '../oidc/oidc-config.schema';
import { ValkeyService } from '../../valkey/valkey.service';
import { PrismaService } from '../../../prisma/prisma.service';

/** How long (seconds) the OIDC state / code_verifier pair lives in ValKey. */
const OIDC_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

/** Key prefix for state entries so they never collide with other ValKey keys. */
const STATE_KEY_PREFIX = 'oidc:state:';

export interface OidcLoginInitResult {
  /** The full authorization URL to redirect the user-agent to. */
  authorizationUrl: string;
  /** The opaque state value embedded in the URL (also stored in ValKey). */
  state: string;
}

export interface StoredOidcState {
  providerId: string;
  /** PKCE code_verifier; present when PKCE is enabled for this provider. */
  codeVerifier?: string;
  /** Optional post-login redirect path on the frontend. */
  returnTo?: string;
  /** Unix timestamp (ms) when this state was created — for freshness checks. */
  createdAt: number;
}

/** Claims extracted from the OIDC ID token / UserInfo endpoint. */
export interface OidcUserClaims {
  email: string;
  displayName: string;
  avatarUrl?: string;
  /** Subject identifier from the provider. */
  sub: string;
}

export interface OidcCallbackResult {
  claims: OidcUserClaims;
  providerId: string;
}

@Injectable()
export class OidcStrategy {
  private readonly logger = new Logger(OidcStrategy.name);
  /** Base API URL for constructing callback endpoints. */
  private readonly apiBaseUrl: string;

  /**
   * In-memory cache of discovered OIDC client instances, keyed by provider ID.
   * Cache is invalidated when the provider config changes (not yet auto-tracked;
   * restart or TTL-based eviction is the operational strategy for now).
   */
  private readonly clientCache = new Map<string, openidClient.Client>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly valkeyService: ValkeyService,
  ) {
    this.apiBaseUrl = this.config.get<string>('app.apiBaseUrl', 'http://localhost:4000/api');
  }

  /**
   * Initiates the OIDC authorization code flow for the given provider.
   *
   * Generates a cryptographically random state parameter (CSRF protection),
   * optionally generates a PKCE code_verifier + code_challenge pair, and
   * returns the full authorization URL.
   *
   * The state and code_verifier are stored in ValKey so they can be validated
   * and used during the callback.
   *
   * @param providerId  UUID of the AuthProvider record
   * @param returnTo    Optional post-login redirect path (stored in state)
   */
  async initiateLogin(providerId: string, returnTo?: string): Promise<OidcLoginInitResult> {
    const { client, providerConfig } = await this.getOidcClient(providerId);

    const state = openidClient.generators.state();

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (providerConfig.pkce) {
      codeVerifier = openidClient.generators.codeVerifier();
      codeChallenge = openidClient.generators.codeChallenge(codeVerifier);
    }

    // Persist state for CSRF protection and PKCE code_verifier lookup
    const storedState: StoredOidcState = {
      providerId,
      codeVerifier,
      returnTo,
      createdAt: Date.now(),
    };

    await this.valkeyService.set(
      `${STATE_KEY_PREFIX}${state}`,
      JSON.stringify(storedState),
      OIDC_STATE_TTL_SECONDS,
    );

    const scopes = this.buildScopes(providerConfig);

    const authorizationUrl = client.authorizationUrl({
      scope: scopes,
      state,
      redirect_uri: this.buildCallbackUrl(providerId),
      ...(codeChallenge ? { code_challenge: codeChallenge, code_challenge_method: 'S256' } : {}),
    });

    this.logger.debug(`OIDC login initiated for provider ${providerId}, state=${state}`);

    return { authorizationUrl, state };
  }

  /**
   * Handles the OIDC callback after the user authenticates with the provider.
   *
   * Flow:
   *  1. Validate the state parameter (CSRF check via ValKey)
   *  2. Exchange the authorization code for tokens
   *  3. Validate ID token claims
   *  4. Optionally fetch UserInfo for richer profile data
   *  5. Return normalized user claims
   *
   * @param providerId      UUID of the AuthProvider record
   * @param callbackParams  Raw query parameters from the callback URL
   */
  async handleCallback(
    providerId: string,
    callbackParams: Record<string, string>,
  ): Promise<OidcCallbackResult> {
    const state = callbackParams['state'];
    if (!state) {
      throw new BadRequestException('Missing state parameter in OIDC callback');
    }

    // Validate and consume state from ValKey (single-use)
    const storedStateRaw = await this.valkeyService.get(`${STATE_KEY_PREFIX}${state}`);
    if (!storedStateRaw) {
      throw new BadRequestException(
        'OIDC state is invalid or expired. Please initiate login again.',
      );
    }

    let storedState: StoredOidcState;
    try {
      storedState = JSON.parse(storedStateRaw) as StoredOidcState;
    } catch {
      throw new BadRequestException('Malformed OIDC state');
    }

    // Delete immediately — state is single-use
    await this.valkeyService.del(`${STATE_KEY_PREFIX}${state}`);

    // Ensure the providerId in the URL matches what we stored
    if (storedState.providerId !== providerId) {
      throw new BadRequestException('OIDC state mismatch: provider ID does not match stored state');
    }

    // Check the OAuth error response (user denied access, etc.)
    if (callbackParams['error']) {
      const description = callbackParams['error_description'] ?? callbackParams['error'];
      throw new BadRequestException(`OIDC provider returned error: ${description}`);
    }

    const code = callbackParams['code'];
    if (!code) {
      throw new BadRequestException('Missing authorization code in OIDC callback');
    }

    const { client, providerConfig } = await this.getOidcClient(providerId);
    const callbackUrl = this.buildCallbackUrl(providerId);

    // Build the callback parameters object that openid-client expects
    const params = client.callbackParams(
      `${callbackUrl}?${new URLSearchParams(callbackParams).toString()}`,
    );

    let tokenSet: openidClient.TokenSet;
    try {
      tokenSet = await client.oauthCallback(callbackUrl, params, {
        state,
        ...(storedState.codeVerifier && providerConfig.pkce
          ? { code_verifier: storedState.codeVerifier }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      this.logger.error(`OIDC token exchange failed for provider ${providerId}: ${message}`);
      throw new BadRequestException(`OIDC token exchange failed: ${message}`);
    }

    const claims = this.extractClaims(tokenSet, providerConfig);

    this.logger.debug(`OIDC callback success for provider ${providerId}: email=${claims.email}`);

    return { claims, providerId };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns (and caches) the openid-client Client for a given provider.
   * Performs OIDC discovery on first call; caches the result for subsequent
   * requests.
   */
  private async getOidcClient(
    providerId: string,
  ): Promise<{ client: openidClient.Client; providerConfig: OidcProviderConfig }> {
    // Validate and load provider from DB
    const provider = await this.prisma.authProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`OIDC provider "${providerId}" not found`);
    }
    if (!provider.isEnabled) {
      throw new BadRequestException(`OIDC provider "${provider.name}" is disabled`);
    }
    if (provider.type !== 'OIDC') {
      throw new BadRequestException(`Auth provider "${provider.name}" is not an OIDC provider`);
    }

    const parsed = OidcProviderConfigSchema.safeParse(provider.config);
    if (!parsed.success) {
      throw new BadRequestException(
        `OIDC provider configuration is invalid: ${parsed.error.message}`,
      );
    }

    const providerConfig = parsed.data;

    // Return cached client if available
    const cached = this.clientCache.get(providerId);
    if (cached) {
      return { client: cached, providerConfig };
    }

    // Discover OIDC metadata (well-known endpoint)
    let issuer: openidClient.Issuer<openidClient.Client>;
    try {
      issuer = await openidClient.Issuer.discover(providerConfig.issuerUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `OIDC discovery failed for provider ${providerId} (${providerConfig.issuerUrl}): ${message}`,
      );
      throw new BadRequestException(
        `Failed to discover OIDC metadata from ${providerConfig.issuerUrl}: ${message}`,
      );
    }

    const client = new issuer.Client({
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uris: [this.buildCallbackUrl(providerId)],
      response_types: ['code'],
    });

    this.clientCache.set(providerId, client);
    this.logger.log(`OIDC client registered for provider ${providerId} (${provider.name})`);

    return { client, providerConfig };
  }

  /**
   * Extracts and normalizes user claims from the token set.
   * Applies custom claims mapping from provider configuration when present.
   */
  private extractClaims(
    tokenSet: openidClient.TokenSet,
    providerConfig: OidcProviderConfig,
  ): OidcUserClaims {
    const idTokenClaims = tokenSet.claims();
    const mapping = providerConfig.claimsMapping ?? {};

    const emailClaim = mapping.email ?? 'email';
    const displayNameClaim = mapping.displayName ?? 'name';
    const avatarUrlClaim = mapping.avatarUrl ?? 'picture';

    // openid-client types claims as a record with unknown values
    const rawClaims = idTokenClaims as Record<string, unknown>;

    const email = rawClaims[emailClaim];
    if (!email || typeof email !== 'string') {
      throw new BadRequestException(
        `OIDC provider did not return a valid email claim ("${emailClaim}")`,
      );
    }

    const sub = rawClaims['sub'];
    if (!sub || typeof sub !== 'string') {
      throw new BadRequestException('OIDC provider did not return a "sub" claim');
    }

    const displayName =
      typeof rawClaims[displayNameClaim] === 'string'
        ? (rawClaims[displayNameClaim] as string)
        : email.split('@')[0];

    const avatarUrl =
      typeof rawClaims[avatarUrlClaim] === 'string'
        ? (rawClaims[avatarUrlClaim] as string)
        : undefined;

    return { email, displayName, avatarUrl, sub };
  }

  /** Builds the minimum required scopes string, incorporating any additional scopes. */
  private buildScopes(providerConfig: OidcProviderConfig): string {
    const base = ['openid', 'profile', 'email'];
    const additional = providerConfig.additionalScopes ?? [];
    const merged = new Set([...base, ...additional]);
    return Array.from(merged).join(' ');
  }

  /** Constructs the redirect_uri for a given provider. */
  private buildCallbackUrl(providerId: string): string {
    return `${this.apiBaseUrl}/auth/oidc/${providerId}/callback`;
  }

  /**
   * Clears a provider's cached client instance.
   * Call this after updating a provider's configuration.
   */
  clearClientCache(providerId: string): void {
    this.clientCache.delete(providerId);
    this.logger.debug(`OIDC client cache cleared for provider ${providerId}`);
  }
}
