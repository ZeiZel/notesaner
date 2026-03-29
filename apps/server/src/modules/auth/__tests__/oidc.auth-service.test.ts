/**
 * Unit tests for AuthService.loginOrProvisionOidcUser
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ValkeyService } from '../../valkey/valkey.service';
import type { EmailService } from '../../email/email.service';
import type { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_USER = {
  id: 'user-uuid-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  isActive: true,
  isSuperAdmin: false,
  passwordHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_SESSION = {
  id: 'session-uuid-1',
  userId: 'user-uuid-1',
  refreshToken: 'opaque-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

function buildService() {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(BASE_USER),
      update: vi.fn().mockResolvedValue(BASE_USER),
    },
    session: {
      create: vi.fn().mockResolvedValue(BASE_SESSION),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;

  const valkey = {
    get: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue({
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(true),
    }),
  } as unknown as ValkeyService;

  const emailService = {} as unknown as EmailService;

  const configService = {
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
  } as unknown as ConfigService;

  const service = new AuthService(prisma, valkey, emailService, configService);

  return { service, prisma };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService.loginOrProvisionOidcUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const oidcUser = {
    email: 'alice@example.com',
    displayName: 'Alice Smith',
    avatarUrl: 'https://example.com/avatar.png',
    providerId: 'provider-uuid-1',
    sub: 'sub-123',
  };

  it('creates a new user when no existing user found', async () => {
    const { service, prisma } = buildService();

    const result = await service.loginOrProvisionOidcUser(oidcUser);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'alice@example.com',
        displayName: 'Alice Smith',
        avatarUrl: 'https://example.com/avatar.png',
        passwordHash: null,
        isActive: true,
      }),
    });

    expect(result.user.email).toBe('alice@example.com');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.expiresIn).toBe('number');
  });

  it('normalizes email to lowercase on creation', async () => {
    const { service, prisma } = buildService();

    await service.loginOrProvisionOidcUser({
      ...oidcUser,
      email: 'ALICE@Example.COM',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'alice@example.com' }),
    });
  });

  it('returns existing user without creation when user already exists', async () => {
    const { service, prisma } = buildService();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(BASE_USER);

    const result = await service.loginOrProvisionOidcUser(oidcUser);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-uuid-1');
  });

  it('updates displayName and avatarUrl when they differ from IdP', async () => {
    const { service, prisma } = buildService();
    const outdatedUser = {
      ...BASE_USER,
      displayName: 'Old Name',
      avatarUrl: 'https://old.example.com/pic.jpg',
    };
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(outdatedUser);
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...outdatedUser,
      displayName: 'Alice Smith',
      avatarUrl: 'https://example.com/avatar.png',
    });

    await service.loginOrProvisionOidcUser(oidcUser);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      data: expect.objectContaining({
        displayName: 'Alice Smith',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    });
  });

  it('does NOT update if displayName and avatarUrl are unchanged', async () => {
    const { service, prisma } = buildService();
    const currentUser = {
      ...BASE_USER,
      displayName: 'Alice Smith',
      avatarUrl: 'https://example.com/avatar.png',
    };
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(currentUser);

    await service.loginOrProvisionOidcUser(oidcUser);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when existing user account is disabled', async () => {
    const { service, prisma } = buildService();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...BASE_USER,
      isActive: false,
    });

    await expect(service.loginOrProvisionOidcUser(oidcUser)).rejects.toThrow(ForbiddenException);
  });

  it('threads returnTo through to the response', async () => {
    const { service, prisma } = buildService();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(BASE_USER);

    const result = await service.loginOrProvisionOidcUser(oidcUser, undefined, '/notes/123');

    expect(result.returnTo).toBe('/notes/123');
  });

  it('creates a session record', async () => {
    const { service, prisma } = buildService();

    await service.loginOrProvisionOidcUser(oidcUser);

    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-uuid-1',
        refreshToken: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('falls back to email prefix when displayName is not provided', async () => {
    const { service, prisma } = buildService();

    await service.loginOrProvisionOidcUser({
      ...oidcUser,
      displayName: '',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayName: 'alice', // 'alice@example.com'.split('@')[0]
      }),
    });
  });
});
