import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyOrJwtGuard } from '../api-key-or-jwt.guard';
import { UserApiKeyGuard } from '../api-key.guard';
import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockReflector() {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(false),
  };
}

function makeMockApiKeyGuard() {
  return {
    canActivate: vi.fn(),
  };
}

function makeMockExecutionContext(
  headers: Record<string, string | undefined> = {},
): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  const handler = vi.fn();
  const klass = vi.fn();

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => klass,
  } as unknown as ExecutionContext;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ApiKeyOrJwtGuard', () => {
  let guard: ApiKeyOrJwtGuard;
  let reflector: ReturnType<typeof makeMockReflector>;
  let apiKeyGuard: ReturnType<typeof makeMockApiKeyGuard>;

  beforeEach(() => {
    vi.clearAllMocks();
    reflector = makeMockReflector();
    apiKeyGuard = makeMockApiKeyGuard();

    guard = new ApiKeyOrJwtGuard(
      reflector as unknown as Reflector,
      apiKeyGuard as unknown as UserApiKeyGuard,
    );

    // Mock the parent class (AuthGuard('jwt')) canActivate
    // since we cannot actually instantiate Passport in unit tests.
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate').mockResolvedValue(
      true,
    );
  });

  // ── @Public() routes ──────────────────────────────────────────────────────

  describe('@Public() routes', () => {
    it('should allow access to public routes without any auth', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = makeMockExecutionContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should check IS_PUBLIC_KEY metadata', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = makeMockExecutionContext();

      await guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
    });
  });

  // ── API key auth ──────────────────────────────────────────────────────────

  describe('API key authentication', () => {
    it('should authenticate via API key when guard returns true', async () => {
      apiKeyGuard.canActivate.mockResolvedValue(true);
      const ctx = makeMockExecutionContext({ authorization: 'Bearer nts_key123' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(apiKeyGuard.canActivate).toHaveBeenCalledWith(ctx);
    });

    it('should propagate API key errors when nts_ token is in Authorization header', async () => {
      apiKeyGuard.canActivate.mockRejectedValue(
        new UnauthorizedException('Invalid or revoked API key'),
      );
      const ctx = makeMockExecutionContext({ authorization: 'Bearer nts_invalid_key' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should propagate API key errors when X-API-Key header is present', async () => {
      apiKeyGuard.canActivate.mockRejectedValue(
        new UnauthorizedException('Invalid or revoked API key'),
      );
      const ctx = makeMockExecutionContext({ 'x-api-key': 'nts_invalid_key' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── JWT fallback ──────────────────────────────────────────────────────────

  describe('JWT fallback', () => {
    it('should fall back to JWT when API key guard returns false', async () => {
      apiKeyGuard.canActivate.mockResolvedValue(false);
      const parentCanActivate = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivate.mockResolvedValue(true);

      const ctx = makeMockExecutionContext({ authorization: 'Bearer eyJhbGciOiJI...' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should fall back to JWT when API key guard throws but no nts_ key in headers', async () => {
      apiKeyGuard.canActivate.mockRejectedValue(new Error('Unexpected error'));
      const parentCanActivate = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivate.mockResolvedValue(true);

      const ctx = makeMockExecutionContext({ authorization: 'Bearer eyJhbGciOiJI...' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ── Priority order ────────────────────────────────────────────────────────

  describe('priority order', () => {
    it('should try API key before JWT', async () => {
      const callOrder: string[] = [];

      apiKeyGuard.canActivate.mockImplementation(async () => {
        callOrder.push('apikey');
        return true;
      });

      const parentCanActivate = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      parentCanActivate.mockImplementation(async () => {
        callOrder.push('jwt');
        return true;
      });

      const ctx = makeMockExecutionContext({ authorization: 'Bearer nts_key123' });
      await guard.canActivate(ctx);

      expect(callOrder).toEqual(['apikey']);
      // JWT should NOT be called since API key succeeded
    });
  });
});
