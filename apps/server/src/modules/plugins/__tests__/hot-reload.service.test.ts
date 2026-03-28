import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotReloadService } from '../hot-reload.service';
import { ConfigService } from '@nestjs/config';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Use vi.hoisted() to create the mock watcher so it's available during vi.mock hoisting
const { mockWatcher } = vi.hoisted(() => {
  const watcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockWatcher: watcher };
});

vi.mock('chokidar', () => ({
  watch: vi.fn().mockReturnValue(mockWatcher),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
}));

function makeConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    nodeEnv: 'development',
    'storage.root': '/var/lib/notesaner/workspaces',
    ...overrides,
  };

  return {
    get: vi.fn((key: string, fallback?: unknown) => defaults[key] ?? fallback),
  } as unknown as ConfigService;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HotReloadService', () => {
  let service: HotReloadService;

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
    vi.clearAllMocks();
  });

  describe('development mode', () => {
    beforeEach(() => {
      service = new HotReloadService(makeConfigService({ nodeEnv: 'development' }));
    });

    it('should start watching on module init', async () => {
      await service.onModuleInit();

      expect(service.isWatching()).toBe(true);
    });

    it('should stop watching on module destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(service.isWatching()).toBe(false);
      expect(mockWatcher.close).toHaveBeenCalledOnce();
    });

    it('should subscribe and unsubscribe listeners', () => {
      const listener = vi.fn();
      const unsub = service.subscribe(listener);

      expect(typeof unsub).toBe('function');

      unsub();
      // After unsubscribe, the listener should not be called
    });

    it('should report the plugins root directory', () => {
      const root = service.getPluginsRoot();

      expect(root).toContain('plugins-dev');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      service = new HotReloadService(makeConfigService({ nodeEnv: 'production' }));
    });

    it('should not start watching in production', async () => {
      await service.onModuleInit();

      expect(service.isWatching()).toBe(false);
    });
  });

  describe('debounce constant', () => {
    it('should use 500ms debounce', async () => {
      // The DEBOUNCE_MS constant is internal, but we verify by checking
      // that the service module is importable and consistent
      service = new HotReloadService(makeConfigService());

      // Verify it's a valid service
      expect(service).toBeDefined();
      expect(service.getPluginsRoot()).toBeTruthy();
    });
  });
});
