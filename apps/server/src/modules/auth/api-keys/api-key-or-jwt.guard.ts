import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { UserApiKeyGuard } from './api-key.guard';

/**
 * Combined guard that tries API key authentication first, then falls back to JWT.
 *
 * Execution order:
 *   1. Check if route is marked @Public() -- if so, allow access
 *   2. Try UserApiKeyGuard (checks Authorization: Bearer nts_xxx or X-API-Key header)
 *   3. If API key guard returns false (no API key found), fall back to JWT guard
 *   4. If API key guard throws (invalid/expired/revoked key), propagate the error
 *
 * This guard should be registered as a global APP_GUARD to provide unified
 * authentication across all routes.
 *
 * @example
 * // In app.module.ts:
 * {
 *   provide: APP_GUARD,
 *   useClass: ApiKeyOrJwtGuard,
 * }
 */
@Injectable()
export class ApiKeyOrJwtGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyGuard: UserApiKeyGuard,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check @Public() metadata -- skip all auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Try API key authentication first
    try {
      const apiKeyResult = await this.apiKeyGuard.canActivate(context);
      if (apiKeyResult) {
        // Authenticated via API key
        return true;
      }
    } catch (error) {
      // If the API key guard threw an error (invalid key, rate limited, etc.),
      // we need to check if it was because an API key was actually provided
      // but was invalid. In that case, propagate the error rather than
      // falling through to JWT.
      const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
      const authHeader = request.headers['authorization'];
      const apiKeyHeader = request.headers['x-api-key'];

      // If an API key was explicitly provided (via either header), propagate the error
      const hasApiKeyInAuth = authHeader?.startsWith('Bearer nts_');
      const hasApiKeyHeader = apiKeyHeader?.startsWith('nts_');

      if (hasApiKeyInAuth || hasApiKeyHeader) {
        throw error;
      }

      // Otherwise, fall through to JWT
    }

    // 3. Fall back to JWT authentication
    return super.canActivate(context) as Promise<boolean>;
  }
}
