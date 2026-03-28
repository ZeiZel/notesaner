/**
 * Security tests: Authentication
 *
 * Covers:
 * - Brute force protection (account lockout)
 * - Session fixation prevention
 * - Token leakage prevention (password reset, email verification)
 * - CSRF token validation
 * - Rate limiting on auth endpoints
 * - Password reset token single-use enforcement
 * - Email enumeration prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { CsrfMiddleware } from '../../common/middleware/csrf.middleware';
import { AuthService } from '../../modules/auth/auth.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockRedis() {
  return {
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-2),
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

function createMockConfig(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'rateLimit.accountLockout.maxAttempts': 5,
    'rateLimit.accountLockout.lockoutDurationSeconds': 900,
    'rateLimit.accountLockout.windowSeconds': 3600,
    'security.csrfCookieName': '_csrf',
    'security.csrfHeaderName': 'x-csrf-token',
    'security.csrfEnabled': true,
    nodeEnv: 'production',
    'cors.allowedOrigins': ['https://app.notesaner.io'],
    'security.csp': '',
    'security.cspReportOnly': false,
    'security.hstsMaxAge': 31536000,
    'security.permissionsPolicy': '',
    frontendUrl: 'https://app.notesaner.io',
    'auth.requireEmailVerification': true,
    ...overrides,
  };
  return {
    get: vi.fn(
      <T>(key: string, defaultValue?: T): T => (defaults[key] as T) ?? (defaultValue as T),
    ),
  };
}

function createMockRequest(
  overrides: Partial<{
    method: string;
    path: string;
    cookies: Record<string, string>;
    headers: Record<string, string | undefined>;
    ip: string;
  }> = {},
) {
  return {
    method: 'POST',
    path: '/api/auth/login',
    cookies: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  const cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    cookie: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
      cookies.push({ name, value, options });
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    _headers: headers,
    _cookies: cookies,
  };
}

// ---------------------------------------------------------------------------
// 1. Brute Force Protection
// ---------------------------------------------------------------------------

describe('Brute Force Protection', () => {
  let lockoutService: AccountLockoutService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    const config = createMockConfig({
      'rateLimit.accountLockout.maxAttempts': 5,
      'rateLimit.accountLockout.lockoutDurationSeconds': 900,
    });
    lockoutService = new AccountLockoutService(mockRedis as never, config as never);
  });

  it('should lock account after consecutive failed attempts reach threshold', async () => {
    // Simulate 5 failed attempts (threshold)
    mockRedis.incr.mockResolvedValue(5);

    await lockoutService.recordFailedAttempt('10.0.0.1', 'victim@test.com');

    // Verify IP lock was set
    expect(mockRedis.set).toHaveBeenCalledWith('lockout:locked:ip:10.0.0.1', '1', 'EX', 900);
  });

  it('should reject login attempts during lockout period', async () => {
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(600);

    await expect(lockoutService.assertNotLocked('10.0.0.1', 'victim@test.com')).rejects.toThrow(
      HttpException,
    );

    try {
      await lockoutService.assertNotLocked('10.0.0.1', 'victim@test.com');
    } catch (error) {
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const response = httpError.getResponse() as Record<string, unknown>;
      expect(response.code).toBe('ACCOUNT_LOCKED');
      expect(response.retryAfter).toBe(600);
    }
  });

  it('should lock by IP even without email (anonymous brute force)', async () => {
    mockRedis.incr.mockResolvedValue(5);

    await lockoutService.recordFailedAttempt('10.0.0.1');

    expect(mockRedis.set).toHaveBeenCalledWith('lockout:locked:ip:10.0.0.1', '1', 'EX', 900);
  });

  it('should track IP and email independently', async () => {
    // IP at 4, email at 5 (only email should lock)
    mockRedis.incr
      .mockResolvedValueOnce(4) // IP counter
      .mockResolvedValueOnce(5); // email counter

    await lockoutService.recordFailedAttempt('10.0.0.1', 'target@test.com');

    // Email lock should be set, but IP lock should NOT
    expect(mockRedis.set).toHaveBeenCalledWith(
      'lockout:locked:email:target@test.com',
      '1',
      'EX',
      900,
    );
    expect(mockRedis.set).not.toHaveBeenCalledWith('lockout:locked:ip:10.0.0.1', '1', 'EX', 900);
  });

  it('should reset counters on successful login', async () => {
    await lockoutService.resetAttempts('10.0.0.1', 'user@test.com');

    expect(mockRedis.del).toHaveBeenCalledWith(
      'lockout:ip:10.0.0.1',
      'lockout:email:user@test.com',
    );
  });

  it('should fail open if ValKey is unreachable (availability over security)', async () => {
    mockRedis.exists.mockRejectedValue(new Error('ECONNREFUSED'));

    // Should NOT throw -- fail open
    await expect(lockoutService.assertNotLocked('10.0.0.1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. CSRF Protection
// ---------------------------------------------------------------------------

describe('CSRF Protection', () => {
  let csrfMiddleware: CsrfMiddleware;

  beforeEach(() => {
    const config = createMockConfig();
    csrfMiddleware = new CsrfMiddleware(config as never);
  });

  it('should reject POST without CSRF token', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/notes',
      cookies: { _csrf: 'valid-token' },
      headers: {},
    });
    const res = createMockResponse();
    const next = vi.fn();

    expect(() => csrfMiddleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when header token does not match cookie token', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/notes',
      cookies: { _csrf: 'cookie-token' },
      headers: { 'x-csrf-token': 'different-header-token' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    expect(() => csrfMiddleware.use(req as never, res as never, next)).toThrow(ForbiddenException);
  });

  it('should accept when header token matches cookie token', () => {
    const token = 'matching-csrf-token';
    const req = createMockRequest({
      method: 'POST',
      path: '/api/notes',
      cookies: { _csrf: token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    const next = vi.fn();

    csrfMiddleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('should skip CSRF for GET requests', () => {
    const req = createMockRequest({
      method: 'GET',
      path: '/api/notes',
    });
    const res = createMockResponse();
    const next = vi.fn();

    csrfMiddleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('should skip CSRF for API-key-authenticated requests', () => {
    const req = createMockRequest({
      method: 'POST',
      path: '/api/notes',
      headers: { 'x-api-key': 'nsk_someapikey' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    csrfMiddleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('should skip CSRF for exempt paths (health, OIDC callback, API v1)', () => {
    const exemptPaths = ['/health', '/api/auth/oidc/callback', '/api/v1/notes'];

    for (const path of exemptPaths) {
      const req = createMockRequest({ method: 'POST', path });
      const res = createMockResponse();
      const next = vi.fn();

      csrfMiddleware.use(req as never, res as never, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('should enforce CSRF for PUT, PATCH, DELETE methods', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const req = createMockRequest({
        method,
        path: '/api/notes/123',
        cookies: { _csrf: 'token' },
        headers: {},
      });
      const res = createMockResponse();
      const next = vi.fn();

      expect(() => csrfMiddleware.use(req as never, res as never, next)).toThrow(
        ForbiddenException,
      );
    }
  });

  it('should generate CSRF token cookie when none exists', () => {
    const req = createMockRequest({
      method: 'GET',
      path: '/api/notes',
      cookies: {},
    });
    const res = createMockResponse();
    const next = vi.fn();

    csrfMiddleware.use(req as never, res as never, next);

    expect(res.cookie).toHaveBeenCalledWith(
      '_csrf',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false, // Must be readable by JS
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('should set Secure flag on CSRF cookie in production', () => {
    const config = createMockConfig({ nodeEnv: 'production' });
    const middleware = new CsrfMiddleware(config as never);

    const req = createMockRequest({ method: 'GET', path: '/api/notes', cookies: {} });
    const res = createMockResponse();
    const next = vi.fn();

    middleware.use(req as never, res as never, next);

    expect(res.cookie).toHaveBeenCalledWith(
      '_csrf',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Password Reset Token Security
// ---------------------------------------------------------------------------

describe('Password Reset Token Security', () => {
  let authService: AuthService;
  let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let mockValkey: Record<string, ReturnType<typeof vi.fn>>;
  let mockEmailService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      passwordResetToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      emailVerificationToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    mockValkey = {
      get: vi.fn().mockResolvedValue(null),
      getClient: vi.fn().mockReturnValue({
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    };
    mockEmailService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const config = createMockConfig();
    authService = new AuthService(
      mockPrisma as never,
      mockValkey as never,
      mockEmailService as never,
      config as never,
    );
  });

  it('should return same response for existing and non-existing emails (anti-enumeration)', async () => {
    // Existing user
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      displayName: 'Alice',
      email: 'alice@test.com',
      passwordHash: 'scrypt:salt:hash',
    });
    mockPrisma.passwordResetToken.create.mockResolvedValueOnce({ id: 'token-1' });

    const existingResult = await authService.forgotPassword({
      email: 'alice@test.com',
    });

    // Non-existing user
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const nonExistingResult = await authService.forgotPassword({
      email: 'nobody@test.com',
    });

    // Both responses must be identical
    expect(existingResult.message).toBe(nonExistingResult.message);
  });

  it('should not send reset email for SSO-only users (no passwordHash)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-sso',
      displayName: 'SSO User',
      email: 'sso@test.com',
      passwordHash: null, // SSO user, no local password
    });

    const result = await authService.forgotPassword({ email: 'sso@test.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
    expect(result.message).toContain('If an account with that email exists');
  });

  it('should reject expired password reset tokens', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() - 3600_000), // expired 1 hour ago
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await expect(
      authService.resetPassword({
        token: 'raw-token-value',
        password: 'newSecurePass123',
      }),
    ).rejects.toThrow('Invalid or expired password reset token');
  });

  it('should reject already-used password reset tokens (single-use)', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 3600_000), // still valid
      usedAt: new Date(), // already used
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await expect(
      authService.resetPassword({
        token: 'raw-token-value',
        password: 'newSecurePass123',
      }),
    ).rejects.toThrow('Invalid or expired password reset token');
  });

  it('should invalidate all sessions on password reset', async () => {
    // Add required Prisma model mocks for the $transaction call
    mockPrisma.user.update = vi.fn().mockReturnValue(Promise.resolve());
    mockPrisma.passwordResetToken.update = vi.fn().mockReturnValue(Promise.resolve());
    mockPrisma.session.deleteMany = vi.fn().mockReturnValue(Promise.resolve());

    mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    await authService.resetPassword({
      token: 'raw-token-value',
      password: 'newSecurePass123',
    });

    // $transaction should have been called with an array of 3 operations:
    // 1. user.update (new password hash)
    // 2. passwordResetToken.update (mark used)
    // 3. session.deleteMany (invalidate all sessions)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(transactionArg)).toBe(true);
    expect(transactionArg).toHaveLength(3);
  });

  it('should rate limit password reset requests per email', async () => {
    // Simulate rate limit exceeded
    mockValkey.get.mockResolvedValue('3'); // already at limit

    const result = await authService.forgotPassword({
      email: 'alice@test.com',
    });

    // Should return success message without sending email (anti-enumeration)
    expect(result.message).toContain('If an account with that email exists');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should store only hashed tokens in database (never plaintext)', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      displayName: 'Alice',
      email: 'alice@test.com',
      passwordHash: 'scrypt:salt:hash',
    });
    mockPrisma.passwordResetToken.create.mockResolvedValueOnce({ id: 'token-1' });

    await authService.forgotPassword({ email: 'alice@test.com' });

    // The create call should receive a tokenHash, not a raw token
    const createCall = mockPrisma.passwordResetToken.create.mock.calls[0];
    const data = createCall?.[0]?.data;

    expect(data).toHaveProperty('tokenHash');
    expect(typeof data.tokenHash).toBe('string');
    // tokenHash should be a hex SHA-256 (64 chars)
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// 4. Email Verification Token Security
// ---------------------------------------------------------------------------

describe('Email Verification Token Security', () => {
  let authService: AuthService;
  let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let mockValkey: Record<string, ReturnType<typeof vi.fn>>;
  let mockEmailService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      emailVerificationToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      passwordResetToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    mockValkey = {
      get: vi.fn().mockResolvedValue(null),
      getClient: vi.fn().mockReturnValue({
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    };
    mockEmailService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const config = createMockConfig();
    authService = new AuthService(
      mockPrisma as never,
      mockValkey as never,
      mockEmailService as never,
      config as never,
    );
  });

  it('should reject expired verification tokens', async () => {
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: 'vtoken-1',
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() - 86400_000), // expired 24h ago
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1', isEmailVerified: false },
    });

    await expect(authService.verifyEmail({ token: 'raw-verification-token' })).rejects.toThrow(
      'Invalid or expired verification token',
    );
  });

  it('should reject already-used verification tokens', async () => {
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: 'vtoken-1',
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: new Date(), // already consumed
      userId: 'user-1',
      user: { id: 'user-1', isEmailVerified: false },
    });

    await expect(authService.verifyEmail({ token: 'raw-verification-token' })).rejects.toThrow(
      'Invalid or expired verification token',
    );
  });

  it('should not send verification email for already-verified users', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'alice@test.com',
      displayName: 'Alice',
      isEmailVerified: true,
    });

    await authService.sendVerificationEmail('user-1');

    expect(mockEmailService.send).not.toHaveBeenCalled();
    expect(mockPrisma.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it('should return same response for resend regardless of email existence (anti-enumeration)', async () => {
    // Existing unverified user
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      isEmailVerified: false,
    });
    mockPrisma.emailVerificationToken.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({
      id: 'vt-1',
    });
    // sendVerificationEmail calls user.findUnique again
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@test.com',
      displayName: 'User',
      isEmailVerified: false,
    });

    const existingResult = await authService.resendVerificationEmail({
      email: 'user@test.com',
    });

    // Non-existing user
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const nonExistingResult = await authService.resendVerificationEmail({
      email: 'noone@test.com',
    });

    expect(existingResult.message).toBe(nonExistingResult.message);
  });
});

// ---------------------------------------------------------------------------
// 5. API Key Security
// ---------------------------------------------------------------------------

describe('API Key Security', () => {
  it('should use SHA-256 for key hashing', async () => {
    // Import directly to test the static method
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');

    const rawKey = 'nsk_' + 'a'.repeat(64);
    const hash = ApiKeyService.hashKey(rawKey);

    // SHA-256 produces 64-char hex string
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Same input always produces same hash
    expect(ApiKeyService.hashKey(rawKey)).toBe(hash);

    // Different input produces different hash
    const differentKey = 'nsk_' + 'b'.repeat(64);
    expect(ApiKeyService.hashKey(differentKey)).not.toBe(hash);
  });

  it('should use nsk_ prefix for key identification', async () => {
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');
    expect(ApiKeyService.KEY_PREFIX).toBe('nsk_');
  });
});
