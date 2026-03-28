/**
 * Unit tests for CompressionMiddleware and negotiateEncoding.
 *
 * Covers:
 * - Accept-Encoding negotiation (br > gzip > deflate > identity)
 * - q-factor parsing and preference ordering
 * - Already-compressed content type detection
 * - Vary: Accept-Encoding header always present
 * - Threshold: small responses bypass compression
 * - Middleware passes through non-compressible types
 * - next() is always called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CompressionMiddleware,
  negotiateEncoding,
  COMPRESSION_THRESHOLD_BYTES,
  ACCEPT_ENCODING_HEADER,
  CONTENT_ENCODING_HEADER,
  VARY_HEADER,
} from '../middleware/compression.middleware';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(acceptEncoding?: string): Request {
  const headers: Record<string, string> = {};
  if (acceptEncoding !== undefined) {
    headers[ACCEPT_ENCODING_HEADER] = acceptEncoding;
  }
  return { headers, method: 'GET' } as unknown as Request;
}

function makeResponse(contentType?: string): Response & {
  _headers: Record<string, string>;
  _status: number;
} {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['content-type'] = contentType;
  }

  const res = {
    _headers: headers,
    _status: 200,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    removeHeader: vi.fn((name: string) => {
      delete headers[name.toLowerCase()];
    }),
    getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
    write: vi.fn(),
    end: vi.fn(),
  };

  return res as unknown as Response & { _headers: Record<string, string>; _status: number };
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ─── negotiateEncoding ────────────────────────────────────────────────────────

describe('negotiateEncoding', () => {
  it('returns identity when Accept-Encoding is undefined', () => {
    expect(negotiateEncoding(undefined)).toBe('identity');
  });

  it('returns identity when Accept-Encoding is empty string', () => {
    expect(negotiateEncoding('')).toBe('identity');
  });

  it('returns br when brotli is offered', () => {
    expect(negotiateEncoding('br, gzip, deflate')).toBe('br');
  });

  it('returns gzip when br is not offered', () => {
    expect(negotiateEncoding('gzip, deflate')).toBe('gzip');
  });

  it('returns deflate when only deflate is offered', () => {
    expect(negotiateEncoding('deflate')).toBe('deflate');
  });

  it('respects q-factor: chooses gzip over br when br has q=0', () => {
    expect(negotiateEncoding('br;q=0, gzip;q=1.0')).toBe('gzip');
  });

  it('respects q-factor ordering: selects highest quality supported encoding', () => {
    // br is preferred (higher q) over gzip
    expect(negotiateEncoding('gzip;q=0.5, br;q=0.9')).toBe('br');
  });

  it('handles wildcard * by returning br (highest priority)', () => {
    expect(negotiateEncoding('*')).toBe('br');
  });

  it('handles wildcard with q-factor', () => {
    expect(negotiateEncoding('*;q=0.5, gzip;q=1.0')).toBe('gzip');
  });

  it('returns identity for Accept-Encoding: identity', () => {
    expect(negotiateEncoding('identity')).toBe('identity');
  });

  it('handles upper-case encoding names', () => {
    // Headers are case-insensitive per RFC 7231
    expect(negotiateEncoding('GZIP, DEFLATE')).toBe('gzip');
  });

  it('parses extra whitespace correctly', () => {
    expect(negotiateEncoding('  gzip  ,  deflate  ')).toBe('gzip');
  });

  it('excludes encodings with q=0 from selection', () => {
    // gzip explicitly rejected with q=0
    expect(negotiateEncoding('gzip;q=0, deflate')).toBe('deflate');
  });

  it('returns identity when all offered encodings have q=0', () => {
    expect(negotiateEncoding('gzip;q=0, br;q=0')).toBe('identity');
  });
});

// ─── COMPRESSION_THRESHOLD_BYTES ─────────────────────────────────────────────

describe('COMPRESSION_THRESHOLD_BYTES', () => {
  it('is exactly 1024 (1 KB)', () => {
    expect(COMPRESSION_THRESHOLD_BYTES).toBe(1024);
  });
});

// ─── CompressionMiddleware ────────────────────────────────────────────────────

describe('CompressionMiddleware', () => {
  let middleware: CompressionMiddleware;

  beforeEach(() => {
    middleware = new CompressionMiddleware();
  });

  // ── Always calls next() ────────────────────────────────────────────────────

  it('calls next()', () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = makeNext();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next() even when Accept-Encoding is unsupported', () => {
    const req = makeRequest('compress, identity'); // 'compress' is not supported
    const res = makeResponse();
    const next = makeNext();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  // ── Vary header ────────────────────────────────────────────────────────────

  it('sets Vary: Accept-Encoding on every response', () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = makeNext();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(VARY_HEADER, 'Accept-Encoding');
  });

  it('sets Vary: Accept-Encoding even when client sends no Accept-Encoding header', () => {
    const req = makeRequest(undefined);
    const res = makeResponse();
    const next = makeNext();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(VARY_HEADER, 'Accept-Encoding');
  });

  // ── No compression for identity encoding ──────────────────────────────────

  it('does not override res.write when encoding is identity', () => {
    const req = makeRequest('identity');
    const res = makeResponse();
    const originalWrite = res.write;
    const next = makeNext();

    middleware.use(req, res, next);

    // write should not have been replaced
    expect(res.write).toBe(originalWrite);
  });

  // ── Compression headers set on write ──────────────────────────────────────

  it('sets Content-Encoding: gzip when client accepts gzip', () => {
    const req = makeRequest('gzip');
    const res = makeResponse('application/json');
    const next = makeNext();

    middleware.use(req, res, next);

    // Simulate large body write above threshold
    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 'a');
    // @ts-expect-error — we patched res.write
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    expect(res.setHeader).toHaveBeenCalledWith(CONTENT_ENCODING_HEADER, 'gzip');
  });

  it('sets Content-Encoding: br when client accepts br', () => {
    const req = makeRequest('br');
    const res = makeResponse('application/json');
    const next = makeNext();

    middleware.use(req, res, next);

    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 'a');
    // @ts-expect-error — we patched res.write
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    expect(res.setHeader).toHaveBeenCalledWith(CONTENT_ENCODING_HEADER, 'br');
  });

  it('sets Content-Encoding: deflate when client accepts only deflate', () => {
    const req = makeRequest('deflate');
    const res = makeResponse('application/json');
    const next = makeNext();

    middleware.use(req, res, next);

    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 'a');
    // @ts-expect-error — we patched res.write
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    expect(res.setHeader).toHaveBeenCalledWith(CONTENT_ENCODING_HEADER, 'deflate');
  });

  // ── Already-compressed types are NOT re-compressed ─────────────────────────

  it('does not set Content-Encoding for image/jpeg responses', () => {
    const req = makeRequest('gzip');
    const res = makeResponse('image/jpeg');
    const next = makeNext();

    middleware.use(req, res, next);

    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 0xff);
    // @ts-expect-error -- patched method on mock object
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    const encodingCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === CONTENT_ENCODING_HEADER,
    );
    expect(encodingCall).toBeUndefined();
  });

  it('does not compress application/gzip responses', () => {
    const req = makeRequest('gzip');
    const res = makeResponse('application/gzip');
    const next = makeNext();

    middleware.use(req, res, next);

    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 0xff);
    // @ts-expect-error -- patched method on mock object
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    const encodingCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === CONTENT_ENCODING_HEADER,
    );
    expect(encodingCall).toBeUndefined();
  });

  // ── Threshold: small responses bypass compression ─────────────────────────

  it('does not compress payloads below the 1 KB threshold', () => {
    const req = makeRequest('gzip');
    const res = makeResponse('application/json');
    const next = makeNext();

    middleware.use(req, res, next);

    const smallChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES - 1, 'x');
    // @ts-expect-error -- patched method on mock object
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(smallChunk);

    const encodingCall = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === CONTENT_ENCODING_HEADER,
    );
    expect(encodingCall).toBeUndefined();
  });

  // ── Content-Length removal ─────────────────────────────────────────────────

  it('removes Content-Length header when compressing', () => {
    const req = makeRequest('gzip');
    const res = makeResponse('application/json');
    const next = makeNext();

    middleware.use(req, res, next);

    const largeChunk = Buffer.alloc(COMPRESSION_THRESHOLD_BYTES + 1, 'a');
    // @ts-expect-error -- patched method on mock object
    (res as unknown as { write: (...args: unknown[]) => unknown }).write(largeChunk);

    expect(res.removeHeader).toHaveBeenCalledWith('Content-Length');
  });
});
