import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserApiKeyService } from '../api-key.service';
import { UserApiKeyScope } from '../dto/create-api-key.dto';
import type { PrismaService } from '../../../../prisma/prisma.service';
import type { ValkeyService } from '../../../valkey/valkey.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockPrisma(): Partial<PrismaService> {
  return {
    apiKey: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Partial<PrismaService>;
}

function makeMockValkey(): Partial<ValkeyService> {
  const mockClient = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
  return {
    getClient: vi.fn().mockReturnValue(mockClient),
    get: vi.fn().mockResolvedValue(null),
  } as unknown as Partial<ValkeyService>;
}

function makeApiKeyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-uuid-1',
    userId: 'user-uuid-1',
    name: 'Test Key',
    keyHash: 'somehash',
    prefix: 'nts_a1b2',
    scopes: ['READ'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UserApiKeyService', () => {
  let service: UserApiKeyService;
  let prisma: ReturnType<typeof makeMockPrisma>;
  let valkey: ReturnType<typeof makeMockValkey>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makeMockPrisma();
    valkey = makeMockValkey();
    service = new UserApiKeyService(
      prisma as unknown as PrismaService,
      valkey as unknown as ValkeyService,
    );
  });

  // ── hashKey ────────────────────────────────────────────────────────────────

  describe('hashKey', () => {
    it('should return a 64-char hex string', () => {
      const hash = UserApiKeyService.hashKey('test-input');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic', () => {
      const h1 = UserApiKeyService.hashKey('abc');
      const h2 = UserApiKeyService.hashKey('abc');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', () => {
      expect(UserApiKeyService.hashKey('a')).not.toBe(UserApiKeyService.hashKey('b'));
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an API key and return the raw key', async () => {
      const record = makeApiKeyRecord();
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(0);
      vi.mocked(prisma.apiKey!.create).mockResolvedValue(record);

      const result = await service.create('user-uuid-1', {
        name: 'Test Key',
        scopes: [UserApiKeyScope.READ],
      });

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^nts_/);
      expect(result.name).toBe('Test Key');
      expect(result.id).toBe('key-uuid-1');
    });

    it('should default to READ scope when none provided', async () => {
      const record = makeApiKeyRecord();
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(0);
      vi.mocked(prisma.apiKey!.create).mockResolvedValue(record);

      await service.create('user-uuid-1', { name: 'Default Key' });

      const createCall = vi.mocked(prisma.apiKey!.create).mock.calls[0]?.[0];
      expect(createCall?.data?.scopes).toEqual(['READ']);
    });

    it('should throw BadRequestException when key limit is reached', async () => {
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(25);

      await expect(service.create('user-uuid-1', { name: 'Too Many' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for past expiresAt', async () => {
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(0);

      await expect(
        service.create('user-uuid-1', {
          name: 'Expired',
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate unique keys on each call', async () => {
      const record = makeApiKeyRecord();
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(0);
      vi.mocked(prisma.apiKey!.create).mockResolvedValue(record);

      const r1 = await service.create('user-uuid-1', { name: 'a' });
      const r2 = await service.create('user-uuid-1', { name: 'b' });
      expect(r1.key).not.toBe(r2.key);
    });

    it('should not expose keyHash in the response', async () => {
      const record = makeApiKeyRecord();
      vi.mocked(prisma.apiKey!.count).mockResolvedValue(0);
      vi.mocked(prisma.apiKey!.create).mockResolvedValue(record);

      const result = await service.create('user-uuid-1', { name: 'x' });
      expect((result as Record<string, unknown>)['keyHash']).toBeUndefined();
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return mapped DTOs', async () => {
      vi.mocked(prisma.apiKey!.findMany).mockResolvedValue([
        makeApiKeyRecord({ id: 'k1', name: 'Key 1' }),
        makeApiKeyRecord({ id: 'k2', name: 'Key 2' }),
      ]);

      const result = await service.list('user-uuid-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('k1');
      expect(result[1].id).toBe('k2');
    });

    it('should return empty array when no keys exist', async () => {
      vi.mocked(prisma.apiKey!.findMany).mockResolvedValue([]);
      const result = await service.list('user-uuid-1');
      expect(result).toEqual([]);
    });

    it('should not include raw key in list results', async () => {
      vi.mocked(prisma.apiKey!.findMany).mockResolvedValue([makeApiKeyRecord()]);
      const result = await service.list('user-uuid-1');
      expect((result[0] as Record<string, unknown>)['key']).toBeUndefined();
    });

    it('should format dates as ISO strings', async () => {
      const date = new Date('2026-06-15T10:00:00Z');
      vi.mocked(prisma.apiKey!.findMany).mockResolvedValue([
        makeApiKeyRecord({ lastUsedAt: date }),
      ]);

      const result = await service.list('user-uuid-1');
      expect(result[0].lastUsedAt).toBe(date.toISOString());
    });
  });

  // ── revoke ─────────────────────────────────────────────────────────────────

  describe('revoke', () => {
    it('should revoke an existing key', async () => {
      vi.mocked(prisma.apiKey!.findFirst).mockResolvedValue(makeApiKeyRecord());

      await service.revoke('user-uuid-1', 'key-uuid-1');
      expect(prisma.apiKey!.update).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException for non-existent key', async () => {
      vi.mocked(prisma.apiKey!.findFirst).mockResolvedValue(null);

      await expect(service.revoke('user-uuid-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should not update when key not found', async () => {
      vi.mocked(prisma.apiKey!.findFirst).mockResolvedValue(null);

      await expect(service.revoke('user-uuid-1', 'nonexistent')).rejects.toThrow();
      expect(prisma.apiKey!.update).not.toHaveBeenCalled();
    });
  });

  // ── validate ───────────────────────────────────────────────────────────────

  describe('validate', () => {
    const rawKey = 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789';

    it('should return validated key for valid input', async () => {
      vi.mocked(prisma.apiKey!.findUnique).mockResolvedValue(
        makeApiKeyRecord({
          keyHash: UserApiKeyService.hashKey(rawKey),
        }),
      );

      const result = await service.validate(rawKey);
      expect(result.userId).toBe('user-uuid-1');
      expect(result.scopes).toContain(UserApiKeyScope.READ);
    });

    it('should throw UnauthorizedException for missing prefix', async () => {
      await expect(service.validate('invalid-key')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for empty string', async () => {
      await expect(service.validate('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for key not in DB', async () => {
      vi.mocked(prisma.apiKey!.findUnique).mockResolvedValue(null);
      await expect(service.validate(rawKey)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked key', async () => {
      vi.mocked(prisma.apiKey!.findUnique).mockResolvedValue(
        makeApiKeyRecord({ revokedAt: new Date() }),
      );
      await expect(service.validate(rawKey)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired key', async () => {
      vi.mocked(prisma.apiKey!.findUnique).mockResolvedValue(
        makeApiKeyRecord({ expiresAt: new Date('2020-01-01') }),
      );
      await expect(service.validate(rawKey)).rejects.toThrow(UnauthorizedException);
    });

    it('should fire-and-forget lastUsedAt update', async () => {
      vi.mocked(prisma.apiKey!.findUnique).mockResolvedValue(makeApiKeyRecord());
      vi.mocked(prisma.apiKey!.update).mockRejectedValue(new Error('DB timeout'));

      // Should not propagate the update failure
      const result = await service.validate(rawKey);
      expect(result.userId).toBe('user-uuid-1');
    });
  });

  // ── assertScope ────────────────────────────────────────────────────────────

  describe('assertScope', () => {
    it('should pass when key has the required scope', () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        scopes: [UserApiKeyScope.READ],
      };
      expect(() => service.assertScope(key, UserApiKeyScope.READ)).not.toThrow();
    });

    it('should throw ForbiddenException when scope is missing', () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        scopes: [UserApiKeyScope.READ],
      };
      expect(() => service.assertScope(key, UserApiKeyScope.WRITE)).toThrow(ForbiddenException);
    });

    it('should allow ADMIN scope to cover all other scopes', () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        scopes: [UserApiKeyScope.ADMIN],
      };
      expect(() => service.assertScope(key, UserApiKeyScope.READ)).not.toThrow();
      expect(() => service.assertScope(key, UserApiKeyScope.WRITE)).not.toThrow();
    });

    it('should allow WRITE scope to cover READ', () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        scopes: [UserApiKeyScope.WRITE],
      };
      expect(() => service.assertScope(key, UserApiKeyScope.READ)).not.toThrow();
    });

    it('should not allow WRITE scope to cover ADMIN', () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        scopes: [UserApiKeyScope.WRITE],
      };
      expect(() => service.assertScope(key, UserApiKeyScope.ADMIN)).toThrow(ForbiddenException);
    });
  });

  // ── checkRateLimit ─────────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('should return true when under limit', async () => {
      const result = await service.checkRateLimit('key-1');
      expect(result).toBe(true);
    });

    it('should return false when over limit', async () => {
      const mockClient = valkey.getClient!();
      vi.mocked(mockClient.incr).mockResolvedValue(121);

      const result = await service.checkRateLimit('key-1');
      expect(result).toBe(false);
    });

    it('should fail open when ValKey is unavailable', async () => {
      vi.mocked(valkey.getClient!()).incr.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkRateLimit('key-1');
      expect(result).toBe(true);
    });

    it('should set expiry on first increment', async () => {
      const mockClient = valkey.getClient!();
      vi.mocked(mockClient.incr).mockResolvedValue(1);

      await service.checkRateLimit('key-1');
      expect(mockClient.expire).toHaveBeenCalledOnce();
    });

    it('should not set expiry on subsequent increments', async () => {
      const mockClient = valkey.getClient!();
      vi.mocked(mockClient.incr).mockResolvedValue(5);

      await service.checkRateLimit('key-1');
      expect(mockClient.expire).not.toHaveBeenCalled();
    });
  });
});
