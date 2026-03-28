/**
 * Unit tests for the cache policy configuration and route matching.
 *
 * Covers:
 * - matchPattern: glob-like pattern matching
 * - resolveCachePolicyForPath: route-to-policy resolution
 * - Specific policy assignments for known routes
 */

import { describe, it, expect } from 'vitest';
import {
  matchPattern,
  resolveCachePolicyForPath,
  DEFAULT_CACHE_CONTROL,
} from '../../config/cache-policy';

// ─── matchPattern ────────────────────────────────────────────────────────────

describe('matchPattern', () => {
  it('matches exact paths', () => {
    expect(matchPattern('/metrics', '/metrics')).toBe(true);
  });

  it('does not match different exact paths', () => {
    expect(matchPattern('/metrics', '/health')).toBe(false);
  });

  it('matches wildcard at end', () => {
    expect(matchPattern('/api/auth/*', '/api/auth/login')).toBe(true);
    expect(matchPattern('/api/auth/*', '/api/auth/register')).toBe(true);
  });

  it('does not match wildcard when prefix differs', () => {
    expect(matchPattern('/api/auth/*', '/api/users/1')).toBe(false);
  });

  it('matches nested paths with wildcard', () => {
    expect(
      matchPattern(
        '/api/workspaces/*/notes/*/content',
        '/api/workspaces/ws-1/notes/note-1/content',
      ),
    ).toBe(true);
  });

  it('does not match partial path with nested wildcard', () => {
    expect(
      matchPattern('/api/workspaces/*/notes/*/content', '/api/workspaces/ws-1/notes/note-1'),
    ).toBe(false);
  });

  it('matches health check paths', () => {
    expect(matchPattern('/health*', '/health')).toBe(true);
    expect(matchPattern('/health*', '/health/db')).toBe(true);
    expect(matchPattern('/health*', '/healthz')).toBe(true);
  });

  it('handles paths with special regex characters', () => {
    expect(matchPattern('/api/docs*', '/api/docs')).toBe(true);
    expect(matchPattern('/api/docs*', '/api/docs/swagger')).toBe(true);
  });

  it('matches static asset paths', () => {
    expect(matchPattern('/static/*', '/static/image.png')).toBe(true);
    expect(matchPattern('/static/*', '/static/js/app.bundle.js')).toBe(true);
  });

  it('matches _next/static paths', () => {
    expect(matchPattern('/_next/static/*', '/_next/static/chunks/main-abc123.js')).toBe(true);
  });
});

// ─── resolveCachePolicyForPath ───────────────────────────────────────────────

describe('resolveCachePolicyForPath', () => {
  it('returns immutable policy for _next/static assets', () => {
    const policy = resolveCachePolicyForPath('/_next/static/chunks/app.js');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('immutable');
    expect(policy!.cacheControl).toContain('31536000');
  });

  it('returns immutable policy for /static assets', () => {
    const policy = resolveCachePolicyForPath('/static/logo.png');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('immutable');
  });

  it('returns no-store for auth endpoints', () => {
    const policy = resolveCachePolicyForPath('/api/auth/login');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('no-store');
  });

  it('returns no-store for API key management', () => {
    const policy = resolveCachePolicyForPath('/api/keys/some-uuid');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('no-store');
  });

  it('returns private no-cache for note content', () => {
    const policy = resolveCachePolicyForPath('/api/workspaces/ws-1/notes/note-1/content');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('no-cache');
    expect(policy!.cacheControl).toContain('private');
  });

  it('returns stale-while-revalidate for note list', () => {
    const policy = resolveCachePolicyForPath('/api/workspaces/ws-1/notes');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('stale-while-revalidate');
  });

  it('returns public cache for published content', () => {
    const policy = resolveCachePolicyForPath('/public/vault/my-note');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('public');
    expect(policy!.cacheControl).toContain('max-age=300');
  });

  it('returns short cache for health checks', () => {
    const policy = resolveCachePolicyForPath('/health');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('max-age=10');
  });

  it('returns no-cache for metrics endpoint', () => {
    const policy = resolveCachePolicyForPath('/metrics');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toBe('no-cache');
  });

  it('returns public cache for API docs', () => {
    const policy = resolveCachePolicyForPath('/api/docs');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('public');
  });

  it('returns API default for unmatched API paths', () => {
    const policy = resolveCachePolicyForPath('/api/some/unknown/route');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toBe('private, no-cache');
    expect(policy!.vary).toContain('Authorization');
  });

  it('returns undefined for completely unmatched paths', () => {
    const policy = resolveCachePolicyForPath('/unknown/non-api/path');
    expect(policy).toBeUndefined();
  });

  it('includes Vary header for attachment endpoints', () => {
    const policy = resolveCachePolicyForPath('/api/workspaces/ws-1/attachments/file.pdf');
    expect(policy).toBeDefined();
    expect(policy!.vary).toContain('Accept-Encoding');
  });

  it('returns public cache for public vault pages', () => {
    const policy = resolveCachePolicyForPath('/p/my-vault/some-note');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('public');
    expect(policy!.cacheControl).toContain('max-age=300');
  });

  it('returns public cache with 24h for file attachments', () => {
    const policy = resolveCachePolicyForPath('/api/workspaces/ws-1/files/image.png');
    expect(policy).toBeDefined();
    expect(policy!.cacheControl).toContain('max-age=86400');
  });

  it('includes Surrogate-Control for CDN-cacheable policies', () => {
    const policy = resolveCachePolicyForPath('/public/vault/note');
    expect(policy).toBeDefined();
    expect(policy!.surrogateControl).toBeDefined();
  });
});

// ─── DEFAULT_CACHE_CONTROL ──────────────────────────────────────────────────

describe('DEFAULT_CACHE_CONTROL', () => {
  it('is private, no-cache', () => {
    expect(DEFAULT_CACHE_CONTROL).toBe('private, no-cache');
  });
});
