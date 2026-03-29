import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware } from '../rate-limit.middleware';
import { SLIDING_RATE_LIMIT_KEY } from '../../decorators/rate-limit.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal mock ioredis client. */
function makeMockValkey() {
  return {
    eval: vi.fn(),
  };
}

/**
 * Builds a mock Express Request.
 *
 * @param overrides - Partial request properties to merge in.
 */
function makeMockRequest(
  overrides: Partial<
    Request & {
      user?: { sub?: string };
      route?: { path?: string; stack?: Array<{ handle?: unknown }> };
    }
  > = {},
): Request {
  return {
    method: 'GET',
    path: '/api/notes',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

/**
 * Builds a mock Express Response with spies on status, json, setHeader.
 */
function makeMockResponse() {
  const res: Partial<Response> & {
    headers: Record<string, string>;
    statusCode: number;
    jsonBody: unknown;
  } = {
    headers: {},
    statusCode: 200,
    jsonBody: undefined,
    setHeader: vi.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res as unknown as Response;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res as unknown as Response;
    }),
    json: vi.fn((body: unknown) => {
      res.jsonBody = body;
      return res as unknown as Response;
    }),
  };
  return res;
}

/** Returns a Lua eval result representing an ALLOWED request. */
function allowedResult(count = 1, windowRemainingMs = 60_000): [number, number, number] {
  return [1, count, windowRemainingMs];
}

