/**
 * Unit tests for CsrfMiddleware.
 *
 * Covers:
 * - Sets CSRF cookie on first request
 * - Skips validation for GET/HEAD/OPTIONS
 * - Validates X-CSRF-Token header against cookie
 * - Rejects requests with missing CSRF token
 * - Rejects requests with mismatched CSRF token
 * - Exempts configured paths (health, OIDC, API v1)
 * - Exempts API-key-authenticated requests
 * - Disabled mode passes all requests through
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CsrfMiddleware } from '../middleware/csrf.middleware';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockConfig(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'security.csrfCookieName': '_csrf',
    'security.csrfHeaderName': 'x-csrf-token',
    nodeEnv: 'production',
    'security.csrfEnabled': true,
    ...overrides,
  };
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      return key in defaults ? defaults[key] : defaultValue;
    }),
  };
}

function createRequest(
  method: string,
  path: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return {
    method,
    path,
    cookies,
    headers,
    ip: '127.0.0.1',
  };
}

function createResponse() {
  const cookies: Array<{ name: string; value: string; options: unknown }> = [];
  return {
    cookie: vi.fn((name: string, value: string, options: unknown) => {
      cookies.push({ name, value, options });
    }),
    cookies,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    mockConfig = createMockConfig();
    middleware = new CsrfMiddleware(mockConfig as never);
  });

  // ── Cookie generation ─────────────────────────────────────────────────────

  it('sets CSRF cookie when not present', () => {
    const req = createRequest('GET', '/api/notes');
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(res.cookie).toHaveBeenCalledWith(
      '_csrf',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'strict',
        path: '/',
      }),
    );
    expect(next).toHaveBeenCalled();
  });

  it('does not regenerate cookie when already present', () => {
    const req = createRequest('GET', '/api/notes', { _csrf: 'existing-token' });
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  // ── Safe methods skip validation ──────────────────────────────────────────

  it.each(['GET', 'HEAD', 'OPTIONS'])('skips CSRF validation for %s requests', (method) => {
    const req = createRequest(method, '/api/notes');
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  // ── POST validation ───────────────────────────────────────────────────────

  it('allows POST when CSRF header matches cookie', () => {
    const token = 'valid-csrf-token';
    const req = createRequest('POST', '/api/notes', { _csrf: token }, { 'x-csrf-token': token });
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects POST when CSRF header is missing', () => {
    const req = createRequest('POST', '/api/notes', { _csrf: 'token' }, {});
    const res = createResponse();
    const next = vi.fn();

    expect(() => middleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST when CSRF cookie is missing', () => {
    const req = createRequest('POST', '/api/notes', {}, { 'x-csrf-token': 'token' });
    const res = createResponse();
    const next = vi.fn();

    expect(() => middleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST when CSRF header does not match cookie', () => {
    const req = createRequest(
      'POST',
      '/api/notes',
      { _csrf: 'cookie-token' },
      { 'x-csrf-token': 'different-token' },
    );
    const res = createResponse();
    const next = vi.fn();

    expect(() => middleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
  });

  // ── Other state-changing methods ──────────────────────────────────────────

  it.each(['PUT', 'PATCH', 'DELETE'])('validates CSRF for %s requests', (method) => {
    const req = createRequest(method, '/api/notes/123', { _csrf: 'token' }, {});
    const res = createResponse();
    const next = vi.fn();

    expect(() => middleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
  });

  // ── Exempt paths ──────────────────────────────────────────────────────────

  it('exempts /health path', () => {
    const req = createRequest('POST', '/health', {}, {});
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('exempts /api/auth/oidc/ paths', () => {
    const req = createRequest('POST', '/api/auth/oidc/callback', {}, {});
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('exempts /api/v1/ API-key paths', () => {
    const req = createRequest('POST', '/api/v1/notes', {}, {});
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  // ── API key exemption ─────────────────────────────────────────────────────

  it('exempts requests with X-API-Key header', () => {
    const req = createRequest('POST', '/api/notes', {}, { 'x-api-key': 'my-api-key' });
    const res = createResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  // ── Disabled mode ─────────────────────────────────────────────────────────

  it('passes all requests when CSRF is disabled', () => {
    const disabledConfig = createMockConfig({ 'security.csrfEnabled': false });
    const disabledMiddleware = new CsrfMiddleware(disabledConfig as never);
    const req = createRequest('POST', '/api/notes', {}, {});
    const res = createResponse();
    const next = vi.fn();

    disabledMiddleware.use(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });
});
