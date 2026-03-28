import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { WS_ACTIVITY_NEW } from './activity.constants';
import type { ActivityLogDto } from './activity.types';

// ---- Interfaces ----

interface AuthenticatedActivitySocket extends WebSocket {
  id: string;
  userId?: string;
  workspaceId?: string;
}

/**
 * ActivityGateway - WebSocket gateway for real-time activity feed push.
 *
 * Workspace members connect to /activity and receive activity:new events
 * when any activity is recorded in their workspace.
 *
 * The ActivityService calls sendToWorkspace() directly after creating
 * an activity log entry.
 */
@WebSocketGateway({
  path: '/activity',
  transports: ['websocket'],
})
export class ActivityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ActivityGateway.name);

  /** Map of workspaceId -> set of connected sockets. */
  private readonly workspaceSockets = new Map<string, Set<AuthenticatedActivitySocket>>();

  handleConnection(client: AuthenticatedActivitySocket): void {
    client.id = Math.random().toString(36).slice(2);
    this.logger.debug(`Activity client connected: ${client.id}`);

    // Extract workspaceId and userId from URL query params.
    // In production, this should validate a JWT token.
    try {
      const rawUrl = (client as unknown as { _socket?: { _httpMessage?: { url?: string } } })
        ._socket?._httpMessage?.url;

      if (rawUrl) {
        const url = new URL(rawUrl, 'http://localhost');
        const workspaceId = url.searchParams.get('workspaceId');
        const userId = url.searchParams.get('userId');

        if (workspaceId) {
          client.workspaceId = workspaceId;
          client.userId = userId ?? undefined;
          this.registerClient(client, workspaceId);
        }
      }
    } catch {
      this.logger.debug(`Could not parse params from connection for client ${client.id}`);
    }
  }

  handleDisconnect(client: AuthenticatedActivitySocket): void {
    this.logger.debug(`Activity client disconnected: ${client.id}`);

    if (client.workspaceId) {
      const sockets = this.workspaceSockets.get(client.workspaceId);
      if (sockets) {
        sockets.delete(client);
        if (sockets.size === 0) {
          this.workspaceSockets.delete(client.workspaceId);
        }
      }
    }
  }

  // ---- Public API ----

  /**
   * Registers a client socket for a specific workspace.
   * Called during connection handshake after parsing query params.
   */
  registerClient(client: AuthenticatedActivitySocket, workspaceId: string): void {
    let sockets = this.workspaceSockets.get(workspaceId);
    if (!sockets) {
      sockets = new Set();
      this.workspaceSockets.set(workspaceId, sockets);
    }
    sockets.add(client);

    this.logger.debug(
      `Client ${client.id} registered for workspace ${workspaceId} (${sockets.size} active socket(s))`,
    );
  }

  /**
   * Pushes an activity entry to all connected sockets in a workspace.
   */
  sendToWorkspace(workspaceId: string, activity: ActivityLogDto): void {
    const sockets = this.workspaceSockets.get(workspaceId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const message = JSON.stringify({
      event: WS_ACTIVITY_NEW,
      data: activity,
    });

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }

    this.logger.debug(
      `Pushed activity ${activity.id} to ${sockets.size} socket(s) in workspace ${workspaceId}`,
    );
  }

  /**
   * Returns the number of connected sockets for a workspace.
   */
  getConnectionCount(workspaceId: string): number {
    return this.workspaceSockets.get(workspaceId)?.size ?? 0;
  }

  /**
   * Returns the total number of connected activity sockets.
   */
  getTotalConnectionCount(): number {
    let total = 0;
    for (const sockets of this.workspaceSockets.values()) {
      total += sockets.size;
    }
    return total;
  }
}
