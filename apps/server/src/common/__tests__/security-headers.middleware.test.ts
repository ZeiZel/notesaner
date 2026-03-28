/**
 * Unit tests for SecurityHeadersMiddleware.
 *
 * Covers:
 * - CSP header is set with correct directives
 * - CSP report-only mode
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy with denied APIs
 * - HSTS only in production
 * - X-DNS-Prefetch-Control: off
 * - X-Permitted-Cross-Domain-Policies: none
 * - Custom CSP via environment variable
 */

import { describe, it, expect, vi } from 'vitest';
import { SecurityHeadersMiddleware } from '../middleware/security-headers.middleware';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockConfig(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    nodeEnv: 'production',
    'cors.allowedOrigins': ['http://localhost:3000'],
    'security.csp': '',
    'security.cspReportOnly': false,
    'security.hstsMaxAge': 31536000,
    'security.permissionsPolicy': '',
    ...overrides,
  };
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      return key in defaults ? defaults[key] : defaultValue;
    }),
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    headers,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SecurityHeadersMiddleware', () => {
  // ── Default CSP ──────────────────────────────────────────────────────────

  it('sets Content-Security-Policy with default directives', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();
    const next = vi.fn();

    middleware.use({} as never, res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("script-src 'self'"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("style-src 'self' 'unsafe-inline'"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("img-src 'self' data: blob:"),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining('wss:'),
    );
    expect(next).toHaveBeenCalled();
  });

  // ── CSP Report-Only mode ─────────────────────────────────────────────────

  it('uses Content-Security-Policy-Report-Only when report mode is enabled', () => {
    const config = createMockConfig({ 'security.cspReportOnly': true });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();
    const next = vi.fn();

    middleware.use({} as never, res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy-Report-Only',
      expect.any(String),
    );
  });

  // ── Custom CSP ───────────────────────────────────────────────────────────

  it('uses custom CSP from environment when provided', () => {
    const customCsp = "default-src 'none'; script-src 'self'";
    const config = createMockConfig({ 'security.csp': customCsp });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();
    const next = vi.fn();

    middleware.use({} as never, res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', customCsp);
  });

  // ── Standard security headers ────────────────────────────────────────────

  it('sets X-Content-Type-Options: nosniff', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('sets X-Frame-Options: DENY', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
  });

  it('sets Permissions-Policy denying sensitive APIs', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('camera=()'),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('microphone=()'),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.stringContaining('geolocation=()'),
    );
  });

  it('sets X-DNS-Prefetch-Control: off', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith('X-DNS-Prefetch-Control', 'off');
  });

  it('sets X-Permitted-Cross-Domain-Policies: none', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith('X-Permitted-Cross-Domain-Policies', 'none');
  });

  // ── HSTS ─────────────────────────────────────────────────────────────────

  it('sets HSTS header in production', () => {
    const config = createMockConfig({ nodeEnv: 'production' });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  });

  it('does NOT set HSTS header in development', () => {
    const config = createMockConfig({ nodeEnv: 'development' });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    const hstsCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === 'Strict-Transport-Security',
    );
    expect(hstsCalls).toHaveLength(0);
  });

  it('uses custom HSTS max-age from config', () => {
    const config = createMockConfig({
      nodeEnv: 'production',
      'security.hstsMaxAge': 86400,
    });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=86400; includeSubDomains',
    );
  });

  // ── Custom Permissions-Policy ────────────────────────────────────────────

  it('uses custom Permissions-Policy from config', () => {
    const custom = 'camera=(self), microphone=()';
    const config = createMockConfig({ 'security.permissionsPolicy': custom });
    const middleware = new SecurityHeadersMiddleware(config as never);
    const res = createMockResponse();

    middleware.use({} as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', custom);
  });

  // ── Calls next() ─────────────────────────────────────────────────────────

  it('always calls next()', () => {
    const config = createMockConfig();
    const middleware = new SecurityHeadersMiddleware(config as never);
    const next = vi.fn();

    middleware.use({} as never, createMockResponse() as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
