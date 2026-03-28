import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserApiKeyController } from '../api-key.controller';
import { UserApiKeyService } from '../api-key.service';
import { UserApiKeyScope } from '../dto/create-api-key.dto';
import type { JwtPayload } from '../../../../common/decorators/current-user.decorator';
import type { CreatedApiKeyResponseDto, UserApiKeyResponseDto } from '../dto/list-api-keys.dto';

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
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockService() {
  return {
    create: vi.fn(),
    list: vi.fn(),
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

      expect((result[0] as Record<string, unknown>)['key']).toBeUndefined();
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
