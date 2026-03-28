/**
 * Unit tests for the enhanced ETag interceptor features:
 * - computeETagFromTimestamp
 * - isNotModifiedSince
 * - updatedAt-based ETag generation
 * - If-Modified-Since conditional request handling
 */

import { describe, it, expect } from 'vitest';
import {
  computeETag,
  computeETagFromTimestamp,
  isETagMatch,
  isNotModifiedSince,
} from '../interceptors/etag.interceptor';

// ─── computeETagFromTimestamp ────────────────────────────────────────────────

describe('computeETagFromTimestamp', () => {
  it('generates a weak ETag from a Date object', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const etag = computeETagFromTimestamp(date);

    expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('generates a weak ETag from an ISO string', () => {
    const etag = computeETagFromTimestamp('2024-01-15T10:30:00Z');

    expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('produces stable output for the same input', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const etag1 = computeETagFromTimestamp(date);
    const etag2 = computeETagFromTimestamp(date);

    expect(etag1).toBe(etag2);
  });

  it('produces different output for different timestamps', () => {
    const etag1 = computeETagFromTimestamp('2024-01-15T10:30:00Z');
    const etag2 = computeETagFromTimestamp('2024-01-15T10:31:00Z');

    expect(etag1).not.toBe(etag2);
  });

  it('includes content hash when provided', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const etagWithoutHash = computeETagFromTimestamp(date);
    const etagWithHash = computeETagFromTimestamp(date, 'abc123');

    expect(etagWithoutHash).not.toBe(etagWithHash);
  });

  it('produces different results for different content hashes', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const etag1 = computeETagFromTimestamp(date, 'hash1');
    const etag2 = computeETagFromTimestamp(date, 'hash2');

    expect(etag1).not.toBe(etag2);
  });

  it('matches between Date and equivalent ISO string input', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    const etagFromDate = computeETagFromTimestamp(date);
    const etagFromString = computeETagFromTimestamp(date.toISOString());

    expect(etagFromDate).toBe(etagFromString);
  });
});

// ─── isNotModifiedSince ──────────────────────────────────────────────────────

describe('isNotModifiedSince', () => {
  it('returns true when resource has not been modified', () => {
    // Client has a copy from 10:30, server last modified at 10:30
    const result = isNotModifiedSince(
      'Mon, 15 Jan 2024 10:30:00 GMT',
      new Date('2024-01-15T10:30:00Z'),
    );
    expect(result).toBe(true);
  });

  it('returns true when server modified before client timestamp', () => {
    // Client has a copy from 10:30, server last modified at 10:00
    const result = isNotModifiedSince(
      'Mon, 15 Jan 2024 10:30:00 GMT',
      new Date('2024-01-15T10:00:00Z'),
    );
    expect(result).toBe(true);
  });

  it('returns false when resource has been modified', () => {
    // Client has a copy from 10:00, server last modified at 10:30
    const result = isNotModifiedSince(
      'Mon, 15 Jan 2024 10:00:00 GMT',
      new Date('2024-01-15T10:30:00Z'),
    );
    expect(result).toBe(false);
  });

  it('returns false when ifModifiedSince is undefined', () => {
    const result = isNotModifiedSince(undefined, new Date('2024-01-15T10:30:00Z'));
    expect(result).toBe(false);
  });

  it('returns false when lastModified is undefined', () => {
    const result = isNotModifiedSince('Mon, 15 Jan 2024 10:30:00 GMT', undefined);
    expect(result).toBe(false);
  });

  it('returns false for invalid client date', () => {
    const result = isNotModifiedSince('not-a-date', new Date('2024-01-15T10:30:00Z'));
    expect(result).toBe(false);
  });

  it('returns false for invalid server date string', () => {
    const result = isNotModifiedSince('Mon, 15 Jan 2024 10:30:00 GMT', 'also-not-a-date');
    expect(result).toBe(false);
  });

  it('accepts ISO string for lastModified', () => {
    const result = isNotModifiedSince('Mon, 15 Jan 2024 10:30:00 GMT', '2024-01-15T10:30:00.000Z');
    expect(result).toBe(true);
  });

  it('truncates to second-level precision', () => {
    // Same second, different milliseconds — should be equal
    const result = isNotModifiedSince(
      'Mon, 15 Jan 2024 10:30:00 GMT',
      new Date('2024-01-15T10:30:00.999Z'),
    );
    expect(result).toBe(true);
  });
});

// ─── Integration: ETag + timestamp ───────────────────────────────────────────

describe('ETag matching with timestamp-based ETags', () => {
  it('timestamp-based ETags can be matched by isETagMatch', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const etag = computeETagFromTimestamp(date);

    expect(isETagMatch(etag, etag)).toBe(true);
  });

  it('body-based and timestamp-based ETags are different for same content', () => {
    const body = JSON.stringify({ updatedAt: '2024-01-15T10:30:00Z', name: 'test' });
    const bodyEtag = computeETag(body);
    const tsEtag = computeETagFromTimestamp('2024-01-15T10:30:00Z');

    // These should be different — different hashing strategies
    expect(bodyEtag).not.toBe(tsEtag);
  });
});
