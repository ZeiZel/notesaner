import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PreferencesService } from '../preferences.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';
import {
  DEFAULT_PREFERENCES,
  MAX_PREFERENCES_PER_USER,
  MAX_PREFERENCE_VALUE_BYTES,
} from '../preferences.constants';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makePrismaService() {
  return {
    userPreference: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  } as unknown as PrismaService;
}

function makeValkeyService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as ValkeyService;
}

function buildService() {
  const prisma = makePrismaService();
  const valkey = makeValkeyService();
  const service = new PreferencesService(prisma, valkey);
  return { service, prisma, valkey };
}

/** Build a mock UserPreference record as Prisma would return it. */
function makePref(
  overrides: Partial<{
    id: string;
    userId: string;
    key: string;
    value: unknown;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'pref-1',
    userId: 'user-1',
    key: 'theme.mode',
    value: 'dark',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PreferencesService', () => {
  // ─── Namespace validation ─────────────────────────────────────────────────

  describe('validateNamespace()', () => {
    let service: PreferencesService;

    beforeEach(() => {
      ({ service } = buildService());
    });

    it('accepts valid namespaced keys', () => {
      const validKeys = [
        'theme',
        'theme.mode',
        'theme.accentColor',
        'editor',
        'editor.fontSize',
        'editor.fontFamily',
        'sidebar',
        'sidebar.collapsed',
        'sidebar.width',
        'notifications',
        'notifications.enabled',
        'notifications.sound',
        'keybindings',
        'keybindings.preset',
      ];
      for (const key of validKeys) {
        expect(() => service.validateNamespace(key)).not.toThrow();
      }
    });

    it('rejects keys outside allowed namespaces', () => {
      const invalidKeys = ['invalid', 'custom.setting', 'system.admin', 'foo.bar'];
      for (const key of invalidKeys) {
        expect(() => service.validateNamespace(key)).toThrow(BadRequestException);
      }
    });

    it('rejects empty string', () => {
      expect(() => service.validateNamespace('')).toThrow(BadRequestException);
    });
  });

  // ─── Value size validation ────────────────────────────────────────────────

  describe('validateValueSize()', () => {
    let service: PreferencesService;

    beforeEach(() => {
      ({ service } = buildService());
    });

    it('accepts values under 64KB', () => {
      expect(() => service.validateValueSize('theme.mode', 'dark')).not.toThrow();
      expect(() => service.validateValueSize('editor.fontSize', 16)).not.toThrow();
      expect(() => service.validateValueSize('sidebar.collapsed', false)).not.toThrow();
    });

    it('rejects values exceeding 64KB', () => {
      const largeValue = 'x'.repeat(MAX_PREFERENCE_VALUE_BYTES + 1);
      expect(() => service.validateValueSize('theme.mode', largeValue)).toThrow(
        BadRequestException,
      );
    });

    it('accepts values at exactly 64KB', () => {
      // JSON.stringify wraps string in quotes, so account for that
      const targetJsonSize = MAX_PREFERENCE_VALUE_BYTES;
      const padding = JSON.stringify('').length; // 2 for the quotes
      const value = 'x'.repeat(targetJsonSize - padding);
      expect(() => service.validateValueSize('theme.mode', value)).not.toThrow();
    });
  });

  // ─── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns a key-value map merged with defaults', async () => {
      const { service, prisma } = buildService();
      const prefs = [
        makePref({ key: 'theme.mode', value: 'dark' }),
        makePref({ key: 'editor.fontSize', value: 20 }),
      ];
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await service.getAll('user-1');

      // Stored values should override defaults
      expect(result['theme.mode']).toBe('dark');
      expect(result['editor.fontSize']).toBe(20);
      // Default values should be present for non-stored keys
      expect(result['sidebar.collapsed']).toBe(DEFAULT_PREFERENCES['sidebar.collapsed']);
      expect(result['notifications.enabled']).toBe(DEFAULT_PREFERENCES['notifications.enabled']);
    });

    it('returns only defaults when user has no stored preferences', async () => {
      const { service } = buildService();
      const result = await service.getAll('user-1');

      expect(result).toEqual(DEFAULT_PREFERENCES);
    });

    it('serves from cache when available', async () => {
      const { service, prisma, valkey } = buildService();
      const cached = JSON.stringify({ 'theme.mode': 'light' });
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(cached);

      const result = await service.getAll('user-1');

      expect(result).toEqual({ 'theme.mode': 'light' });
      // Database should NOT have been called
      expect(prisma.userPreference.findMany).not.toHaveBeenCalled();
    });

    it('falls back to database when cache read fails', async () => {
      const { service, prisma, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ValKey down'));
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        makePref({ key: 'theme.mode', value: 'dark' }),
      ]);

      const result = await service.getAll('user-1');

      expect(result['theme.mode']).toBe('dark');
      expect(prisma.userPreference.findMany).toHaveBeenCalledOnce();
    });

    it('populates cache after database read', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        makePref({ key: 'theme.mode', value: 'dark' }),
      ]);

      await service.getAll('user-1');

      expect(valkey.set).toHaveBeenCalledWith('prefs:user-1', expect.any(String), 300);
    });
  });

  // ─── getByKey() ────────────────────────────────────────────────────────────

  describe('getByKey()', () => {
    it('returns a single stored preference by key', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme.mode', value: 'dark' });
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.getByKey('user-1', 'theme.mode');

      expect(result.key).toBe('theme.mode');
      expect(result.value).toBe('dark');
      expect(result.updatedAt).toBe('2026-01-15T10:00:00.000Z');
    });

    it('returns default value when key is not stored but has a default', async () => {
      const { service } = buildService();

      const result = await service.getByKey('user-1', 'theme.mode');

      expect(result.key).toBe('theme.mode');
      expect(result.value).toBe(DEFAULT_PREFERENCES['theme.mode']);
      // Default values use epoch as updatedAt
      expect(result.updatedAt).toBe(new Date(0).toISOString());
    });

    it('throws NotFoundException when key has no stored value and no default', async () => {
      const { service } = buildService();

      await expect(service.getByKey('user-1', 'theme.custom')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid namespace', async () => {
      const { service } = buildService();

      await expect(service.getByKey('user-1', 'invalid.key')).rejects.toThrow(BadRequestException);
    });

    it('serves from cache when available', async () => {
      const { service, prisma, valkey } = buildService();
      const cached = JSON.stringify({
        key: 'theme.mode',
        value: 'light',
        updatedAt: '2026-01-15T10:00:00.000Z',
      });
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(cached);

      const result = await service.getByKey('user-1', 'theme.mode');

      expect(result.value).toBe('light');
      expect(prisma.userPreference.findUnique).not.toHaveBeenCalled();
    });

    it('populates single-key cache after database read', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme.mode', value: 'dark' }),
      );

      await service.getByKey('user-1', 'theme.mode');

      expect(valkey.set).toHaveBeenCalledWith('prefs:user-1:theme.mode', expect.any(String), 300);
    });
  });

  // ─── set() ─────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('upserts a preference and returns the response', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme.mode', value: 'dark' });
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.set('user-1', 'theme.mode', 'dark');

      expect(result.key).toBe('theme.mode');
      expect(result.value).toBe('dark');
      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'theme.mode' } },
        create: { userId: 'user-1', key: 'theme.mode', value: 'dark' },
        update: { value: 'dark' },
      });
    });

    it('invalidates both single and all-prefs cache entries', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme.mode', value: 'dark' }),
      );

      await service.set('user-1', 'theme.mode', 'dark');

      expect(valkey.del).toHaveBeenCalledWith('prefs:user-1:theme.mode', 'prefs:user-1');
    });

    it('handles complex JSON values', async () => {
      const { service, prisma } = buildService();
      const complexValue = { fontSize: 16, fontFamily: 'Inter', ligatures: true };
      const pref = makePref({ key: 'editor.config', value: complexValue });
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.set('user-1', 'editor.config', complexValue);

      expect(result.value).toEqual(complexValue);
    });

    it('throws BadRequestException for invalid namespace', async () => {
      const { service } = buildService();

      await expect(service.set('user-1', 'invalid.key', 'value')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when value exceeds 64KB', async () => {
      const { service } = buildService();
      const largeValue = 'x'.repeat(MAX_PREFERENCE_VALUE_BYTES + 1);

      await expect(service.set('user-1', 'theme.mode', largeValue)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when key limit would be exceeded', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(MAX_PREFERENCES_PER_USER) // existing total
        .mockResolvedValueOnce(0); // none of the new keys exist

      await expect(service.set('user-1', 'theme.newKey', 'value')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows upsert when the key already exists (does not increase count)', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(MAX_PREFERENCES_PER_USER) // existing total at limit
        .mockResolvedValueOnce(1); // this key already exists
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme.mode', value: 'dark' }),
      );

      // Should NOT throw because the key already exists (net new = 0)
      await expect(service.set('user-1', 'theme.mode', 'dark')).resolves.toBeDefined();
    });

    it('does not throw when cache invalidation fails', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());
      (valkey.del as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ValKey down'));

      // Should NOT throw
      await expect(service.set('user-1', 'theme.mode', 'dark')).resolves.toBeDefined();
    });
  });

  // ─── bulkSet() ─────────────────────────────────────────────────────────────

  describe('bulkSet()', () => {
    it('upserts multiple preferences in a transaction and returns the map', async () => {
      const { service, prisma } = buildService();
      const entries = [
        { key: 'theme.mode', value: 'dark' },
        { key: 'editor.fontSize', value: 16 },
      ];
      const prefs = entries.map((e, i) =>
        makePref({ id: `pref-${i}`, key: e.key, value: e.value }),
      );

      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(prefs[0])
        .mockResolvedValueOnce(prefs[1]);

      // getAll is called after bulkSet, so mock findMany for the post-update read
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await service.bulkSet('user-1', entries);

      expect(result['theme.mode']).toBe('dark');
      expect(result['editor.fontSize']).toBe(16);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('invalidates all relevant cache keys', async () => {
      const { service, prisma, valkey } = buildService();
      const entries = [
        { key: 'theme.mode', value: 'dark' },
        { key: 'editor.fontSize', value: 16 },
      ];
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(makePref({ key: 'theme.mode' }))
        .mockResolvedValueOnce(makePref({ key: 'editor.fontSize' }));
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.bulkSet('user-1', entries);

      expect(valkey.del).toHaveBeenCalledWith(
        'prefs:user-1',
        'prefs:user-1:theme.mode',
        'prefs:user-1:editor.fontSize',
      );
    });

    it('throws BadRequestException if any key has invalid namespace', async () => {
      const { service } = buildService();
      const entries = [
        { key: 'theme.mode', value: 'dark' },
        { key: 'invalid.key', value: 'oops' },
      ];

      await expect(service.bulkSet('user-1', entries)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if any value exceeds 64KB', async () => {
      const { service } = buildService();
      const largeValue = 'x'.repeat(MAX_PREFERENCE_VALUE_BYTES + 1);
      const entries = [
        { key: 'theme.mode', value: 'dark' },
        { key: 'editor.content', value: largeValue },
      ];

      await expect(service.bulkSet('user-1', entries)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when key limit would be exceeded', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(99) // existing total
        .mockResolvedValueOnce(0); // none of the new keys exist

      const entries = [
        { key: 'theme.mode', value: 'dark' },
        { key: 'theme.accent', value: '#fff' },
      ];

      await expect(service.bulkSet('user-1', entries)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── delete() ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deletes an existing preference', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme.mode' });
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pref);
      (prisma.userPreference.delete as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      await service.delete('user-1', 'theme.mode');

      expect(prisma.userPreference.delete).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'theme.mode' } },
      });
    });

    it('throws NotFoundException when key does not exist', async () => {
      const { service } = buildService();

      await expect(service.delete('user-1', 'theme.nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for invalid namespace', async () => {
      const { service } = buildService();

      await expect(service.delete('user-1', 'invalid.key')).rejects.toThrow(BadRequestException);
    });

    it('invalidates cache after deletion', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());
      (prisma.userPreference.delete as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());

      await service.delete('user-1', 'theme.mode');

      expect(valkey.del).toHaveBeenCalledWith('prefs:user-1:theme.mode', 'prefs:user-1');
    });
  });

  // ─── Cache key structure ───────────────────────────────────────────────────

  describe('cache key structure', () => {
    it('uses prefs:<userId> for getAll cache', async () => {
      const { service, valkey } = buildService();
      await service.getAll('user-42');
      expect(valkey.get).toHaveBeenCalledWith('prefs:user-42');
    });

    it('uses prefs:<userId>:<key> for getByKey cache', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ userId: 'user-42', key: 'sidebar.width' }),
      );
      await service.getByKey('user-42', 'sidebar.width');
      expect(valkey.get).toHaveBeenCalledWith('prefs:user-42:sidebar.width');
    });
  });

  // ─── Response format ───────────────────────────────────────────────────────

  describe('response format', () => {
    it('serializes updatedAt as ISO 8601 string', async () => {
      const { service, prisma } = buildService();
      const date = new Date('2026-03-15T14:30:00.000Z');
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme.mode', updatedAt: date }),
      );

      const result = await service.getByKey('user-1', 'theme.mode');
      expect(result.updatedAt).toBe('2026-03-15T14:30:00.000Z');
    });

    it('does not include userId or id in the single-key response', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ id: 'pref-secret', userId: 'user-secret' }),
      );

      const result = await service.getByKey('user-1', 'theme.mode');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('userId');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('updatedAt');
    });

    it('getAll returns a flat key-value map', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        makePref({ key: 'theme.mode', value: 'dark' }),
      ]);

      const result = await service.getAll('user-1');

      // Should be a plain object, not an array
      expect(Array.isArray(result)).toBe(false);
      expect(typeof result).toBe('object');
      expect(result['theme.mode']).toBe('dark');
    });
  });
});
