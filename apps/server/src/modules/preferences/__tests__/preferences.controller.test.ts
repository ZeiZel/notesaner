import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PreferencesController } from '../preferences.controller';
import { PreferencesService, PreferenceResponse } from '../preferences.service';
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
    key: 'theme',
    value: 'dark',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makePreferencesService(): Record<keyof PreferencesService, ReturnType<typeof vi.fn>> {
  return {
    getAll: vi.fn().mockResolvedValue([]),
    getByKey: vi.fn().mockResolvedValue(makePreferenceResponse()),
    set: vi.fn().mockResolvedValue(makePreferenceResponse()),
    bulkSet: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
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

  // ─── GET /api/preferences ──────────────────────────────────────────────────

  describe('getAll()', () => {
    it('delegates to service.getAll with the user id', async () => {
      await controller.getAll(user);
      expect(service.getAll).toHaveBeenCalledWith('user-1');
    });

    it('returns the list from the service', async () => {
      const prefs = [
        makePreferenceResponse({ key: 'theme', value: 'dark' }),
        makePreferenceResponse({ key: 'locale', value: 'en' }),
      ];
      service.getAll.mockResolvedValue(prefs);

      const result = await controller.getAll(user);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('theme');
      expect(result[1].key).toBe('locale');
    });
  });

  // ─── GET /api/preferences/:key ────────────────────────────────────────────

  describe('getByKey()', () => {
    it('delegates to service.getByKey with user id and key', async () => {
      await controller.getByKey(user, 'theme');
      expect(service.getByKey).toHaveBeenCalledWith('user-1', 'theme');
    });

    it('returns the preference from the service', async () => {
      service.getByKey.mockResolvedValue(makePreferenceResponse({ key: 'theme', value: 'dark' }));

      const result = await controller.getByKey(user, 'theme');

      expect(result.key).toBe('theme');
      expect(result.value).toBe('dark');
    });

    it('propagates NotFoundException from the service', async () => {
      service.getByKey.mockRejectedValue(
        new NotFoundException('Preference with key "missing" not found'),
      );

      await expect(controller.getByKey(user, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── PUT /api/preferences/:key ────────────────────────────────────────────

  describe('set()', () => {
    it('delegates to service.set with user id, key, and value', async () => {
      service.set.mockResolvedValue(makePreferenceResponse({ key: 'theme', value: 'dark' }));

      const result = await controller.set(user, 'theme', { value: 'dark' });

      expect(service.set).toHaveBeenCalledWith('user-1', 'theme', 'dark');
      expect(result.value).toBe('dark');
    });

    it('handles complex JSON values', async () => {
      const complexValue = { fontSize: 16, fontFamily: 'Inter' };
      service.set.mockResolvedValue(makePreferenceResponse({ key: 'editor', value: complexValue }));

      const result = await controller.set(user, 'editor', { value: complexValue });

      expect(service.set).toHaveBeenCalledWith('user-1', 'editor', complexValue);
      expect(result.value).toEqual(complexValue);
    });
  });

  // ─── PUT /api/preferences/bulk ────────────────────────────────────────────

  describe('bulkSet()', () => {
    it('delegates to service.bulkSet with user id and entries', async () => {
      const dto = {
        preferences: [
          { key: 'theme', value: 'dark' },
          { key: 'locale', value: 'en' },
        ],
      };
      service.bulkSet.mockResolvedValue([
        makePreferenceResponse({ key: 'theme', value: 'dark' }),
        makePreferenceResponse({ key: 'locale', value: 'en' }),
      ]);

      const result = await controller.bulkSet(user, dto);

      expect(service.bulkSet).toHaveBeenCalledWith('user-1', dto.preferences);
      expect(result).toHaveLength(2);
    });
  });

  // ─── DELETE /api/preferences/:key ─────────────────────────────────────────

  describe('delete()', () => {
    it('delegates to service.delete with user id and key', async () => {
      await controller.delete(user, 'theme');
      expect(service.delete).toHaveBeenCalledWith('user-1', 'theme');
    });

    it('propagates NotFoundException for missing key', async () => {
      service.delete.mockRejectedValue(
        new NotFoundException('Preference with key "missing" not found'),
      );

      await expect(controller.delete(user, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns void on success', async () => {
      const result = await controller.delete(user, 'theme');
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
