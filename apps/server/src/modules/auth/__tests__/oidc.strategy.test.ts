/**
 * Unit tests for OidcStrategy
 *
 * Tests are isolated from external services using vi.mock() to replace
 * openid-client, PrismaService, ConfigService and ValkeyService.
 *
 * Note: vi.mock() is hoisted to the top of the file by Vitest, so the mock
 * factory must not reference module-level variables defined after the call.
 * We use module-scoped vi.fn() instances that are populated via
 * mockImplementation in beforeEach instead.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock openid-client — factory MUST be self-contained (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('openid-client', () => {
  const generators = {
    state: vi.fn(() => 'mock-state-abc123'),
    codeVerifier: vi.fn(() => 'mock-code-verifier'),
    codeChallenge: vi.fn(() => 'mock-code-challenge'),
  };

  // The client instance that will be returned by `new issuer.Client()`
  const mockClientInstance = {
    authorizationUrl: vi.fn(
      () => 'https://provider.example.com/auth?client_id=test&state=mock-state-abc123',
    ),
    callbackParams: vi.fn((_url: string) => ({
      state: 'mock-state-abc123',
      code: 'auth-code',
    })),
    oauthCallback: vi.fn(),
  };

  // ClientConstructor must be a function that can be called with `new`
  function ClientConstructor(_opts: unknown) {
    // Return the shared mock instance regardless of options
    return mockClientInstance;
  }

  const issuerInstance = { Client: ClientConstructor };

  const IssuerMock = {
    discover: vi.fn().mockResolvedValue(issuerInstance),
  };

  return {
    generators,
    Issuer: IssuerMock,
    // Expose inner mocks so tests can access them via the import
    __mockClientInstance: mockClientInstance,
    __generators: generators,
    __IssuerMock: IssuerMock,
  };
});

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

import * as openidClient from 'openid-client';
import { OidcStrategy } from '../strategies/oidc.strategy';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ValkeyService } from '../../valkey/valkey.service';
import type { ConfigService } from '@nestjs/config';

// Access exposed internal mocks (safe after vi.mock has been hoisted)

const mocks = openidClient as any;
const mockClient = mocks.__mockClientInstance as {
  authorizationUrl: ReturnType<typeof vi.fn>;
  callbackParams: ReturnType<typeof vi.fn>;
  oauthCallback: ReturnType<typeof vi.fn>;
};
const generators = mocks.__generators as {
  state: ReturnType<typeof vi.fn>;
  codeVerifier: ReturnType<typeof vi.fn>;
  codeChallenge: ReturnType<typeof vi.fn>;
};
const IssuerMock = mocks.__IssuerMock as {
  discover: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'provider-uuid-1',
    name: 'Test OIDC',
    type: 'OIDC',
    isEnabled: true,
    config: {
      issuerUrl: 'https://provider.example.com',
      clientId: 'my-client',
      clientSecret: 'my-secret',
      pkce: true,
    },
    ...overrides,
  };
}

function makeTokenSet(claimsOverride: Record<string, unknown> = {}) {
  return {
    claims: () => ({
      sub: 'user-sub-123',
      email: 'alice@example.com',
      name: 'Alice Smith',
      picture: 'https://example.com/avatar.png',
      ...claimsOverride,
    }),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function buildStrategy() {
  const prisma = {
    authProvider: {
      findUnique: vi.fn().mockResolvedValue(makeProvider()),
    },
  } as unknown as PrismaService;

  const config = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'app.apiBaseUrl') return 'http://localhost:4000/api';
      return defaultValue;
    }),
  } as unknown as ConfigService;

  const valkey = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(
      JSON.stringify({
        providerId: 'provider-uuid-1',
        codeVerifier: 'mock-code-verifier',
        returnTo: '/workspace',
        createdAt: Date.now(),
      }),
    ),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as ValkeyService;

  const strategy = new OidcStrategy(prisma, config, valkey);

  return { strategy, prisma, config, valkey };
}

// ---------------------------------------------------------------------------
// Tests: initiateLogin
// ---------------------------------------------------------------------------

/** Restores the standard Issuer.discover mock that returns a usable client. */
function resetDiscoverMock() {
  const innerMocks = openidClient as any;
  const clientInstance = innerMocks.__mockClientInstance;
  function ClientCtor(_opts: unknown) {
    return clientInstance;
  }
  IssuerMock.discover.mockResolvedValue({ Client: ClientCtor });
}

