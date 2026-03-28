import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { UserApiKeyService, ValidatedUserApiKey } from './api-key.service';

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
 * UserApiKeyGuard -- extracts the `X-API-Key` header, validates the key
 * against the database, enforces per-key rate limiting, and attaches
 * the resolved context to the request.
 *
 * This guard is designed for user-scoped API keys (nts_ prefix), distinct
 * from the workspace-scoped API keys in the api-v1 module (nsk_ prefix).
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

  constructor(private readonly apiKeyService: UserApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUserApiKey>();
    const rawKey = this.extractKey(request);

    if (!rawKey) {
      throw new UnauthorizedException('X-API-Key header is required');
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

  private extractKey(request: Request): string | undefined {
    const header = request.headers['x-api-key'];
    if (Array.isArray(header)) {
      return header[0];
    }
    return header as string | undefined;
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
