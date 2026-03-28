/**
 * Unit tests for PageCacheInterceptor and buildPageCacheKey.
 *
 * Covers:
 * - buildPageCacheKey: key generation from path, query, and options
 * - Path normalisation (trailing slashes, encoding)
 * - Query parameter sorting and filtering
 */

import { describe, it, expect } from 'vitest';
import { buildPageCacheKey } from '../interceptors/page-cache.interceptor';

// ─── buildPageCacheKey ───────────────────────────────────────────────────────

describe('buildPageCacheKey', () => {
  it('generates key from prefix and path', () => {
    const key = buildPageCacheKey('page', '/p/my-vault');
    expect(key).toBe('page:/p/my-vault');
  });

  it('normalises trailing slashes', () => {
    const key = buildPageCacheKey('page', '/p/my-vault/');
    expect(key).toBe('page:/p/my-vault');
  });

  it('normalises multiple trailing slashes', () => {
    const key = buildPageCacheKey('page', '/p/my-vault///');
    expect(key).toBe('page:/p/my-vault');
  });

  it('preserves root path', () => {
    const key = buildPageCacheKey('page', '/');
    expect(key).toBe('page:/');
  });

  it('decodes URL-encoded paths', () => {
    const key = buildPageCacheKey('page', '/p/my%20vault/hello%20world');
    expect(key).toBe('page:/p/my vault/hello world');
  });

  it('ignores query params when includeQuery is false', () => {
    const key = buildPageCacheKey('page', '/p/my-vault', { cursor: 'abc', limit: 20 }, false);
    expect(key).toBe('page:/p/my-vault');
  });

  it('ignores query params by default', () => {
    const key = buildPageCacheKey('page', '/p/my-vault', { cursor: 'abc' });
    expect(key).toBe('page:/p/my-vault');
  });

  it('includes sorted query params when includeQuery is true', () => {
    const key = buildPageCacheKey(
      'page',
      '/p/my-vault/notes',
      { limit: 20, cursor: 'abc', sortBy: 'path' },
      true,
    );
    expect(key).toBe('page:/p/my-vault/notes?cursor=abc&limit=20&sortBy=path');
  });

  it('filters out undefined, null, and empty string query values', () => {
    const key = buildPageCacheKey(
      'page',
      '/p/my-vault/notes',
      { limit: 20, cursor: undefined, folder: null, search: '' },
      true,
    );
    expect(key).toBe('page:/p/my-vault/notes?limit=20');
  });

  it('returns path-only key when all query values are empty', () => {
    const key = buildPageCacheKey('page', '/p/my-vault', { cursor: undefined, folder: null }, true);
    expect(key).toBe('page:/p/my-vault');
  });

  it('returns path-only key when query is empty object', () => {
    const key = buildPageCacheKey('page', '/p/my-vault', {}, true);
    expect(key).toBe('page:/p/my-vault');
  });

  it('handles custom prefix', () => {
    const key = buildPageCacheKey('vault', '/p/my-vault');
    expect(key).toBe('vault:/p/my-vault');
  });

  it('handles deep nested paths', () => {
    const key = buildPageCacheKey('page', '/p/my-vault/folder/subfolder/note.md');
    expect(key).toBe('page:/p/my-vault/folder/subfolder/note.md');
  });

  it('produces consistent keys for same input', () => {
    const key1 = buildPageCacheKey('page', '/p/my-vault/notes', { b: '2', a: '1' }, true);
    const key2 = buildPageCacheKey('page', '/p/my-vault/notes', { a: '1', b: '2' }, true);
    expect(key1).toBe(key2);
  });
});
