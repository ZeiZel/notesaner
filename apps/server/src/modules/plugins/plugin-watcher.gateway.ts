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

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginWatcherClient extends WebSocket {
  id: string;
  /** Plugin directories this client is subscribed to (empty = all) */
  subscribedPlugins: Set<string>;
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
 *   Server -> Client: "plugin:reload" { pluginDir, manifest? }
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
      this.broadcastChange(event);
    });

    this.logger.log('Plugin watcher gateway initialized');
  }

  onModuleDestroy(): void {
    if (this.unsubscribeHotReload) {
      this.unsubscribeHotReload();
      this.unsubscribeHotReload = null;
    }
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
  handleForceReload(
    @ConnectedSocket() client: PluginWatcherClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): WsResponse<{ status: string }> {
    const payload = (args[0] ?? {}) as { pluginDir?: string };

    if (!payload.pluginDir) {
      return { event: 'error', data: { status: 'pluginDir is required' } };
    }

    this.logger.log(`Force reload requested by client ${client.id} for: ${payload.pluginDir}`);

    // Emit a synthetic change event for the requested plugin
    const syntheticEvent: PluginChangeEvent = {
      type: 'manifest-changed',
      filePath: '',
      relativePath: payload.pluginDir,
      pluginDir: payload.pluginDir,
      timestamp: new Date().toISOString(),
    };

    this.broadcastChange(syntheticEvent);

    return { event: 'force-reload', data: { status: 'ok' } };
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
