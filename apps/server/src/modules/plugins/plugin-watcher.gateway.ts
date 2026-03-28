import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HotReloadService, type PluginChangeEvent } from './hot-reload.service';
import { PluginSandboxManagerService } from './plugin-sandbox-manager.service';

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginWatcherClient extends WebSocket {
  id: string;
  /** Plugin directories this client is subscribed to (empty = all) */
  subscribedPlugins: Set<string>;
}

/**
 * PLUGIN_RELOADED event payload sent to clients.
 * Matches the spec: { type: 'PLUGIN_RELOADED', pluginId: string, timestamp: number }
 */
interface PluginReloadedEvent {
  type: 'PLUGIN_RELOADED';
  pluginId: string;
  pluginDir: string;
  timestamp: number;
  success: boolean;
  settingsPreserved: boolean;
  reloadCount: number;
  error?: string;
}

// ── Gateway ──────────────────────────────────────────────────────────────────

/**
 * WebSocket gateway for plugin hot-reload notifications.
 *
 * Connected clients (typically the Notesaner frontend in dev mode)
 * receive real-time events when plugin source files change on disk.
 *
 * Protocol:
 *   Client -> Server: "subscribe" { plugins?: string[] }
 *   Server -> Client: "plugin:change" PluginChangeEvent
 *   Server -> Client: "plugin:reloaded" PLUGIN_RELOADED event
 *
 * On file change the gateway:
 *  1. Broadcasts the raw change event (plugin:change).
 *  2. Triggers sandbox reload via PluginSandboxManagerService.
 *  3. Broadcasts PLUGIN_RELOADED with the reload result.
 *
 * This gateway is only functional in NODE_ENV=development. In production,
 * the HotReloadService is a no-op and no file-watching occurs.
 *
 * Path: /plugins/watch
 */
