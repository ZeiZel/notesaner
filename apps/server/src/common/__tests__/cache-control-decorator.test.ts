/**
 * Unit tests for the @CacheControl() decorator and buildCacheControlHeader.
 *
 * Covers:
 * - buildCacheControlHeader with various option combinations
 * - no-store override behaviour
 * - Immutable, SWR, stale-if-error directives
 * - Scope defaults
 */

import { describe, it, expect } from 'vitest';
import {
  buildCacheControlHeader,
  type CacheControlOptions,
} from '../decorators/cache-policy.decorator';

describe('buildCacheControlHeader', () => {
  it('returns private, no-cache by default (empty options)', () => {
    // With no directives set, scope defaults to 'private'
    const result = buildCacheControlHeader({});
    expect(result).toBe('private');
  });

  it('returns no-store when noStore is true (overrides everything)', () => {
    const result = buildCacheControlHeader({
      noStore: true,
      scope: 'public',
      maxAge: 3600,
      immutable: true,
    });
    expect(result).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });

  it('generates public scope with max-age', () => {
    const result = buildCacheControlHeader({
      scope: 'public',
      maxAge: 300,
    });
    expect(result).toBe('public, max-age=300');
  });

  it('generates private scope with no-cache', () => {
    const result = buildCacheControlHeader({
      scope: 'private',
      noCache: true,
    });
    expect(result).toBe('private, no-cache');
  });

  it('generates immutable static asset header', () => {
    const result = buildCacheControlHeader({
      scope: 'public',
      maxAge: 31536000,
      immutable: true,
    });
    expect(result).toBe('public, max-age=31536000, immutable');
  });

  it('generates stale-while-revalidate header', () => {
    const result = buildCacheControlHeader({
      scope: 'public',
      maxAge: 86400,
      staleWhileRevalidate: 3600,
    });
    expect(result).toBe('public, max-age=86400, stale-while-revalidate=3600');
  });

  it('generates s-maxage for CDN-specific caching', () => {
    const result = buildCacheControlHeader({
      scope: 'public',
      maxAge: 60,
      sMaxAge: 300,
    });
    expect(result).toBe('public, max-age=60, s-maxage=300');
  });

  it('includes must-revalidate and proxy-revalidate', () => {
    const result = buildCacheControlHeader({
      scope: 'private',
      maxAge: 0,
      mustRevalidate: true,
      proxyRevalidate: true,
    });
    expect(result).toBe('private, must-revalidate, proxy-revalidate, max-age=0');
  });

  it('includes stale-if-error directive', () => {
    const result = buildCacheControlHeader({
      scope: 'public',
      maxAge: 300,
      staleWhileRevalidate: 60,
      staleIfError: 86400,
    });
    expect(result).toBe('public, max-age=300, stale-while-revalidate=60, stale-if-error=86400');
  });

  it('generates full combination of directives', () => {
    const options: CacheControlOptions = {
      scope: 'public',
      maxAge: 3600,
      sMaxAge: 7200,
      staleWhileRevalidate: 600,
      staleIfError: 86400,
      mustRevalidate: true,
    };
    const result = buildCacheControlHeader(options);
    expect(result).toBe(
      'public, must-revalidate, max-age=3600, s-maxage=7200, stale-while-revalidate=600, stale-if-error=86400',
    );
  });

  it('defaults to private scope when not specified', () => {
    const result = buildCacheControlHeader({ maxAge: 60 });
    expect(result).toContain('private');
    expect(result).not.toContain('public');
  });

  it('allows max-age=0 for must-revalidate patterns', () => {
    const result = buildCacheControlHeader({
      scope: 'private',
      maxAge: 0,
      noCache: true,
    });
    expect(result).toBe('private, no-cache, max-age=0');
  });
});
