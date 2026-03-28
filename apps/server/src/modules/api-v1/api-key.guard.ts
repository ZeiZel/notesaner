import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService, ValidatedApiKey } from './api-key.service';

/**
 * Symbol used to attach the validated API key context to the request object.
 * Using a symbol avoids collisions with other request properties.
 */
export const API_KEY_CONTEXT = Symbol('apiKeyContext');

export interface RequestWithApiKey extends Request {
  [API_KEY_CONTEXT]?: ValidatedApiKey;
}

/**
 * ApiKeyGuard — extracts the `X-API-Key` header value, validates it against
 * the database, and attaches the resolved `ValidatedApiKey` to the request
 * object for downstream use.
 *
 * Route handlers can read the context via:
 *   request[API_KEY_CONTEXT]
 *
 * This guard does NOT check individual permissions — use
 * `ApiKeyService.assertPermission()` inside the controller for that.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const rawKey = this.extractKey(request);

    if (!rawKey) {
      throw new UnauthorizedException('X-API-Key header is required');
    }

    // validate() throws UnauthorizedException on failure
    const apiKey = await this.apiKeyService.validate(rawKey);
    request[API_KEY_CONTEXT] = apiKey;

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

/**
 * Extracts the validated API key from the request.
 * Throws if the guard did not run (programmer error).
 */
export function getApiKey(req: RequestWithApiKey): ValidatedApiKey {
  const key = req[API_KEY_CONTEXT];
  if (!key) {
    throw new Error('ApiKeyGuard must run before accessing API key context');
  }
  return key;
}
