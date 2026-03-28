import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserApiKeyService, ValidatedUserApiKey } from './api-key.service';
import { REQUIRE_SCOPES_KEY } from './decorators/require-scopes.decorator';
import type { UserApiKeyScope } from './dto/create-api-key.dto';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Prefix that identifies user-scoped API keys. */
const API_KEY_PREFIX = 'nts_';

// ─── Request Extension ──────────────────────────────────────────────────────

/**
 * Symbol used to attach the validated user API key context to the request.
 * Using a symbol avoids collisions with the JWT `request.user` property.
 */
export const USER_API_KEY_CONTEXT = Symbol('userApiKeyContext');

export interface RequestWithUserApiKey extends Request {
  [USER_API_KEY_CONTEXT]?: ValidatedUserApiKey;
  /** Populated to match the JwtPayload shape expected by downstream guards/decorators. */
  user?: { sub: string; email: string; isSuperAdmin: boolean; sessionId: string };
}

// ─── Guard ──────────────────────────────────────────────────────────────────

/**
 * UserApiKeyGuard -- checks the `Authorization: Bearer nts_xxx` header or
 * the `X-API-Key` header, validates the key against the database, enforces
 * per-key rate limiting, and attaches the resolved context to the request.
 *
 * This guard supports two authentication methods:
 *   1. `Authorization: Bearer nts_xxx` -- preferred for API key auth
 *   2. `X-API-Key: nts_xxx` -- legacy / alternative header
 *
 * When the Authorization header contains a Bearer token that does NOT start
 * with the `nts_` prefix, the guard returns false (allowing the JWT guard
 * to handle it instead).
 *
 * Usage:
 * ```ts
 * @UseGuards(UserApiKeyGuard)
 * @Controller('api/keys')
 * export class SomeController { ... }
 * ```
 *
 * Downstream code can retrieve the validated key via:
 * ```ts
 * const apiKey = getUserApiKey(request);
 * ```
 */
@Injectable()
export class UserApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(UserApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: UserApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUserApiKey>();
    const rawKey = this.extractKey(request);

    if (!rawKey) {
      // No API key found -- let downstream guards handle auth
      return false;
    }

    // Validate the key (throws on failure)
    const apiKey = await this.apiKeyService.validate(rawKey);

    // Per-key rate limiting
    const allowed = await this.apiKeyService.checkRateLimit(apiKey.id);
    if (!allowed) {
      this.logger.warn(`Rate limit exceeded for API key ${apiKey.id}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'API key rate limit exceeded. Try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check required scopes via @RequireScopes() metadata
    const requiredScopes = this.reflector.getAllAndOverride<UserApiKeyScope[] | undefined>(
      REQUIRE_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredScopes && requiredScopes.length > 0) {
      for (const scope of requiredScopes) {
        this.apiKeyService.assertScope(apiKey, scope);
      }
    }

    // Attach the validated key context
    request[USER_API_KEY_CONTEXT] = apiKey;

    // Also populate request.user for compatibility with @CurrentUser() decorator
    // and downstream guards that check user identity.
    request.user = {
      sub: apiKey.userId,
      email: '',
      isSuperAdmin: false,
      sessionId: `apikey:${apiKey.id}`,
    };

    return true;
  }

  /**
   * Extracts an API key from the request headers.
   *
   * Priority:
   *   1. `Authorization: Bearer nts_xxx` -- if the Bearer token starts with nts_
   *   2. `X-API-Key: nts_xxx` -- fallback header
   *
   * Returns undefined if no API key is found in either header.
   */
  private extractKey(request: Request): string | undefined {
    // 1. Check Authorization: Bearer nts_xxx
    const authHeader = request.headers['authorization'];
    if (authHeader) {
      const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (headerValue?.startsWith('Bearer ')) {
        const token = headerValue.slice(7);
        if (token.startsWith(API_KEY_PREFIX)) {
          return token;
        }
        // Bearer token without nts_ prefix -- not an API key, skip
        return undefined;
      }
    }

    // 2. Check X-API-Key header
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
      const headerValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
      if (headerValue?.startsWith(API_KEY_PREFIX)) {
        return headerValue;
      }
    }

    return undefined;
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extracts the validated user API key from the request.
 * Throws if the guard did not run (programmer error).
 */
export function getUserApiKey(req: RequestWithUserApiKey): ValidatedUserApiKey {
  const key = req[USER_API_KEY_CONTEXT];
  if (!key) {
    throw new Error('UserApiKeyGuard must run before accessing user API key context');
  }
  return key;
}

/**
 * Checks whether the current request was authenticated via an API key.
 */
export function isApiKeyAuth(req: RequestWithUserApiKey): boolean {
  return req[USER_API_KEY_CONTEXT] !== undefined;
}
