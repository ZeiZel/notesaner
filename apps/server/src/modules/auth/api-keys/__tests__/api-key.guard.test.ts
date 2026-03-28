import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  UserApiKeyGuard,
  USER_API_KEY_CONTEXT,
  getUserApiKey,
  isApiKeyAuth,
} from '../api-key.guard';
import { UserApiKeyService } from '../api-key.service';
import { UserApiKeyScope } from '../dto/create-api-key.dto';
import type { ValidatedUserApiKey } from '../api-key.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValidatedKey(overrides: Partial<ValidatedUserApiKey> = {}): ValidatedUserApiKey {
  return {
    id: 'key-uuid-1',
    userId: 'user-uuid-1',
    scopes: [UserApiKeyScope.READ],
    ...overrides,
  };
}

function makeMockApiKeyService() {
  return {
    validate: vi.fn(),
    checkRateLimit: vi.fn().mockResolvedValue(true),
    assertScope: vi.fn(),
  };
}

function makeMockReflector() {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(undefined),
  };
}

function makeMockExecutionContext(
  headers: Record<string, string | string[] | undefined> = {},
): ExecutionContext {
  const request: Record<string | symbol, unknown> = {
    headers,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UserApiKeyGuard', () => {
  let guard: UserApiKeyGuard;
  let apiKeyService: ReturnType<typeof makeMockApiKeyService>;
  let reflector: ReturnType<typeof makeMockReflector>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyService = makeMockApiKeyService();
    reflector = makeMockReflector();
    guard = new UserApiKeyGuard(
      apiKeyService as unknown as UserApiKeyService,
      reflector as unknown as Reflector,
    );
  });

  // ── Authorization: Bearer nts_xxx ─────────────────────────────────────────

  describe('Authorization: Bearer nts_xxx header', () => {
    it('should authenticate via Bearer token with nts_ prefix', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyService.validate).toHaveBeenCalledWith(rawKey);
    });

    it('should return false for Bearer token without nts_ prefix', async () => {
      const ctx = makeMockExecutionContext({
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.some.jwt',
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(apiKeyService.validate).not.toHaveBeenCalled();
    });

    it('should populate request.user for @CurrentUser() compatibility', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey({ userId: 'user-42' });
      apiKeyService.validate.mockResolvedValue(validatedKey);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
      expect(request['user']).toEqual({
        sub: 'user-42',
        email: '',
        isSuperAdmin: false,
        sessionId: 'apikey:key-uuid-1',
      });
    });

    it('should attach validated key to request via symbol', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      const request = ctx.switchToHttp().getRequest<Record<symbol, unknown>>();
      expect(request[USER_API_KEY_CONTEXT]).toBe(validatedKey);
    });
  });

  // ── X-API-Key header ──────────────────────────────────────────────────────

  describe('X-API-Key header', () => {
    it('should authenticate via X-API-Key header', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);

      const ctx = makeMockExecutionContext({ 'x-api-key': rawKey });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyService.validate).toHaveBeenCalledWith(rawKey);
    });

    it('should ignore X-API-Key that does not start with nts_', async () => {
      const ctx = makeMockExecutionContext({ 'x-api-key': 'invalid_key_format' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(false);
      expect(apiKeyService.validate).not.toHaveBeenCalled();
    });

    it('should prefer Authorization header over X-API-Key', async () => {
      const bearerKey = 'nts_BEARER_KEY_123456789012345678901234';
      const xApiKey = 'nts_XAPI_KEY_1234567890123456789012345';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);

      const ctx = makeMockExecutionContext({
        authorization: `Bearer ${bearerKey}`,
        'x-api-key': xApiKey,
      });
      await guard.canActivate(ctx);

      expect(apiKeyService.validate).toHaveBeenCalledWith(bearerKey);
    });
  });

  // ── No API key present ────────────────────────────────────────────────────

  describe('no API key present', () => {
    it('should return false when no relevant headers are set', async () => {
      const ctx = makeMockExecutionContext({});
      const result = await guard.canActivate(ctx);

      expect(result).toBe(false);
    });

    it('should return false for empty headers', async () => {
      const ctx = makeMockExecutionContext({ authorization: '', 'x-api-key': '' });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(false);
    });
  });

  // ── Validation failures ───────────────────────────────────────────────────

  describe('validation failures', () => {
    it('should throw UnauthorizedException for invalid key', async () => {
      const rawKey = 'nts_invalid_key_that_does_not_exist_in_db';
      apiKeyService.validate.mockRejectedValue(
        new UnauthorizedException('Invalid or revoked API key'),
      );

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired key', async () => {
      const rawKey = 'nts_expired_key_value_12345678901234567890';
      apiKeyService.validate.mockRejectedValue(new UnauthorizedException('API key has expired'));

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('should throw 429 when rate limit is exceeded', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);
      apiKeyService.checkRateLimit.mockResolvedValue(false);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });

      try {
        await guard.canActivate(ctx);
        expect.fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should allow request when under rate limit', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);
      apiKeyService.checkRateLimit.mockResolvedValue(true);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ── @RequireScopes() ──────────────────────────────────────────────────────

  describe('@RequireScopes() enforcement', () => {
    it('should check required scopes from decorator metadata', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey({ scopes: [UserApiKeyScope.READ] });
      apiKeyService.validate.mockResolvedValue(validatedKey);
      reflector.getAllAndOverride.mockReturnValue([UserApiKeyScope.READ]);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      expect(apiKeyService.assertScope).toHaveBeenCalledWith(validatedKey, UserApiKeyScope.READ);
    });

    it('should check all required scopes', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey({
        scopes: [UserApiKeyScope.READ, UserApiKeyScope.WRITE],
      });
      apiKeyService.validate.mockResolvedValue(validatedKey);
      reflector.getAllAndOverride.mockReturnValue([UserApiKeyScope.READ, UserApiKeyScope.WRITE]);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      expect(apiKeyService.assertScope).toHaveBeenCalledTimes(2);
      expect(apiKeyService.assertScope).toHaveBeenCalledWith(validatedKey, UserApiKeyScope.READ);
      expect(apiKeyService.assertScope).toHaveBeenCalledWith(validatedKey, UserApiKeyScope.WRITE);
    });

    it('should throw ForbiddenException when scope is missing', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey({ scopes: [UserApiKeyScope.READ] });
      apiKeyService.validate.mockResolvedValue(validatedKey);
      reflector.getAllAndOverride.mockReturnValue([UserApiKeyScope.WRITE]);
      apiKeyService.assertScope.mockImplementation(() => {
        throw new ForbiddenException('API key does not have the required scope: write');
      });

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should skip scope check when no @RequireScopes() is set', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      expect(apiKeyService.assertScope).not.toHaveBeenCalled();
    });

    it('should skip scope check when empty scopes array', async () => {
      const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';
      const validatedKey = makeValidatedKey();
      apiKeyService.validate.mockResolvedValue(validatedKey);
      reflector.getAllAndOverride.mockReturnValue([]);

      const ctx = makeMockExecutionContext({ authorization: `Bearer ${rawKey}` });
      await guard.canActivate(ctx);

      expect(apiKeyService.assertScope).not.toHaveBeenCalled();
    });
  });
});

// ─── Helper function tests ──────────────────────────────────────────────────

describe('getUserApiKey', () => {
  it('should return the validated key from the request', () => {
    const validatedKey = makeValidatedKey();
    const request = { [USER_API_KEY_CONTEXT]: validatedKey } as Record<symbol, unknown>;

    const result = getUserApiKey(request as never);
    expect(result).toBe(validatedKey);
  });

  it('should throw if guard did not run', () => {
    const request = {} as Record<symbol, unknown>;
    expect(() => getUserApiKey(request as never)).toThrow(
      'UserApiKeyGuard must run before accessing user API key context',
    );
  });
});

describe('isApiKeyAuth', () => {
  it('should return true when API key context is present', () => {
    const request = { [USER_API_KEY_CONTEXT]: makeValidatedKey() } as Record<symbol, unknown>;
    expect(isApiKeyAuth(request as never)).toBe(true);
  });

  it('should return false when no API key context', () => {
    const request = {} as Record<symbol, unknown>;
    expect(isApiKeyAuth(request as never)).toBe(false);
  });
});
