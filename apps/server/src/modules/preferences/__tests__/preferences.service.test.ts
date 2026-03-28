import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PreferencesService } from '../preferences.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makePrismaService() {
  return {
    userPreference: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      delete: vi.fn(),
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
    key: 'theme',
    value: 'dark',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PreferencesService', () => {
  // ─── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns all preferences for a user from the database', async () => {
      const { service, prisma } = buildService();
      const prefs = [
        makePref({ key: 'theme', value: 'dark' }),
        makePref({ key: 'editor.fontSize', value: 16 }),
      ];
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await service.getAll('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('theme');
      expect(result[0].value).toBe('dark');
      expect(result[1].key).toBe('editor.fontSize');
      expect(result[1].value).toBe(16);
    });

    it('returns empty array when user has no preferences', async () => {
      const { service } = buildService();
      const result = await service.getAll('user-1');
      expect(result).toEqual([]);
    });

    it('serves from cache when available', async () => {
      const { service, prisma, valkey } = buildService();
      const cached = JSON.stringify([
        { key: 'theme', value: 'light', updatedAt: '2026-01-15T10:00:00.000Z' },
      ]);
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(cached);

      const result = await service.getAll('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('theme');
      // Database should NOT have been called
      expect(prisma.userPreference.findMany).not.toHaveBeenCalled();
    });

    it('falls back to database when cache read fails', async () => {
      const { service, prisma, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ValKey down'));
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        makePref({ key: 'theme', value: 'dark' }),
      ]);

      const result = await service.getAll('user-1');

      expect(result).toHaveLength(1);
      expect(prisma.userPreference.findMany).toHaveBeenCalledOnce();
    });

    it('populates cache after database read', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        makePref({ key: 'theme', value: 'dark' }),
      ]);

      await service.getAll('user-1');

      expect(valkey.set).toHaveBeenCalledWith('prefs:all:user-1', expect.any(String), 300);
    });
  });

  // ─── getByKey() ────────────────────────────────────────────────────────────

  describe('getByKey()', () => {
    it('returns a single preference by key', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme', value: 'dark' });
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.getByKey('user-1', 'theme');

      expect(result.key).toBe('theme');
      expect(result.value).toBe('dark');
      expect(result.updatedAt).toBe('2026-01-15T10:00:00.000Z');
    });

    it('throws NotFoundException when key does not exist', async () => {
      const { service } = buildService();

      await expect(service.getByKey('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getByKey('user-1', 'nonexistent')).rejects.toThrow(
        'Preference with key "nonexistent" not found',
      );
    });

    it('serves from cache when available', async () => {
      const { service, prisma, valkey } = buildService();
      const cached = JSON.stringify({
        key: 'theme',
        value: 'light',
        updatedAt: '2026-01-15T10:00:00.000Z',
      });
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(cached);

      const result = await service.getByKey('user-1', 'theme');

      expect(result.value).toBe('light');
      expect(prisma.userPreference.findUnique).not.toHaveBeenCalled();
    });

    it('populates single-key cache after database read', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme', value: 'dark' }),
      );

      await service.getByKey('user-1', 'theme');

      expect(valkey.set).toHaveBeenCalledWith('prefs:user-1:theme', expect.any(String), 300);
    });
  });

  // ─── set() ─────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('upserts a preference and returns the response', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme', value: 'dark' });
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.set('user-1', 'theme', 'dark');

      expect(result.key).toBe('theme');
      expect(result.value).toBe('dark');
      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'theme' } },
        create: { userId: 'user-1', key: 'theme', value: 'dark' },
        update: { value: 'dark' },
      });
    });

    it('invalidates both single and all-prefs cache entries', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ key: 'theme', value: 'dark' }),
      );

      await service.set('user-1', 'theme', 'dark');

      expect(valkey.del).toHaveBeenCalledWith('prefs:user-1:theme', 'prefs:all:user-1');
    });

    it('handles complex JSON values', async () => {
      const { service, prisma } = buildService();
      const complexValue = { fontSize: 16, fontFamily: 'Inter', ligatures: true };
      const pref = makePref({ key: 'editor', value: complexValue });
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      const result = await service.set('user-1', 'editor', complexValue);

      expect(result.value).toEqual(complexValue);
    });

    it('does not throw when cache invalidation fails', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());
      (valkey.del as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ValKey down'));

      // Should NOT throw
      await expect(service.set('user-1', 'theme', 'dark')).resolves.toBeDefined();
    });
  });

  // ─── bulkSet() ─────────────────────────────────────────────────────────────

  describe('bulkSet()', () => {
    it('upserts multiple preferences in a transaction', async () => {
      const { service, prisma } = buildService();
      const entries = [
        { key: 'theme', value: 'dark' },
        { key: 'locale', value: 'en' },
      ];
      const prefs = entries.map((e, i) =>
        makePref({ id: `pref-${i}`, key: e.key, value: e.value }),
      );

      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(prefs[0])
        .mockResolvedValueOnce(prefs[1]);

      const results = await service.bulkSet('user-1', entries);

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('theme');
      expect(results[1].key).toBe('locale');
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('invalidates all relevant cache keys', async () => {
      const { service, prisma, valkey } = buildService();
      const entries = [
        { key: 'theme', value: 'dark' },
        { key: 'locale', value: 'en' },
      ];
      (prisma.userPreference.upsert as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(makePref({ key: 'theme' }))
        .mockResolvedValueOnce(makePref({ key: 'locale' }));

      await service.bulkSet('user-1', entries);

      expect(valkey.del).toHaveBeenCalledWith(
        'prefs:all:user-1',
        'prefs:user-1:theme',
        'prefs:user-1:locale',
      );
    });
  });

  // ─── delete() ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deletes an existing preference', async () => {
      const { service, prisma } = buildService();
      const pref = makePref({ key: 'theme' });
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pref);
      (prisma.userPreference.delete as ReturnType<typeof vi.fn>).mockResolvedValue(pref);

      await service.delete('user-1', 'theme');

      expect(prisma.userPreference.delete).toHaveBeenCalledWith({
        where: { userId_key: { userId: 'user-1', key: 'theme' } },
      });
    });

    it('throws NotFoundException when key does not exist', async () => {
      const { service } = buildService();

      await expect(service.delete('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('invalidates cache after deletion', async () => {
      const { service, prisma, valkey } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());
      (prisma.userPreference.delete as ReturnType<typeof vi.fn>).mockResolvedValue(makePref());

      await service.delete('user-1', 'theme');

      expect(valkey.del).toHaveBeenCalledWith('prefs:user-1:theme', 'prefs:all:user-1');
    });
  });

  // ─── Cache key structure ───────────────────────────────────────────────────

  describe('cache key structure', () => {
    it('uses prefs:all:<userId> for getAll cache', async () => {
      const { service, valkey } = buildService();
      await service.getAll('user-42');
      expect(valkey.get).toHaveBeenCalledWith('prefs:all:user-42');
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
        makePref({ key: 'theme', updatedAt: date }),
      );

      const result = await service.getByKey('user-1', 'theme');
      expect(result.updatedAt).toBe('2026-03-15T14:30:00.000Z');
    });

    it('does not include userId or id in the response', async () => {
      const { service, prisma } = buildService();
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePref({ id: 'pref-secret', userId: 'user-secret' }),
      );

      const result = await service.getByKey('user-1', 'theme');
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('userId');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('updatedAt');
    });
  });
});
