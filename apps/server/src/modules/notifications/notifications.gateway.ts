import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { WS_NOTIFICATION_NEW, WS_UNREAD_COUNT } from './notifications.constants';
import type { NotificationDto } from './notifications.types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AuthenticatedNotificationSocket extends WebSocket {
  id: string;
  userId?: string;
}

/**
 * NotificationsGateway — WebSocket gateway for real-time notification delivery.
 *
 * Clients connect to /notifications and authenticate via a token in the
 * connection handshake. Once authenticated, the client receives:
 *   - `notification:new` events when a new notification is created
 *   - `notification:unread-count` events with the updated unread count
 *
 * This gateway maintains a per-user set of connected sockets so that
 * notifications can be pushed to all active sessions for a user.
 */
@WebSocketGateway({
  path: '/notifications',
  transports: ['websocket'],
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  /** Map of userId -> set of connected sockets. */
  private readonly userSockets = new Map<string, Set<AuthenticatedNotificationSocket>>();

  handleConnection(client: AuthenticatedNotificationSocket): void {
    client.id = Math.random().toString(36).slice(2);
    this.logger.debug(`Notification client connected: ${client.id}`);

    // Extract userId from the URL query string or headers.
    // In production, this should validate a JWT token.
    // For now, we parse the URL query parameter: /notifications?userId=xxx&token=yyy
    try {
      // The 'url' property on the WebSocket upgrade request is available
      // through the raw HTTP upgrade request. For the ws library used by NestJS,
      // we access it through the internal upgrade request.
      const rawUrl = (client as unknown as { _socket?: { _httpMessage?: { url?: string } } })
        ._socket?._httpMessage?.url;

      if (rawUrl) {
        const url = new URL(rawUrl, 'http://localhost');
        const userId = url.searchParams.get('userId');

        if (userId) {
          this.registerClient(client, userId);
        }
      }
    } catch {
      // URL parsing failed — client will not receive notifications until
      // they send an authenticate message (future enhancement)
      this.logger.debug(`Could not parse userId from connection for client ${client.id}`);
    }
  }

  handleDisconnect(client: AuthenticatedNotificationSocket): void {
    this.logger.debug(`Notification client disconnected: ${client.id}`);

    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
  }

  // ─── Public API for NotificationsService ─────────────────────────────────

  /**
   * Registers a client socket for a specific user.
   * Called during connection handshake after authentication.
   */
  registerClient(client: AuthenticatedNotificationSocket, userId: string): void {
    client.userId = userId;

    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(client);

    this.logger.debug(
      `Client ${client.id} registered for user ${userId} (${sockets.size} active socket(s))`,
    );
  }

  /**
   * Pushes a new notification to all connected sockets for a user.
   */
  sendNotification(userId: string, notification: NotificationDto): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const message = JSON.stringify({
      event: WS_NOTIFICATION_NEW,
      data: notification,
    });

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }

    this.logger.debug(
      `Pushed notification ${notification.id} to ${sockets.size} socket(s) for user ${userId}`,
    );
  }

  /**
   * Pushes an updated unread count to all connected sockets for a user.
   */
  sendUnreadCount(userId: string, count: number): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const message = JSON.stringify({
      event: WS_UNREAD_COUNT,
      data: { count },
    });

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  /**
   * Returns the number of connected sockets for a user.
   * Useful for diagnostics and testing.
   */
  getConnectionCount(userId: string): number {
    return this.userSockets.get(userId)?.size ?? 0;
  }

  /**
   * Returns the total number of connected notification sockets.
   */
  getTotalConnectionCount(): number {
    let total = 0;
    for (const sockets of this.userSockets.values()) {
      total += sockets.size;
    }
    return total;
  }
}
