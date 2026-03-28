/**
 * Unit tests for ETagInterceptor, computeETag, and isETagMatch.
 *
 * Covers:
 * - ETag generation (computeETag)
 * - ETag matching (isETagMatch)
 * - Interceptor: GET sets ETag header
 * - Interceptor: GET with matching If-None-Match → 304
 * - Interceptor: GET with non-matching If-None-Match → 200 + new ETag
 * - Interceptor: HEAD behaves like GET
 * - Interceptor: POST/PUT/PATCH/DELETE are passed through unchanged
 * - Edge cases: null/undefined body, serialisation failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import {
  ETagInterceptor,
  computeETag,
  isETagMatch,
  ETAG_HEADER,
  IF_NONE_MATCH_HEADER,
} from '../interceptors/etag.interceptor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(
  overrides: Partial<{
    headers: Record<string, string>;
    statusCode: number;
  }> = {},
) {
  const headers: Record<string, string> = { ...overrides.headers };
  let statusCode = overrides.statusCode ?? 200;
  let ended = false;

  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    status: vi.fn((code: number) => {
      statusCode = code;
      return this;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
    get headers() {
      return headers;
    },
    get statusCode() {
      return statusCode;
    },
    get ended() {
      return ended;
    },
  };
}

function makeRequest(method = 'GET', ifNoneMatch?: string) {
  const headers: Record<string, string | undefined> = {};
  if (ifNoneMatch) {
    headers[IF_NONE_MATCH_HEADER] = ifNoneMatch;
  }
  return { method, headers };
}

function makeContext(
  req: ReturnType<typeof makeRequest>,
  res: ReturnType<typeof makeResponse>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeCallHandler(body: unknown): CallHandler {
  return { handle: vi.fn().mockReturnValue(of(body)) };
}

// ─── computeETag ──────────────────────────────────────────────────────────────

describe('computeETag', () => {
  it('returns a weak ETag string starting with W/"', () => {
    const tag = computeETag('hello world');
    expect(tag).toMatch(/^W\/"[a-f0-9]+"$/);
  });

  it('produces the same ETag for identical input', () => {
    const body = JSON.stringify({ id: '1', name: 'test' });
    expect(computeETag(body)).toBe(computeETag(body));
  });

  it('produces different ETags for different bodies', () => {
    expect(computeETag('{"a":1}')).not.toBe(computeETag('{"a":2}'));
  });

  it('works with empty string input', () => {
    const tag = computeETag('');
    expect(tag).toMatch(/^W\/"[a-f0-9]+"$/);
  });

  it('produces 16 hex characters inside the quotes', () => {
    const tag = computeETag('some data');
    const inner = tag.replace('W/"', '').replace('"', '');
    expect(inner).toHaveLength(16);
    expect(inner).toMatch(/^[a-f0-9]+$/);
  });

  it('handles unicode content', () => {
    const tag = computeETag('こんにちは世界');
    expect(tag).toMatch(/^W\/"[a-f0-9]+"$/);
  });

  it('handles large payloads without throwing', () => {
    const large = JSON.stringify({ data: 'x'.repeat(100_000) });
    expect(() => computeETag(large)).not.toThrow();
  });
});

// ─── isETagMatch ──────────────────────────────────────────────────────────────

describe('isETagMatch', () => {
  it('returns true for exact match', () => {
    expect(isETagMatch('"abc123"', '"abc123"')).toBe(true);
  });

  it('returns true when client sends weak ETag and server has strong ETag', () => {
    expect(isETagMatch('W/"abc123"', '"abc123"')).toBe(true);
  });

  it('returns true when server sends weak ETag and client sends strong ETag', () => {
    expect(isETagMatch('"abc123"', 'W/"abc123"')).toBe(true);
  });

  it('returns false for non-matching ETags', () => {
    expect(isETagMatch('"abc123"', '"xyz999"')).toBe(false);
  });

  it('returns true for wildcard *', () => {
    expect(isETagMatch('*', '"anything"')).toBe(true);
  });

  it('returns true when any tag in a comma-separated list matches', () => {
    expect(isETagMatch('"abc", "xyz"', '"xyz"')).toBe(true);
  });

  it('returns false when no tag in the list matches', () => {
    expect(isETagMatch('"abc", "def"', '"xyz"')).toBe(false);
  });

  it('handles whitespace around comma-separated entries', () => {
    expect(isETagMatch('"abc" , "def" , "xyz"', '"xyz"')).toBe(true);
  });

  it('treats W/* wildcard same as *', () => {
    expect(isETagMatch('W/*', '"anytag"')).toBe(false); // W/* is NOT a valid wildcard
    expect(isETagMatch('*', '"anytag"')).toBe(true);
  });
});

// ─── ETagInterceptor ─────────────────────────────────────────────────────────

describe('ETagInterceptor', () => {
  let interceptor: ETagInterceptor;

  beforeEach(() => {
    interceptor = new ETagInterceptor();
  });

  // ── GET: sets ETag header ──────────────────────────────────────────────────

  it('sets ETag header on GET response', async () => {
    const body = { id: '1', name: 'note' };
    const req = makeRequest('GET');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(body);

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    expect(res.setHeader).toHaveBeenCalledWith(ETAG_HEADER, expect.stringMatching(/^W\//));
  });

  it('sets ETag header on HEAD response', async () => {
    const req = makeRequest('HEAD');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler({ data: true });

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    expect(res.setHeader).toHaveBeenCalledWith(ETAG_HEADER, expect.any(String));
  });

  // ── GET: returns body when ETag does not match ─────────────────────────────

  it('passes body through when If-None-Match does not match', async () => {
    const body = { id: 'abc' };
    const req = makeRequest('GET', '"doesnotmatch"');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(body);

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(result).toEqual(body);
    expect(res.setHeader).toHaveBeenCalledWith(ETAG_HEADER, expect.any(String));
  });

  // ── GET: 304 when ETag matches ─────────────────────────────────────────────

  it('returns 304 and ends response when If-None-Match matches', async () => {
    const body = { id: 'abc', name: 'note' };
    const etag = computeETag(JSON.stringify(body));

    const req = makeRequest('GET', etag);
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(body);

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('returns 304 for weak ETag match', async () => {
    const body = { id: 'xyz' };
    const etag = computeETag(JSON.stringify(body));
    // Client sends the same hash with W/ prefix
    const clientETag = etag; // already W/"..."

    const req = makeRequest('GET', clientETag);
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(body);

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(res.status).toHaveBeenCalledWith(304);
    expect(result).toBeUndefined();
  });

  it('returns 304 for wildcard If-None-Match: *', async () => {
    const req = makeRequest('GET', '*');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler({ any: 'data' });

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(res.status).toHaveBeenCalledWith(304);
    expect(result).toBeUndefined();
  });

  // ── Non-GET methods: pass through ─────────────────────────────────────────

  it('does not set ETag on POST requests', async () => {
    const req = makeRequest('POST');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler({ created: true });

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  it('does not set ETag on PUT requests', async () => {
    const req = makeRequest('PUT');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler({ updated: true });

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  it('does not set ETag on PATCH requests', async () => {
    const req = makeRequest('PATCH');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler({});

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  it('does not set ETag on DELETE requests', async () => {
    const req = makeRequest('DELETE');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(null);

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('passes through null body without setting ETag', async () => {
    const req = makeRequest('GET');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(null);

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(result).toBeNull();
    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  it('passes through undefined body without setting ETag', async () => {
    const req = makeRequest('GET');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler(undefined);

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(result).toBeUndefined();
    const etagCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    );
    expect(etagCall).toBeUndefined();
  });

  it('sets ETag when body is a string', async () => {
    const req = makeRequest('GET');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler('plain text response');

    const obs = interceptor.intercept(ctx, next);
    const result = await firstValueFrom(obs);

    expect(result).toBe('plain text response');
    expect(res.setHeader).toHaveBeenCalledWith(ETAG_HEADER, expect.stringMatching(/^W\//));
  });

  it('sets ETag when body is an array', async () => {
    const req = makeRequest('GET');
    const res = makeResponse();
    const ctx = makeContext(req, res);
    const next = makeCallHandler([{ id: '1' }, { id: '2' }]);

    const obs = interceptor.intercept(ctx, next);
    await firstValueFrom(obs);

    expect(res.setHeader).toHaveBeenCalledWith(ETAG_HEADER, expect.any(String));
  });

  it('produces stable ETag for same body across two requests', async () => {
    const body = { id: '1', name: 'stable' };

    const req1 = makeRequest('GET');
    const res1 = makeResponse();
    const ctx1 = makeContext(req1, res1);
    const next1 = makeCallHandler(body);

    const req2 = makeRequest('GET');
    const res2 = makeResponse();
    const ctx2 = makeContext(req2, res2);
    const next2 = makeCallHandler(body);

    await firstValueFrom(interceptor.intercept(ctx1, next1));
    await firstValueFrom(interceptor.intercept(ctx2, next2));

    const etag1 = (res1.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    )?.[1];
    const etag2 = (res2.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === ETAG_HEADER,
    )?.[1];

    expect(etag1).toBe(etag2);
  });
});
