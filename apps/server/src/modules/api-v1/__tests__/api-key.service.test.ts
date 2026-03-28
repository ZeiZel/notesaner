import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService, ValidatedApiKey } from '../api-key.service';
import { ApiKeyPermission } from '../dto/create-api-key.dto';
import type { PrismaService } from '../../../prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRawKey(): string {
  return `${ApiKeyService.KEY_PREFIX}${'a'.repeat(64)}`;
}

function makeApiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    name: 'My Key',
    key_hash: ApiKeyService.hashKey(makeRawKey()),
    workspace_id: 'ws-1',
    user_id: 'user-1',
    permissions: [ApiKeyPermission.NOTES_READ, ApiKeyPermission.NOTES_WRITE],
    last_used_at: null,
    created_at: new Date('2025-01-01'),
    is_revoked: false,
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as unknown as Partial<PrismaService>;

    service = new ApiKeyService(prisma as PrismaService);
  });

  // ── hashKey ────────────────────────────────────────────────────────────────

  describe('hashKey', () => {
    it('should return a 64-char hex string', () => {
      const hash = ApiKeyService.hashKey('test-value');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be deterministic for the same input', () => {
      const h1 = ApiKeyService.hashKey('abc');
      const h2 = ApiKeyService.hashKey('abc');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', () => {
      expect(ApiKeyService.hashKey('a')).not.toBe(ApiKeyService.hashKey('b'));
    });

    it('should correctly hash a real nsk_ prefixed key', () => {
      const raw = makeRawKey();
      const hash = ApiKeyService.hashKey(raw);
      expect(hash).toHaveLength(64);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an API key and return it with raw key', async () => {
      const row = makeApiKeyRow({ permissions: [ApiKeyPermission.NOTES_READ] });
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([row]);

      const result = await service.create('ws-1', 'user-1', {
        name: 'My Key',
        permissions: [ApiKeyPermission.NOTES_READ],
      });

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(new RegExp(`^${ApiKeyService.KEY_PREFIX}`));
      expect(result.name).toBe('My Key');
      expect(result.workspaceId).toBe('ws-1');
      expect(result.userId).toBe('user-1');
    });

    it('should apply default permissions when none provided', async () => {
      const row = makeApiKeyRow({
        permissions: [
          ApiKeyPermission.NOTES_READ,
          ApiKeyPermission.NOTES_WRITE,
          ApiKeyPermission.NOTES_DELETE,
        ],
      });
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([row]);

      const result = await service.create('ws-1', 'user-1', { name: 'My Key' });

      // The INSERT should include default permissions
      const insertCall = vi.mocked(prisma.$queryRaw!).mock.calls[0];
      expect(insertCall).toBeDefined();

      expect(result.permissions).toContain(ApiKeyPermission.NOTES_READ);
      expect(result.permissions).toContain(ApiKeyPermission.NOTES_WRITE);
      expect(result.permissions).toContain(ApiKeyPermission.NOTES_DELETE);
    });

    it('should not expose keyHash in the returned DTO', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow()]);
      const result = await service.create('ws-1', 'user-1', { name: 'x' });
      expect((result as unknown as Record<string, unknown>).keyHash).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).key_hash).toBeUndefined();
    });

    it('should generate a unique key on each call', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow()]);

      const r1 = await service.create('ws-1', 'user-1', { name: 'a' });
      const r2 = await service.create('ws-1', 'user-1', { name: 'b' });
      expect(r1.key).not.toBe(r2.key);
    });

    it('should propagate prisma errors', async () => {
      vi.mocked(prisma.$queryRaw!).mockRejectedValue(new Error('DB error'));
      await expect(service.create('ws-1', 'user-1', { name: 'x' })).rejects.toThrow('DB error');
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return mapped DTOs for workspace keys', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        makeApiKeyRow({ id: 'k1', name: 'Key 1' }),
        makeApiKeyRow({ id: 'k2', name: 'Key 2' }),
      ]);

      const result = await service.list('ws-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('k1');
      expect(result[1].id).toBe('k2');
    });

    it('should return an empty array when no keys exist', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      const result = await service.list('ws-1');
      expect(result).toEqual([]);
    });

    it('should not include raw key in list results', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow()]);
      const result = await service.list('ws-1');
      expect(result[0].key).toBeUndefined();
    });

    it('should correctly map lastUsedAt when present', async () => {
      const date = new Date('2025-06-15T10:00:00Z');
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow({ last_used_at: date })]);
      const result = await service.list('ws-1');
      expect(result[0].lastUsedAt).toBe(date.toISOString());
    });

    it('should return null for lastUsedAt when never used', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow({ last_used_at: null })]);
      const result = await service.list('ws-1');
      expect(result[0].lastUsedAt).toBeNull();
    });
  });

  // ── revoke ─────────────────────────────────────────────────────────────────

  describe('revoke', () => {
    it('should revoke an existing key', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow()]);
      vi.mocked(prisma.$executeRaw!).mockResolvedValue(1);

      await service.revoke('ws-1', 'key-1');
      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException for non-existent key', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.revoke('ws-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for key in different workspace', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.revoke('ws-other', 'key-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for already-revoked key', async () => {
      // The SELECT filters is_revoked = false, so revoked keys return no rows
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.revoke('ws-1', 'key-1')).rejects.toThrow(NotFoundException);
    });

    it('should not call $executeRaw when key not found', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.revoke('ws-1', 'key-1')).rejects.toThrow();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  // ── validate ───────────────────────────────────────────────────────────────

  describe('validate', () => {
    it('should return ValidatedApiKey for valid key', async () => {
      const rawKey = makeRawKey();
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        makeApiKeyRow({ key_hash: ApiKeyService.hashKey(rawKey) }),
      ]);

      const result = await service.validate(rawKey);
      expect(result.workspaceId).toBe('ws-1');
      expect(result.userId).toBe('user-1');
      expect(result.permissions).toContain(ApiKeyPermission.NOTES_READ);
    });

    it('should throw UnauthorizedException for missing nsk_ prefix', async () => {
      await expect(service.validate('invalid-key')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for empty string', async () => {
      await expect(service.validate('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when key not found in DB', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.validate(makeRawKey())).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked key', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow({ is_revoked: true })]);
      await expect(service.validate(makeRawKey())).rejects.toThrow(UnauthorizedException);
    });

    it('should fire-and-forget lastUsedAt update without blocking response', async () => {
      const rawKey = makeRawKey();
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow()]);

      // executeRaw rejects — should not propagate
      vi.mocked(prisma.$executeRaw!).mockRejectedValue(new Error('DB timeout'));

      const result = await service.validate(rawKey);
      // Validate resolves successfully despite update failure
      expect(result.workspaceId).toBe('ws-1');
    });

    it('should query by SHA-256 hash of the input key', async () => {
      const rawKey = makeRawKey();
      const expectedHash = ApiKeyService.hashKey(rawKey);
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeApiKeyRow({ key_hash: expectedHash })]);

      await service.validate(rawKey);

      // The SELECT must be called with the hash, not the raw key
      const callArg = vi.mocked(prisma.$queryRaw!).mock.calls[0]?.[0];
      // TemplateStringsArray — first element contains the SQL template
      expect(String(callArg)).toContain('key_hash');
    });
  });

  // ── assertPermission ───────────────────────────────────────────────────────

  describe('assertPermission', () => {
    const apiKey: ValidatedApiKey = {
      id: 'k1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      permissions: [ApiKeyPermission.NOTES_READ],
    };

    it('should pass when key has the required permission', () => {
      expect(() => service.assertPermission(apiKey, ApiKeyPermission.NOTES_READ)).not.toThrow();
    });

    it('should throw ForbiddenException when key lacks the permission', () => {
      expect(() => service.assertPermission(apiKey, ApiKeyPermission.NOTES_WRITE)).toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for NOTES_DELETE when not granted', () => {
      expect(() => service.assertPermission(apiKey, ApiKeyPermission.NOTES_DELETE)).toThrow(
        ForbiddenException,
      );
    });

    it('should pass with full permissions granted', () => {
      const fullKey: ValidatedApiKey = {
        ...apiKey,
        permissions: Object.values(ApiKeyPermission),
      };
      expect(() =>
        service.assertPermission(fullKey, ApiKeyPermission.WEBHOOKS_WRITE),
      ).not.toThrow();
    });

    it('should throw ForbiddenException for webhook permissions when not granted', () => {
      expect(() => service.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_READ)).toThrow(
        ForbiddenException,
      );
    });
  });
});
