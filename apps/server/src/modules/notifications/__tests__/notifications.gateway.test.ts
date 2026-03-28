import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsGateway } from '../notifications.gateway';
import { WebSocket } from 'ws';
import { WS_NOTIFICATION_NEW, WS_UNREAD_COUNT } from '../notifications.constants';
import type { NotificationDto } from '../notifications.types';

// ─── Mock WebSocket ─────────────────────────────────────────────────────────

function createMockSocket(userId?: string): {
  id: string;
  userId?: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
} {
  return {
    id: Math.random().toString(36).slice(2),
    userId,
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(() => {
    gateway = new NotificationsGateway();
  });

  const mockNotification: NotificationDto = {
    id: 'notif-1',
    type: 'COMMENT_MENTION',
    title: 'You were mentioned',
    body: 'Alice mentioned you',
    isRead: false,
    noteId: 'note-1',
    metadata: { noteId: 'note-1' },
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('registerClient', () => {
    it('should register a client for a user', () => {
      const socket = createMockSocket();
      gateway.registerClient(socket as never, 'user-1');

      expect(gateway.getConnectionCount('user-1')).toBe(1);
    });

    it('should support multiple sockets per user', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      gateway.registerClient(socket1 as never, 'user-1');
      gateway.registerClient(socket2 as never, 'user-1');

      expect(gateway.getConnectionCount('user-1')).toBe(2);
    });
  });

  describe('sendNotification', () => {
    it('should send notification to all connected sockets for a user', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      gateway.registerClient(socket1 as never, 'user-1');
      gateway.registerClient(socket2 as never, 'user-1');

      gateway.sendNotification('user-1', mockNotification);

      const expectedMessage = JSON.stringify({
        event: WS_NOTIFICATION_NEW,
        data: mockNotification,
      });

      expect(socket1.send).toHaveBeenCalledWith(expectedMessage);
      expect(socket2.send).toHaveBeenCalledWith(expectedMessage);
    });

    it('should not send to sockets of other users', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      gateway.registerClient(socket1 as never, 'user-1');
      gateway.registerClient(socket2 as never, 'user-2');

      gateway.sendNotification('user-1', mockNotification);

      expect(socket1.send).toHaveBeenCalledTimes(1);
      expect(socket2.send).not.toHaveBeenCalled();
    });

    it('should skip sockets that are not in OPEN state', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      socket2.readyState = WebSocket.CLOSED;

      gateway.registerClient(socket1 as never, 'user-1');
      gateway.registerClient(socket2 as never, 'user-1');

      gateway.sendNotification('user-1', mockNotification);

      expect(socket1.send).toHaveBeenCalledTimes(1);
      expect(socket2.send).not.toHaveBeenCalled();
    });

    it('should do nothing when user has no connected sockets', () => {
      // Should not throw
      gateway.sendNotification('user-unknown', mockNotification);
      expect(gateway.getConnectionCount('user-unknown')).toBe(0);
    });
  });

  describe('sendUnreadCount', () => {
    it('should send unread count to all connected sockets', () => {
      const socket = createMockSocket();
      gateway.registerClient(socket as never, 'user-1');

      gateway.sendUnreadCount('user-1', 5);

      const expectedMessage = JSON.stringify({
        event: WS_UNREAD_COUNT,
        data: { count: 5 },
      });

      expect(socket.send).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove socket from user connections on disconnect', () => {
      const socket = createMockSocket('user-1');
      gateway.registerClient(socket as never, 'user-1');

      expect(gateway.getConnectionCount('user-1')).toBe(1);

      gateway.handleDisconnect(socket as never);

      expect(gateway.getConnectionCount('user-1')).toBe(0);
    });

    it('should keep other sockets when one disconnects', () => {
      const socket1 = createMockSocket('user-1');
      const socket2 = createMockSocket('user-1');

      gateway.registerClient(socket1 as never, 'user-1');
      gateway.registerClient(socket2 as never, 'user-1');

      expect(gateway.getConnectionCount('user-1')).toBe(2);

      gateway.handleDisconnect(socket1 as never);

      expect(gateway.getConnectionCount('user-1')).toBe(1);
    });
  });

  describe('getTotalConnectionCount', () => {
    it('should return total count across all users', () => {
      const s1 = createMockSocket();
      const s2 = createMockSocket();
      const s3 = createMockSocket();

      gateway.registerClient(s1 as never, 'user-1');
      gateway.registerClient(s2 as never, 'user-1');
      gateway.registerClient(s3 as never, 'user-2');

      expect(gateway.getTotalConnectionCount()).toBe(3);
    });
  });
});