describe('OidcStrategy.initiateLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generators.state.mockReturnValue('mock-state-abc123');
    generators.codeVerifier.mockReturnValue('mock-code-verifier');
    generators.codeChallenge.mockReturnValue('mock-code-challenge');
    mockClient.authorizationUrl.mockReturnValue(
      'https://provider.example.com/auth?state=mock-state-abc123',
    );
    resetDiscoverMock();
  });

  it('returns authorizationUrl and state on success', async () => {
    const { strategy, valkey } = buildStrategy();

    const result = await strategy.initiateLogin('provider-uuid-1', '/dashboard');

    expect(result.state).toBe('mock-state-abc123');
    expect(result.authorizationUrl).toContain('https://provider.example.com');

    expect(valkey.set).toHaveBeenCalledWith(
      'oidc:state:mock-state-abc123',
      expect.stringContaining('"providerId":"provider-uuid-1"'),
      600,
    );
  });

  it('stores returnTo in ValKey state', async () => {
    const { strategy, valkey } = buildStrategy();

    await strategy.initiateLogin('provider-uuid-1', '/notes/my-note');

    const setCall = (valkey.set as ReturnType<typeof vi.fn>).mock.calls[0];
    const stored = JSON.parse(setCall[1] as string) as { returnTo: string };
    expect(stored.returnTo).toBe('/notes/my-note');
  });

  it('throws NotFoundException for unknown provider', async () => {
    const { strategy, prisma } = buildStrategy();
    (prisma.authProvider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(strategy.initiateLogin('nonexistent-id')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for disabled provider', async () => {
    const { strategy, prisma } = buildStrategy();
    (prisma.authProvider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeProvider({ isEnabled: false }),
    );

    await expect(strategy.initiateLogin('provider-uuid-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for wrong provider type', async () => {
    const { strategy, prisma } = buildStrategy();
    (prisma.authProvider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeProvider({ type: 'SAML' }),
    );

    await expect(strategy.initiateLogin('provider-uuid-1')).rejects.toThrow(BadRequestException);
  });

  it('includes PKCE code_challenge in authorization URL when pkce=true', async () => {
    const { strategy } = buildStrategy();

    await strategy.initiateLogin('provider-uuid-1');

    expect(mockClient.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        code_challenge: 'mock-code-challenge',
        code_challenge_method: 'S256',
      }),
    );
  });

  it('does NOT include PKCE when pkce=false', async () => {
    const { strategy, prisma } = buildStrategy();
    (prisma.authProvider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeProvider({
        config: {
          issuerUrl: 'https://provider.example.com',
          clientId: 'c',
          pkce: false,
        },
      }),
    );

    await strategy.initiateLogin('provider-uuid-1');

    expect(mockClient.authorizationUrl).toHaveBeenCalledWith(
      expect.not.objectContaining({ code_challenge: expect.anything() }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: handleCallback
// ---------------------------------------------------------------------------

describe('OidcStrategy.handleCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.callbackParams.mockReturnValue({ state: 'mock-state-abc123', code: 'auth-code' });
    mockClient.oauthCallback.mockResolvedValue(makeTokenSet());
    resetDiscoverMock();
  });

  it('returns normalized claims on success', async () => {
    const { strategy } = buildStrategy();

    const result = await strategy.handleCallback('provider-uuid-1', {
      code: 'auth-code',
      state: 'mock-state-abc123',
    });

    expect(result.claims.email).toBe('alice@example.com');
    expect(result.claims.displayName).toBe('Alice Smith');
    expect(result.claims.avatarUrl).toBe('https://example.com/avatar.png');
    expect(result.claims.sub).toBe('user-sub-123');
    expect(result.providerId).toBe('provider-uuid-1');
  });

  it('deletes ValKey state after consuming it (single-use)', async () => {
    const { strategy, valkey } = buildStrategy();

    await strategy.handleCallback('provider-uuid-1', {
      code: 'auth-code',
      state: 'mock-state-abc123',
    });

    expect(valkey.del).toHaveBeenCalledWith('oidc:state:mock-state-abc123');
  });

  it('throws BadRequestException when state parameter is missing', async () => {
    const { strategy } = buildStrategy();

    await expect(strategy.handleCallback('provider-uuid-1', { code: 'auth-code' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when state is not found in ValKey (expired)', async () => {
    const { strategy, valkey } = buildStrategy();
    (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      strategy.handleCallback('provider-uuid-1', { code: 'auth-code', state: 'stale-state' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when provider ID in URL mismatches state', async () => {
    const { strategy, valkey } = buildStrategy();
    (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        providerId: 'different-provider',
        codeVerifier: undefined,
        createdAt: Date.now(),
      }),
    );

    await expect(
      strategy.handleCallback('provider-uuid-1', {
        code: 'auth-code',
        state: 'mock-state-abc123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when OAuth error is returned', async () => {
    const { strategy } = buildStrategy();

    await expect(
      strategy.handleCallback('provider-uuid-1', {
        error: 'access_denied',
        error_description: 'User denied access',
        state: 'mock-state-abc123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when token exchange fails', async () => {
    const { strategy } = buildStrategy();
    mockClient.oauthCallback.mockRejectedValue(new Error('invalid_grant'));

    await expect(
      strategy.handleCallback('provider-uuid-1', { code: 'bad-code', state: 'mock-state-abc123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when email claim is missing', async () => {
    const { strategy } = buildStrategy();
    mockClient.oauthCallback.mockResolvedValue(makeTokenSet({ email: undefined }));

    await expect(
      strategy.handleCallback('provider-uuid-1', {
        code: 'auth-code',
        state: 'mock-state-abc123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('falls back displayName to email prefix when name claim absent', async () => {
    const { strategy } = buildStrategy();
    mockClient.oauthCallback.mockResolvedValue(makeTokenSet({ name: undefined }));

    const result = await strategy.handleCallback('provider-uuid-1', {
      code: 'auth-code',
      state: 'mock-state-abc123',
    });

    expect(result.claims.displayName).toBe('alice'); // 'alice@example.com'.split('@')[0]
  });
});

// ---------------------------------------------------------------------------
// Tests: clearClientCache
// ---------------------------------------------------------------------------

describe('OidcStrategy.clearClientCache', () => {
  it('removes a cached client without throwing', () => {
    const { strategy } = buildStrategy();
    // Should not throw even if nothing is cached
    expect(() => strategy.clearClientCache('provider-uuid-1')).not.toThrow();
  });
});
