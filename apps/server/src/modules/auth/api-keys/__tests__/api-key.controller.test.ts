import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserApiKeyController } from '../api-key.controller';
import { UserApiKeyService } from '../api-key.service';
import { UserApiKeyScope } from '../dto/create-api-key.dto';
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator';
import type {
  CreatedApiKeyResponseDto,
  RotatedApiKeyResponseDto,
  UserApiKeyResponseDto,
} from '../dto/list-api-keys.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockUser(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-uuid-1',
    email: 'test@example.com',
    isSuperAdmin: false,
    sessionId: 'session-uuid-1',
    ...overrides,
  };
}

function makeCreatedKeyResponse(
  overrides: Partial<CreatedApiKeyResponseDto> = {},
): CreatedApiKeyResponseDto {
  return {
    id: 'key-uuid-1',
    name: 'Test Key',
    prefix: 'nts_a1b2',
    scopes: [UserApiKeyScope.READ],
    expiresAt: null,
    lastUsedAt: null,
    requestCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    key: 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz0123456789',
    ...overrides,
  };
}

function makeListKeyResponse(
  overrides: Partial<UserApiKeyResponseDto> = {},
): UserApiKeyResponseDto {
  return {
    id: 'key-uuid-1',
    name: 'Test Key',
    prefix: 'nts_a1b2',
    scopes: [UserApiKeyScope.READ],
    expiresAt: null,
    lastUsedAt: null,
    requestCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRotatedKeyResponse(
  overrides: Partial<RotatedApiKeyResponseDto> = {},
): RotatedApiKeyResponseDto {
  return {
    revokedKeyId: 'key-uuid-1',
    newKey: makeCreatedKeyResponse({ id: 'key-uuid-new', prefix: 'nts_newp' }),
    ...overrides,
  };
}

function makeMockService() {
  return {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
  } as unknown as UserApiKeyService;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UserApiKeyController', () => {
  let controller: UserApiKeyController;
  let service: ReturnType<typeof makeMockService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeMockService();
    // Instantiate directly -- avoids NestJS DI complexity in unit tests
    controller = new UserApiKeyController(service);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an API key and return it with the raw key', async () => {
      const user = makeMockUser();
      const dto = { name: 'CI Pipeline', scopes: [UserApiKeyScope.READ, UserApiKeyScope.WRITE] };
      const createdKey = makeCreatedKeyResponse({
        name: 'CI Pipeline',
        scopes: [UserApiKeyScope.READ, UserApiKeyScope.WRITE],
      });

      vi.mocked(service.create).mockResolvedValue(createdKey);

      const result = await controller.create(user, dto);

      expect(service.create).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result.key).toBeDefined();
      expect(result.name).toBe('CI Pipeline');
    });

    it('should pass user ID from JWT payload to service', async () => {
      const user = makeMockUser({ sub: 'custom-user-id' });
      const dto = { name: 'Test' };

      vi.mocked(service.create).mockResolvedValue(makeCreatedKeyResponse());

      await controller.create(user, dto);

      expect(service.create).toHaveBeenCalledWith('custom-user-id', dto);
    });

    it('should propagate BadRequestException from service', async () => {
      const user = makeMockUser();
      const dto = { name: 'Too Many' };

      vi.mocked(service.create).mockRejectedValue(
        new BadRequestException('Maximum of 10 active API keys per user reached.'),
      );

      await expect(controller.create(user, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return list of active API keys', async () => {
      const user = makeMockUser();
      const keys = [
        makeListKeyResponse({ id: 'k1', name: 'Key 1' }),
        makeListKeyResponse({ id: 'k2', name: 'Key 2' }),
      ];

      vi.mocked(service.list).mockResolvedValue(keys);

      const result = await controller.list(user);

      expect(service.list).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('k1');
      expect(result[1].id).toBe('k2');
    });

    it('should return empty array when user has no keys', async () => {
      vi.mocked(service.list).mockResolvedValue([]);

      const result = await controller.list(makeMockUser());

      expect(result).toEqual([]);
    });

    it('should not expose raw key in list results', async () => {
      vi.mocked(service.list).mockResolvedValue([makeListKeyResponse()]);

      const result = await controller.list(makeMockUser());

      expect((result[0] as unknown as Record<string, unknown>)['key']).toBeUndefined();
    });

    it('should include requestCount in list results', async () => {
      const keys = [makeListKeyResponse({ requestCount: 15 })];
      vi.mocked(service.list).mockResolvedValue(keys);

      const result = await controller.list(makeMockUser());

      expect(result[0].requestCount).toBe(15);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return a single API key by ID', async () => {
      const user = makeMockUser();
      const key = makeListKeyResponse({ requestCount: 7 });

      vi.mocked(service.getById).mockResolvedValue(key);

      const result = await controller.getById(user, 'key-uuid-1');

      expect(service.getById).toHaveBeenCalledWith('user-uuid-1', 'key-uuid-1');
      expect(result.id).toBe('key-uuid-1');
      expect(result.requestCount).toBe(7);
    });

    it('should propagate NotFoundException from service', async () => {
      vi.mocked(service.getById).mockRejectedValue(
        new NotFoundException('API key not found or already revoked'),
      );

      await expect(controller.getById(makeMockUser(), 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not expose raw key in getById result', async () => {
      vi.mocked(service.getById).mockResolvedValue(makeListKeyResponse());

      const result = await controller.getById(makeMockUser(), 'key-uuid-1');

      expect((result as unknown as Record<string, unknown>)['key']).toBeUndefined();
    });
  });

  // ── rotate ────────────────────────────────────────────────────────────────

  describe('rotate', () => {
    it('should rotate an API key and return the rotation response', async () => {
      const user = makeMockUser();
      const rotated = makeRotatedKeyResponse();

      vi.mocked(service.rotate).mockResolvedValue(rotated);

      const result = await controller.rotate(user, 'key-uuid-1');

      expect(service.rotate).toHaveBeenCalledWith('user-uuid-1', 'key-uuid-1');
      expect(result.revokedKeyId).toBe('key-uuid-1');
      expect(result.newKey.key).toBeDefined();
    });

    it('should pass user ID from JWT payload to service', async () => {
      const user = makeMockUser({ sub: 'other-user-id' });
      vi.mocked(service.rotate).mockResolvedValue(makeRotatedKeyResponse());

      await controller.rotate(user, 'key-uuid-1');

      expect(service.rotate).toHaveBeenCalledWith('other-user-id', 'key-uuid-1');
    });

    it('should propagate NotFoundException from service', async () => {
      vi.mocked(service.rotate).mockRejectedValue(
        new NotFoundException('API key not found or already revoked'),
      );

      await expect(controller.rotate(makeMockUser(), 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should expose the raw key of the new key in the rotation response', async () => {
      const rotated = makeRotatedKeyResponse();
      vi.mocked(service.rotate).mockResolvedValue(rotated);

      const result = await controller.rotate(makeMockUser(), 'key-uuid-1');

      expect(result.newKey.key).toMatch(/^nts_/);
    });

    it('should include revokedKeyId pointing to the old key', async () => {
      const rotated = makeRotatedKeyResponse({ revokedKeyId: 'old-key-id' });
      vi.mocked(service.rotate).mockResolvedValue(rotated);

      const result = await controller.rotate(makeMockUser(), 'old-key-id');

      expect(result.revokedKeyId).toBe('old-key-id');
    });
  });

  // ── revoke ────────────────────────────────────────────────────────────────

  describe('revoke', () => {
    it('should revoke an API key by ID', async () => {
      const user = makeMockUser();
      vi.mocked(service.revoke).mockResolvedValue(undefined);

      await controller.revoke(user, 'key-uuid-1');

      expect(service.revoke).toHaveBeenCalledWith('user-uuid-1', 'key-uuid-1');
    });

    it('should propagate NotFoundException from service', async () => {
      vi.mocked(service.revoke).mockRejectedValue(
        new NotFoundException('API key not found or already revoked'),
      );

      await expect(controller.revoke(makeMockUser(), 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not allow revoking another user key', async () => {
      const user = makeMockUser({ sub: 'different-user' });
      vi.mocked(service.revoke).mockRejectedValue(
        new NotFoundException('API key not found or already revoked'),
      );

      await expect(controller.revoke(user, 'key-uuid-1')).rejects.toThrow(NotFoundException);
      expect(service.revoke).toHaveBeenCalledWith('different-user', 'key-uuid-1');
    });
  });
});
