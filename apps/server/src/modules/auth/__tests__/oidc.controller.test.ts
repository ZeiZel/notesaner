/**
 * Unit tests for OidcController
 *
 * Tests the HTTP-level behavior: redirect to IdP, redirect back to frontend,
 * cookie issuance, and error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OidcController } from '../oidc.controller';
import type { OidcStrategy } from '../strategies/oidc.strategy';
import type { AuthService } from '../auth.service';
import type { Response, Request } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    redirect: vi.fn(),
    cookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(queryOverrides: Record<string, string> = {}) {
  return {
    query: { state: 'test-state', code: 'auth-code', ...queryOverrides },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  } as unknown as Request;
}

const mockInitiateLogin = vi.fn();
const mockHandleCallback = vi.fn();

const mockOidcStrategy = {
  initiateLogin: mockInitiateLogin,
  handleCallback: mockHandleCallback,
} as unknown as OidcStrategy;

const mockLoginOrProvisionOidcUser = vi.fn();

const mockAuthService = {
  loginOrProvisionOidcUser: mockLoginOrProvisionOidcUser,
} as unknown as AuthService;

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function buildController() {
  return new OidcController(mockOidcStrategy, mockAuthService);
}

const PROVIDER_ID = '11111111-1111-1111-1111-111111111111';

// ---------------------------------------------------------------------------
// Tests: initiateLogin
// ---------------------------------------------------------------------------

describe('OidcController.initiateLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitiateLogin.mockResolvedValue({
      authorizationUrl: 'https://idp.example.com/auth?state=test',
      state: 'test-state',
    });
  });

  it('redirects to the authorization URL returned by OidcStrategy', async () => {
    const controller = buildController();
    const res = makeRes();

    await controller.initiateLogin(PROVIDER_ID, '/workspace', res);

    expect(mockInitiateLogin).toHaveBeenCalledWith(PROVIDER_ID, '/workspace');
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://idp.example.com/auth?state=test');
  });

  it('passes undefined returnTo when query param is absent', async () => {
    const controller = buildController();
    const res = makeRes();

    // TypeScript: returnTo can be undefined in real controller because @Query returns undefined
    await controller.initiateLogin(PROVIDER_ID, undefined, res);

    expect(mockInitiateLogin).toHaveBeenCalledWith(PROVIDER_ID, undefined);
  });

  it('propagates errors from OidcStrategy', async () => {
    const controller = buildController();
    const res = makeRes();
    mockInitiateLogin.mockRejectedValue(new BadRequestException('Provider disabled'));

    await expect(controller.initiateLogin(PROVIDER_ID, undefined, res)).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: handleCallback
// ---------------------------------------------------------------------------

describe('OidcController.handleCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHandleCallback.mockResolvedValue({
      claims: {
        email: 'alice@example.com',
        displayName: 'Alice Smith',
        avatarUrl: 'https://example.com/avatar.png',
        sub: 'sub-123',
      },
      providerId: PROVIDER_ID,
    });

    mockLoginOrProvisionOidcUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice Smith',
        avatarUrl: null,
      },
      accessToken: 'jwt-access-token',
      refreshToken: 'opaque-refresh-token',
      expiresIn: 900,
      returnTo: '/workspace/abc',
    });
  });

  it('sets refresh token cookie and redirects to frontend', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    await controller.handleCallback(PROVIDER_ID, req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'opaque-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/auth',
      }),
    );

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('access_token=jwt-access-token'),
    );
  });

  it('passes user-agent and IP metadata to authService', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    await controller.handleCallback(PROVIDER_ID, req, res);

    expect(mockLoginOrProvisionOidcUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.com',
        displayName: 'Alice Smith',
        providerId: PROVIDER_ID,
      }),
      expect.objectContaining({
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      }),
    );
  });

  it('uses returnTo from auth result in the redirect URL', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    await controller.handleCallback(PROVIDER_ID, req, res);

    const redirectCall = (res.redirect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(redirectCall[1]).toContain('/workspace/abc');
  });

  it('defaults to / when returnTo is absent', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    mockLoginOrProvisionOidcUser.mockResolvedValue({
      user: { id: 'user-1', email: 'alice@example.com', displayName: 'Alice', avatarUrl: null },
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 900,
      returnTo: undefined,
    });

    await controller.handleCallback(PROVIDER_ID, req, res);

    const redirectCall = (res.redirect as ReturnType<typeof vi.fn>).mock.calls[0];
    // Should redirect to / + hash
    expect(redirectCall[1]).toMatch(/^http.+\/#access_token=/);
  });

  it('throws BadRequestException when IdP returns an error parameter', async () => {
    const controller = buildController();
    const req = makeReq({
      error: 'access_denied',
      error_description: 'User denied',
      state: '',
      code: '',
    });
    const res = makeRes();

    await expect(controller.handleCallback(PROVIDER_ID, req, res)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('propagates errors from OidcStrategy.handleCallback', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();
    mockHandleCallback.mockRejectedValue(new BadRequestException('State mismatch'));

    await expect(controller.handleCallback(PROVIDER_ID, req, res)).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: sanitizeReturnTo (via handleCallback behavior)
// ---------------------------------------------------------------------------

describe('OidcController redirect URL safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHandleCallback.mockResolvedValue({
      claims: { email: 'user@example.com', displayName: 'User', sub: 'sub' },
      providerId: PROVIDER_ID,
    });
  });

  it.each([
    ['//evil.com/steal', '/'],
    ['http://evil.com', '/'],
    ['javascript:alert(1)', '/'],
  ])('sanitizes dangerous returnTo "%s" to "/"', async (dangerousPath, expectedPath) => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    mockLoginOrProvisionOidcUser.mockResolvedValue({
      user: { id: 'u', email: 'user@example.com', displayName: 'U', avatarUrl: null },
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresIn: 900,
      returnTo: dangerousPath,
    });

    await controller.handleCallback(PROVIDER_ID, req, res);

    const redirectUrl = (res.redirect as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    // The path before # should be expectedPath
    const hashIndex = redirectUrl.indexOf('#');
    const urlBeforeHash = redirectUrl.substring(0, hashIndex);
    expect(urlBeforeHash.endsWith(expectedPath)).toBe(true);
  });

  it('preserves safe relative returnTo paths', async () => {
    const controller = buildController();
    const req = makeReq();
    const res = makeRes();

    mockLoginOrProvisionOidcUser.mockResolvedValue({
      user: { id: 'u', email: 'user@example.com', displayName: 'U', avatarUrl: null },
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresIn: 900,
      returnTo: '/workspace/my-space',
    });

    await controller.handleCallback(PROVIDER_ID, req, res);

    const redirectUrl = (res.redirect as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(redirectUrl).toContain('/workspace/my-space');
  });
});
