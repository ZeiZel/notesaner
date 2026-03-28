/**
 * Unit tests for CacheControlMiddleware.
 *
 * Covers:
 * - GET/HEAD requests receive Cache-Control from pattern matching
 * - POST/PUT/DELETE always get no-store
 * - Default policy for unmatched routes
 * - Vary and Surrogate-Control headers when present
 */

import { describe, it, expect, vi } from 'vitest';
import { CacheControlMiddleware } from '../middleware/cache-control.middleware';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockRequest(method: string, path: string): Partial<Request> {
  return { method, path } as Partial<Request>;
}

function makeMockResponse(): {
  res: Partial<Response>;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  return {
    res: {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }),
    } as unknown as Partial<Response>,
    headers,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CacheControlMiddleware', () => {
  const middleware = new CacheControlMiddleware();

  it('sets immutable cache for _next/static assets', () => {
    const req = makeMockRequest('GET', '/_next/static/chunks/main.js');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['Cache-Control']).toContain('31536000');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets no-store for auth endpoints', () => {
    const req = makeMockRequest('GET', '/api/auth/login');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toContain('no-store');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets no-store for API key endpoints', () => {
    const req = makeMockRequest('GET', '/api/keys/some-uuid');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toContain('no-store');
  });

  it('sets no-store for POST requests regardless of path', () => {
    const req = makeMockRequest('POST', '/api/workspaces/ws-1/notes');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('sets no-store for PUT requests', () => {
    const req = makeMockRequest('PUT', '/api/workspaces/ws-1/notes/n1');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('sets no-store for DELETE requests', () => {
    const req = makeMockRequest('DELETE', '/api/keys/some-uuid');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('sets default policy for unmatched GET routes', () => {
    const req = makeMockRequest('GET', '/api/some/unknown/endpoint');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toBe('private, no-cache');
  });

  it('sets Vary header when present in policy', () => {
    const req = makeMockRequest('GET', '/api/workspaces/ws-1/attachments/file.pdf');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Vary']).toContain('Authorization');
  });

  it('sets Surrogate-Control for CDN-cacheable routes', () => {
    const req = makeMockRequest('GET', '/public/vault/my-note');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Surrogate-Control']).toBeDefined();
    expect(headers['Cache-Control']).toContain('public');
  });

  it('handles HEAD requests the same as GET', () => {
    const req = makeMockRequest('HEAD', '/api/workspaces/ws-1/notes');
    const { res, headers } = makeMockResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(req as Request, res as Response, next);

    expect(headers['Cache-Control']).toContain('stale-while-revalidate');
  });

  it('always calls next()', () => {
    const cases = [
      { method: 'GET', path: '/health' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'DELETE', path: '/api/keys/id' },
      { method: 'GET', path: '/unknown' },
    ];

    for (const { method, path } of cases) {
      const req = makeMockRequest(method, path);
      const { res } = makeMockResponse();
      const next = vi.fn() as NextFunction;

      middleware.use(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
