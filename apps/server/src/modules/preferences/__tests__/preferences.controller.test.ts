import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PreferencesController } from '../preferences.controller';
import { PreferencesService, PreferenceResponse, PreferencesMap } from '../preferences.service';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'alice@example.com',
    isSuperAdmin: false,
    sessionId: 'session-1',
    ...overrides,
  };
}

function makePreferenceResponse(overrides: Partial<PreferenceResponse> = {}): PreferenceResponse {
  return {
    key: 'theme.mode',
    value: 'dark',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makePreferencesMap(overrides: PreferencesMap = {}): PreferencesMap {
  return {
    'theme.mode': 'dark',
    'editor.fontSize': 16,
    ...overrides,
  };
}

function makePreferencesService(): Record<keyof PreferencesService, ReturnType<typeof vi.fn>> {
  return {
    getAll: vi.fn().mockResolvedValue(makePreferencesMap()),
    getByKey: vi.fn().mockResolvedValue(makePreferenceResponse()),
    set: vi.fn().mockResolvedValue(makePreferenceResponse()),
    bulkSet: vi.fn().mockResolvedValue(makePreferencesMap()),
    delete: vi.fn().mockResolvedValue(undefined),
    validateNamespace: vi.fn(),
    validateValueSize: vi.fn(),
    validateKeyLimit: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PreferencesController', () => {
  let controller: PreferencesController;
  let service: ReturnType<typeof makePreferencesService>;
  let user: JwtPayload;

  beforeEach(() => {
    service = makePreferencesService();
    controller = new PreferencesController(service as unknown as PreferencesService);
    user = makeUser();
  });

  // ─── GET /users/me/preferences ────────────────────────────────────────────

  describe('getAll()', () => {
    it('delegates to service.getAll with the user id', async () => {
      await controller.getAll(user);
      expect(service.getAll).toHaveBeenCalledWith('user-1');
    });

    it('returns the preferences map from the service', async () => {
      const map = makePreferencesMap({
        'theme.mode': 'dark',
        'editor.fontSize': 16,
        'sidebar.collapsed': false,
      });
      service.getAll.mockResolvedValue(map);

      const result = await controller.getAll(user);

      expect(result['theme.mode']).toBe('dark');
      expect(result['editor.fontSize']).toBe(16);
      expect(result['sidebar.collapsed']).toBe(false);
    });
  });

  // ─── GET /users/me/preferences/:key ──────────────────────────────────────

  describe('getByKey()', () => {
    it('delegates to service.getByKey with user id and key', async () => {
      await controller.getByKey(user, 'theme.mode');
      expect(service.getByKey).toHaveBeenCalledWith('user-1', 'theme.mode');
    });

    it('returns the preference from the service', async () => {
      service.getByKey.mockResolvedValue(
        makePreferenceResponse({ key: 'theme.mode', value: 'dark' }),
      );

      const result = await controller.getByKey(user, 'theme.mode');

      expect(result.key).toBe('theme.mode');
      expect(result.value).toBe('dark');
    });

    it('propagates NotFoundException from the service', async () => {
      service.getByKey.mockRejectedValue(
        new NotFoundException('Preference with key "missing" not found'),
      );

      await expect(controller.getByKey(user, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException for invalid namespace', async () => {
      service.getByKey.mockRejectedValue(new BadRequestException('Invalid preference key'));

      await expect(controller.getByKey(user, 'invalid.key')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── PATCH /users/me/preferences/:key ────────────────────────────────────

  describe('set()', () => {
    it('delegates to service.set with user id, key, and value', async () => {
      service.set.mockResolvedValue(makePreferenceResponse({ key: 'theme.mode', value: 'dark' }));

      const result = await controller.set(user, 'theme.mode', { value: 'dark' });

      expect(service.set).toHaveBeenCalledWith('user-1', 'theme.mode', 'dark');
      expect(result.value).toBe('dark');
    });

    it('handles complex JSON values', async () => {
      const complexValue = { fontSize: 16, fontFamily: 'Inter' };
      service.set.mockResolvedValue(
        makePreferenceResponse({ key: 'editor.config', value: complexValue }),
      );

      const result = await controller.set(user, 'editor.config', { value: complexValue });

      expect(service.set).toHaveBeenCalledWith('user-1', 'editor.config', complexValue);
      expect(result.value).toEqual(complexValue);
    });
  });

  // ─── PATCH /users/me/preferences ──────────────────────────────────────────

  describe('bulkSet()', () => {
    it('delegates to service.bulkSet with user id and entries', async () => {
      const dto = {
        preferences: [
          { key: 'theme.mode', value: 'dark' },
          { key: 'editor.fontSize', value: 16 },
        ],
      };
      const map = makePreferencesMap({
        'theme.mode': 'dark',
        'editor.fontSize': 16,
      });
      service.bulkSet.mockResolvedValue(map);

      const result = await controller.bulkSet(user, dto);

      expect(service.bulkSet).toHaveBeenCalledWith('user-1', dto.preferences);
      expect(result['theme.mode']).toBe('dark');
      expect(result['editor.fontSize']).toBe(16);
    });
  });

  // ─── DELETE /users/me/preferences/:key ───────────────────────────────────

  describe('delete()', () => {
    it('delegates to service.delete with user id and key', async () => {
      await controller.delete(user, 'theme.mode');
      expect(service.delete).toHaveBeenCalledWith('user-1', 'theme.mode');
    });

    it('propagates NotFoundException for missing key', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('Preference with key "missing" not found'),
      );

      await expect(controller.delete(user, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns void on success', async () => {
      const result = await controller.delete(user, 'theme.mode');
      expect(result).toBeUndefined();
    });
  });

  // ─── User isolation ────────────────────────────────────────────────────────

  describe('user isolation', () => {
    it('always passes the authenticated user id to the service', async () => {
      const alice = makeUser({ sub: 'alice-id' });
      const bob = makeUser({ sub: 'bob-id' });

      await controller.getAll(alice);
      await controller.getAll(bob);

      expect(service.getAll).toHaveBeenNthCalledWith(1, 'alice-id');
      expect(service.getAll).toHaveBeenNthCalledWith(2, 'bob-id');
    });
  });
});