@WebSocketGateway({
  path: '/plugins/watch',
  transports: ['websocket'],
})
export class PluginWatcherGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PluginWatcherGateway.name);
  private readonly isDevelopment: boolean;
  private readonly clients = new Set<PluginWatcherClient>();
  private unsubscribeHotReload: (() => void) | null = null;

  constructor(
    private readonly hotReloadService: HotReloadService,
    private readonly sandboxManager: PluginSandboxManagerService,
    private readonly config: ConfigService,
  ) {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    this.isDevelopment = nodeEnv === 'development';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onModuleInit(): void {
    if (!this.isDevelopment) {
      this.logger.log('Plugin watcher gateway is inactive (not in development mode)');
      return;
    }

    // Subscribe to hot-reload change events and forward to WebSocket clients
    this.unsubscribeHotReload = this.hotReloadService.subscribe((event: PluginChangeEvent) => {
      void this.handlePluginChange(event);
    });

    this.logger.log('Plugin watcher gateway initialized');
  }

  onModuleDestroy(): void {
    if (this.unsubscribeHotReload) {
      this.unsubscribeHotReload();
      this.unsubscribeHotReload = null;
    }

    // Destroy all sandboxes on shutdown
    this.sandboxManager.destroyAll();
  }

  // ── Connection Handling ────────────────────────────────────────────────────

  handleConnection(client: PluginWatcherClient): void {
    client.id = Math.random().toString(36).slice(2);
    client.subscribedPlugins = new Set();
    this.clients.add(client);

    this.logger.debug(`Plugin watcher client connected: ${client.id}`);

    // Send initial status
    this.sendToClient(client, 'plugin:status', {
      watching: this.hotReloadService.isWatching(),
      pluginsRoot: this.hotReloadService.getPluginsRoot(),
      connectedClients: this.clients.size,
      loadedPlugins: Array.from(this.sandboxManager.getAllSandboxes().keys()),
    });
  }

  handleDisconnect(client: PluginWatcherClient): void {
    this.clients.delete(client);
    this.logger.debug(
      `Plugin watcher client disconnected: ${client.id} (${this.clients.size} remaining)`,
    );
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  /**
   * Clients can subscribe to specific plugin directories or receive all events.
   *
   * Payload: { plugins?: string[] }
   * - If `plugins` is omitted or empty, the client receives all change events.
   * - If `plugins` is provided, only events for those plugin dirs are sent.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: PluginWatcherClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): WsResponse<{ status: string; plugins: string[] }> {
    const payload = (args[0] ?? {}) as { plugins?: string[] };
    const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];

    client.subscribedPlugins = new Set(plugins);

    this.logger.debug(
      `Client ${client.id} subscribed to: ${plugins.length > 0 ? plugins.join(', ') : 'all plugins'}`,
    );

    return {
      event: 'subscribed',
      data: {
        status: 'ok',
        plugins,
      },
    };
  }

  /**
   * Clients can request a manual check / force-reload of a specific plugin.
   */
  @SubscribeMessage('force-reload')
  async handleForceReload(
    @ConnectedSocket() client: PluginWatcherClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): Promise<WsResponse<{ status: string }>> {
    const payload = (args[0] ?? {}) as { pluginDir?: string };

    if (!payload.pluginDir) {
      return { event: 'error', data: { status: 'pluginDir is required' } };
    }

    this.logger.log(`Force reload requested by client ${client.id} for: ${payload.pluginDir}`);

    // Perform actual sandbox reload
    const pluginsRoot = this.hotReloadService.getPluginsRoot();
    const result = await this.sandboxManager.reloadPlugin(pluginsRoot, payload.pluginDir);

    // Broadcast the PLUGIN_RELOADED event
    const reloadedEvent: PluginReloadedEvent = {
      type: 'PLUGIN_RELOADED',
      pluginId: result.pluginId,
      pluginDir: result.pluginDir,
      timestamp: Date.now(),
      success: result.success,
      settingsPreserved: result.settingsPreserved,
      reloadCount: result.reloadCount,
      ...(result.error && { error: result.error }),
    };

    this.broadcastReloaded(reloadedEvent);

    return { event: 'force-reload', data: { status: result.success ? 'ok' : 'error' } };
  }

  // ── Change Handling ────────────────────────────────────────────────────────

  /**
   * Handle a plugin change event from the HotReloadService.
   *
   * 1. Broadcast the raw change event to subscribed clients.
   * 2. Trigger sandbox reload (destroy + recreate, preserving settings).
   * 3. Broadcast PLUGIN_RELOADED event with the reload result.
   */
  private async handlePluginChange(event: PluginChangeEvent): Promise<void> {
    // Step 1: Broadcast the raw change notification
    this.broadcastChange(event);

    // Step 2: Perform sandbox reload based on event type
    const pluginsRoot = this.hotReloadService.getPluginsRoot();

    if (event.type === 'plugin-removed') {
      // Plugin was removed from disk -- destroy sandbox completely
      this.sandboxManager.removePlugin(event.pluginDir);

      const removedEvent: PluginReloadedEvent = {
        type: 'PLUGIN_RELOADED',
        pluginId: event.pluginDir,
        pluginDir: event.pluginDir,
        timestamp: Date.now(),
        success: true,
        settingsPreserved: false,
        reloadCount: 0,
      };

      this.broadcastReloaded(removedEvent);
      return;
    }

    // For all other events (manifest-changed, code-changed, plugin-added),
    // reload the plugin sandbox
    const result = await this.sandboxManager.reloadPlugin(pluginsRoot, event.pluginDir);

    // Step 3: Broadcast PLUGIN_RELOADED event
    const reloadedEvent: PluginReloadedEvent = {
      type: 'PLUGIN_RELOADED',
      pluginId: result.pluginId,
      pluginDir: result.pluginDir,
      timestamp: Date.now(),
      success: result.success,
      settingsPreserved: result.settingsPreserved,
      reloadCount: result.reloadCount,
      ...(result.error && { error: result.error }),
    };

    this.broadcastReloaded(reloadedEvent);
  }

  // ── Broadcasting ───────────────────────────────────────────────────────────

  /**
   * Broadcast a plugin change event to all connected and subscribed clients.
   */
  private broadcastChange(event: PluginChangeEvent): void {
    const message = JSON.stringify({
      event: 'plugin:change',
      data: {
        type: event.type,
        pluginDir: event.pluginDir,
        relativePath: event.relativePath,
        timestamp: event.timestamp,
        manifest: event.manifest ?? null,
      },
    });

    let notified = 0;

    for (const client of this.clients) {
      // Check subscription filter
      if (client.subscribedPlugins.size > 0 && !client.subscribedPlugins.has(event.pluginDir)) {
        continue;
      }

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        notified++;
      }
    }

    if (notified > 0) {
      this.logger.debug(
        `Broadcast plugin:change (${event.type}) for "${event.pluginDir}" to ${notified} client(s)`,
      );
    }
  }

  /**
   * Broadcast a PLUGIN_RELOADED event to all connected and subscribed clients.
   */
  private broadcastReloaded(event: PluginReloadedEvent): void {
    const message = JSON.stringify({
      event: 'plugin:reloaded',
      data: event,
    });

    let notified = 0;

    for (const client of this.clients) {
      // Check subscription filter
      if (client.subscribedPlugins.size > 0 && !client.subscribedPlugins.has(event.pluginDir)) {
        continue;
      }

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        notified++;
      }
    }

    if (notified > 0) {
      this.logger.log(
        `Broadcast PLUGIN_RELOADED for "${event.pluginId}" (success: ${event.success}) to ${notified} client(s)`,
      );
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private sendToClient(client: PluginWatcherClient, event: string, data: unknown): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  /**
   * Get the number of currently connected watcher clients.
   * Useful for diagnostics.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