/** Returns a Lua eval result representing a BLOCKED request. */
function blockedResult(count = 100, retryAfterMs = 30_000): [number, number, number] {
  return [0, count, retryAfterMs];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let valkey: ReturnType<typeof makeMockValkey>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    valkey = makeMockValkey();
    middleware = new RateLimitMiddleware(valkey as never);
    next = vi.fn();
  });

  // ── Happy path: request within limit ────────────────────────────────────────

  describe('allowed requests', () => {
    it('should call next() when request is within the limit', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should set X-RateLimit-* headers on allowed requests', async () => {
      valkey.eval.mockResolvedValue(allowedResult(1, 60_000));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should pass the correct window and limit to ValKey eval', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({ path: '/api/notes' });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      // ARGV[2] = windowMs (60 * 1000 = 60000)
      expect(evalArgs[4]).toBe('60000');
      // ARGV[3] = limit (100 for non-auth)
      expect(evalArgs[5]).toBe('100');
    });
  });

  // ── Blocked requests ────────────────────────────────────────────────────────

  describe('blocked requests (429)', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      valkey.eval.mockResolvedValue(blockedResult(100, 30_000));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number),
        }),
      );
    });

    it('should set Retry-After header when blocked', async () => {
      valkey.eval.mockResolvedValue(blockedResult(100, 30_000));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('should set X-RateLimit-Remaining to 0 when blocked', async () => {
      valkey.eval.mockResolvedValue(blockedResult(100, 30_000));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });

    it('should round up Retry-After to the next whole second', async () => {
      // 30_500 ms → ceil → 31 s
      valkey.eval.mockResolvedValue(blockedResult(100, 30_500));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '31');
    });
  });

  // ── Auth path defaults ──────────────────────────────────────────────────────

  describe('auth path defaults', () => {
    it('should apply 20 req/min default limit for /api/auth/* paths', async () => {
      valkey.eval.mockResolvedValue(allowedResult(1, 60_000));

      const req = makeMockRequest({ path: '/api/auth/login', method: 'POST' });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      // ARGV[3] = limit
      expect(evalArgs[5]).toBe('20');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '20');
    });

    it('should apply 100 req/min default limit for non-auth paths', async () => {
      valkey.eval.mockResolvedValue(allowedResult(1, 60_000));

      const req = makeMockRequest({ path: '/api/notes' });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      expect(evalArgs[5]).toBe('100');
    });
  });

  // ── @SlidingRateLimit() decorator ──────────────────────────────────────────

  describe('@SlidingRateLimit() decorator override', () => {
    it('should use decorator limit and window when set on handler', async () => {
      valkey.eval.mockResolvedValue(allowedResult(1, 120_000));

      // Simulate a handler function with @SlidingRateLimit(10, 120) metadata
      function mockHandler() {
        // intentionally empty
      }
      Reflect.defineMetadata(
        SLIDING_RATE_LIMIT_KEY,
        { limit: 10, windowSeconds: 120 },
        mockHandler,
      );

      const req = makeMockRequest({
        route: {
          path: '/api/export',
          stack: [{ handle: mockHandler }],
        },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      // ARGV[2] = windowMs = 120 * 1000
      expect(evalArgs[4]).toBe('120000');
      // ARGV[3] = limit = 10
      expect(evalArgs[5]).toBe('10');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    });

    it('should fall back to defaults when route has no decorator metadata', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      function handlerWithoutMeta() {
        // no metadata
      }

      const req = makeMockRequest({
        path: '/api/workspaces',
        route: {
          path: '/api/workspaces',
          stack: [{ handle: handlerWithoutMeta }],
        },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      expect(evalArgs[5]).toBe('100');
    });
  });

  // ── Identifier extraction ───────────────────────────────────────────────────

  describe('identifier extraction', () => {
    it('should key by userId when request is authenticated', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({
        user: { sub: 'user-uuid-42' },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('user:user-uuid-42');
    });

    it('should key by IP when request is unauthenticated', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({ ip: '203.0.113.1' });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('ip:203.0.113.1');
    });

    it('should use X-Forwarded-For header when present', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({
        ip: '10.0.0.1', // internal proxy IP
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('ip:203.0.113.5');
    });

    it('should use X-Real-Ip header when X-Forwarded-For is absent', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({
        headers: { 'x-real-ip': '203.0.113.7' },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('ip:203.0.113.7');
    });
  });

  // ── Route key normalisation ─────────────────────────────────────────────────

  describe('route key normalisation', () => {
    it('should use req.route.path when available', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({
        method: 'GET',
        path: '/api/notes/550e8400-e29b-41d4-a716-446655440000',
        route: { path: '/api/notes/:id', stack: [] },
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('GET:/api/notes/:id');
      expect(storeKey).not.toContain('550e8400');
    });

    it('should replace UUID segments when req.route.path is absent', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      const req = makeMockRequest({
        method: 'DELETE',
        path: '/api/notes/550e8400-e29b-41d4-a716-446655440000',
      });
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      const storeKey = valkey.eval.mock.calls[0]?.[2] as string;
      expect(storeKey).toContain('DELETE:/api/notes/:id');
      expect(storeKey).not.toContain('550e8400');
    });
  });

  // ── ValKey failure: fail-open behaviour ─────────────────────────────────────

  describe('ValKey failure (fail open)', () => {
    it('should call next() when ValKey eval throws', async () => {
      valkey.eval.mockRejectedValue(new Error('ECONNREFUSED'));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should NOT set a 429 status when ValKey is unreachable', async () => {
      valkey.eval.mockRejectedValue(new Error('TIMEOUT'));

      const req = makeMockRequest();
      const res = makeMockResponse();

      await middleware.use(req, res as unknown as Response, next);

      // status() should not be called at all (or at least not with 429)
      const statusCalls = (res.status as ReturnType<typeof vi.fn>).mock.calls as number[][];
      const has429 = statusCalls.some((args) => args[0] === 429);
      expect(has429).toBe(false);
    });
  });

  // ── Lua script call arguments ────────────────────────────────────────────────

  describe('Lua script correctness', () => {
    it('should pass the correct number of keys and args to eval', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      await middleware.use(makeMockRequest(), makeMockResponse() as unknown as Response, next);

      const evalArgs = valkey.eval.mock.calls[0] as unknown[];
      // eval(script, numKeys, key, nowMs, windowMs, limit, member)
      //      [0]     [1]      [2]  [3]    [4]       [5]   [6]
      expect(evalArgs).toHaveLength(7);
      expect(evalArgs[1]).toBe(1); // numKeys
      expect(typeof evalArgs[2]).toBe('string'); // key
      expect(typeof evalArgs[3]).toBe('string'); // nowMs
      expect(typeof evalArgs[4]).toBe('string'); // windowMs
      expect(typeof evalArgs[5]).toBe('string'); // limit
      expect(typeof evalArgs[6]).toBe('string'); // member
    });

    it('member arg should be unique between calls', async () => {
      valkey.eval.mockResolvedValue(allowedResult());

      await middleware.use(makeMockRequest(), makeMockResponse() as unknown as Response, vi.fn());
      await middleware.use(makeMockRequest(), makeMockResponse() as unknown as Response, vi.fn());

      const member1 = valkey.eval.mock.calls[0]?.[6] as string;
      const member2 = valkey.eval.mock.calls[1]?.[6] as string;
      expect(member1).not.toBe(member2);
    });
  });
});
