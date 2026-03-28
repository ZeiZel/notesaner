import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { ConfigService } from '@nestjs/config';
import { PluginWatcherGateway } from '../plugin-watcher.gateway';
import {
  HotReloadService,
  type PluginChangeEvent,
  type PluginChangeListener,
} from '../hot-reload.service';
import {
  PluginSandboxManagerService,
  type PluginReloadResult,
} from '../plugin-sandbox-manager.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

function makeConfigService(nodeEnv = 'development'): ConfigService {
  return {
    get: vi.fn((key: string, fallback?: unknown) => {
      if (key === 'nodeEnv') return nodeEnv;
      return fallback;
    }),
  } as unknown as ConfigService;
}

function makeHotReloadService(): HotReloadService & {
  _listeners: Set<PluginChangeListener>;
  _triggerChange: (event: PluginChangeEvent) => void;
} {
  const listeners = new Set<PluginChangeListener>();

  return {
    subscribe: vi.fn((listener: PluginChangeListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    isWatching: vi.fn().mockReturnValue(true),
    getPluginsRoot: vi.fn().mockReturnValue('/var/lib/notesaner/plugins-dev'),
    _listeners: listeners,
    _triggerChange: (event: PluginChangeEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
  } as unknown as HotReloadService & {
    _listeners: Set<PluginChangeListener>;
    _triggerChange: (event: PluginChangeEvent) => void;
  };
}

function makeSandboxManager(): PluginSandboxManagerService {
  return {
    reloadPlugin: vi.fn().mockImplementation((_root: string, pluginDir: string) =>
      Promise.resolve({
        pluginId: `io.notesaner.${pluginDir}`,
        pluginDir,
        success: true,
        manifest: { id: `io.notesaner.${pluginDir}`, name: 'Test', version: '1.0.0' },
        settingsPreserved: false,
        reloadCount: 1,
        timestamp: new Date().toISOString(),
      } satisfies PluginReloadResult),
    ),
    removePlugin: vi.fn(),
    destroyAll: vi.fn(),
    getAllSandboxes: vi.fn().mockReturnValue(new Map()),
  } as unknown as PluginSandboxManagerService;
}

interface MockClient {
  id: string;
  subscribedPlugins: Set<string>;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function makeMockClient(plugins: string[] = []): MockClient {
  return {
    id: 'test-client-1',
    subscribedPlugins: new Set(plugins),
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PluginWatcherGateway', () => {
  let gateway: PluginWatcherGateway;
  let hotReload: ReturnType<typeof makeHotReloadService>;
  let sandboxManager: ReturnType<typeof makeSandboxManager>;

  beforeEach(() => {
    hotReload = makeHotReloadService();
    sandboxManager = makeSandboxManager();
    gateway = new PluginWatcherGateway(hotReload, sandboxManager, makeConfigService());
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  describe('onModuleInit', () => {
    it('should subscribe to hot-reload events in development mode', () => {
      gateway.onModuleInit();

      expect(hotReload.subscribe).toHaveBeenCalledOnce();
      expect(hotReload._listeners.size).toBe(1);
    });

    it('should not subscribe in production mode', () => {
      const prodGateway = new PluginWatcherGateway(
        hotReload,
        sandboxManager,
        makeConfigService('production'),
      );

      prodGateway.onModuleInit();
      expect(hotReload.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('should register client and send initial status', () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);

      expect(gateway.getClientCount()).toBe(1);
      expect(client.send).toHaveBeenCalledOnce();

      const sentData = JSON.parse(client.send.mock.calls[0][0] as string);
      expect(sentData.event).toBe('plugin:status');
      expect(sentData.data.watching).toBe(true);
      expect(sentData.data.pluginsRoot).toContain('plugins-dev');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client on disconnect', () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);
      expect(gateway.getClientCount()).toBe(1);

      gateway.handleDisconnect(client as unknown as Parameters<typeof gateway.handleDisconnect>[0]);
      expect(gateway.getClientCount()).toBe(0);
    });
  });

  describe('plugin change events', () => {
    it('should broadcast plugin:change and trigger PLUGIN_RELOADED on code change', async () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);
      client.send.mockClear(); // Clear the initial status message

      const changeEvent: PluginChangeEvent = {
        type: 'code-changed',
        filePath: '/var/lib/notesaner/plugins-dev/test-plugin/src/index.ts',
        relativePath: 'test-plugin/src/index.ts',
        pluginDir: 'test-plugin',
        timestamp: new Date().toISOString(),
      };

      hotReload._triggerChange(changeEvent);

      // Allow async operations to complete
      await vi.waitFor(() => {
        expect(client.send).toHaveBeenCalledTimes(2);
      });

      // First message: plugin:change
      const changeMsg = JSON.parse(client.send.mock.calls[0][0] as string);
      expect(changeMsg.event).toBe('plugin:change');
      expect(changeMsg.data.type).toBe('code-changed');
      expect(changeMsg.data.pluginDir).toBe('test-plugin');

      // Second message: plugin:reloaded (PLUGIN_RELOADED)
      const reloadMsg = JSON.parse(client.send.mock.calls[1][0] as string);
      expect(reloadMsg.event).toBe('plugin:reloaded');
      expect(reloadMsg.data.type).toBe('PLUGIN_RELOADED');
      expect(reloadMsg.data.pluginId).toBe('io.notesaner.test-plugin');
      expect(reloadMsg.data.success).toBe(true);
      expect(typeof reloadMsg.data.timestamp).toBe('number');
    });

    it('should call sandboxManager.reloadPlugin on code change', async () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);

      const changeEvent: PluginChangeEvent = {
        type: 'manifest-changed',
        filePath: '/var/lib/notesaner/plugins-dev/my-plugin/plugin.json',
        relativePath: 'my-plugin/plugin.json',
        pluginDir: 'my-plugin',
        timestamp: new Date().toISOString(),
      };

      hotReload._triggerChange(changeEvent);

      await vi.waitFor(() => {
        expect(sandboxManager.reloadPlugin).toHaveBeenCalledWith(
          '/var/lib/notesaner/plugins-dev',
          'my-plugin',
        );
      });
    });

    it('should call sandboxManager.removePlugin on plugin-removed', async () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);

      const removeEvent: PluginChangeEvent = {
        type: 'plugin-removed',
        filePath: '/var/lib/notesaner/plugins-dev/old-plugin',
        relativePath: 'old-plugin',
        pluginDir: 'old-plugin',
        timestamp: new Date().toISOString(),
      };

      hotReload._triggerChange(removeEvent);

      await vi.waitFor(() => {
        expect(sandboxManager.removePlugin).toHaveBeenCalledWith('old-plugin');
      });
    });

    it('should respect subscription filters', async () => {
      gateway.onModuleInit();

      const subscribedClient = makeMockClient();
      const allClient = makeMockClient();

      gateway.handleConnection(
        subscribedClient as unknown as Parameters<typeof gateway.handleConnection>[0],
      );
      gateway.handleConnection(
        allClient as unknown as Parameters<typeof gateway.handleConnection>[0],
      );

      // After connection, configure subscription filter via the subscribe handler
      // (handleConnection resets subscribedPlugins to empty = all)
      subscribedClient.subscribedPlugins = new Set(['my-plugin']);

      subscribedClient.send.mockClear();
      allClient.send.mockClear();

      const changeEvent: PluginChangeEvent = {
        type: 'code-changed',
        filePath: '/var/lib/notesaner/plugins-dev/other-plugin/src/index.ts',
        relativePath: 'other-plugin/src/index.ts',
        pluginDir: 'other-plugin',
        timestamp: new Date().toISOString(),
      };

      hotReload._triggerChange(changeEvent);

      await vi.waitFor(() => {
        // allClient should receive both events
        expect(allClient.send).toHaveBeenCalledTimes(2);
      });

      // subscribedClient should NOT receive events for other-plugin
      expect(subscribedClient.send).not.toHaveBeenCalled();
    });
  });

  describe('force-reload', () => {
    it('should trigger sandbox reload and broadcast PLUGIN_RELOADED', async () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);
      client.send.mockClear();

      const result = await gateway.handleForceReload(
        client as unknown as Parameters<typeof gateway.handleForceReload>[0],
        { pluginDir: 'test-plugin' },
      );

      expect(result.event).toBe('force-reload');
      expect(result.data.status).toBe('ok');

      expect(sandboxManager.reloadPlugin).toHaveBeenCalledWith(
        '/var/lib/notesaner/plugins-dev',
        'test-plugin',
      );

      // Should have broadcast PLUGIN_RELOADED
      expect(client.send).toHaveBeenCalledOnce();
      const msg = JSON.parse(client.send.mock.calls[0][0] as string);
      expect(msg.event).toBe('plugin:reloaded');
      expect(msg.data.type).toBe('PLUGIN_RELOADED');
    });

    it('should return error when pluginDir is missing', async () => {
      gateway.onModuleInit();

      const client = makeMockClient();
      const result = await gateway.handleForceReload(
        client as unknown as Parameters<typeof gateway.handleForceReload>[0],
        {},
      );

      expect(result.event).toBe('error');
      expect(result.data.status).toBe('pluginDir is required');
    });
  });

  describe('onModuleDestroy', () => {
    it('should unsubscribe from hot-reload and destroy all sandboxes', () => {
      gateway.onModuleInit();
      expect(hotReload._listeners.size).toBe(1);

      gateway.onModuleDestroy();

      expect(hotReload._listeners.size).toBe(0);
      expect(sandboxManager.destroyAll).toHaveBeenCalledOnce();
    });
  });
});
