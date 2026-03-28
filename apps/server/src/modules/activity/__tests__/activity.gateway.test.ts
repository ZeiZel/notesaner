import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityGateway } from '../activity.gateway';
import { WebSocket } from 'ws';
import { WS_ACTIVITY_NEW } from '../activity.constants';
import type { ActivityLogDto } from '../activity.types';

describe('ActivityGateway', () => {
  let gateway: ActivityGateway;

  beforeEach(() => {
    gateway = new ActivityGateway();
  });

  describe('sendToWorkspace', () => {
    it('should send activity to all connected sockets in a workspace', () => {
      const mockSocket1 = {
        id: 'socket-1',
        workspaceId: 'ws-1',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };
      const mockSocket2 = {
        id: 'socket-2',
        workspaceId: 'ws-1',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      // Manually register sockets
      gateway.registerClient(
        mockSocket1 as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-1',
      );
      gateway.registerClient(
        mockSocket2 as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-1',
      );

      const activity: ActivityLogDto = {
        id: 'a-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
        noteId: 'n-1',
        type: 'NOTE_CREATED',
        metadata: {},
        createdAt: '2026-03-28T10:00:00.000Z',
      };

      gateway.sendToWorkspace('ws-1', activity);

      const expected = JSON.stringify({ event: WS_ACTIVITY_NEW, data: activity });
      expect(mockSocket1.send).toHaveBeenCalledWith(expected);
      expect(mockSocket2.send).toHaveBeenCalledWith(expected);
    });

    it('should not send to sockets in other workspaces', () => {
      const mockSocket = {
        id: 'socket-1',
        workspaceId: 'ws-2',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      gateway.registerClient(
        mockSocket as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-2',
      );

      const activity: ActivityLogDto = {
        id: 'a-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
        noteId: 'n-1',
        type: 'NOTE_CREATED',
        metadata: {},
        createdAt: '2026-03-28T10:00:00.000Z',
      };

      gateway.sendToWorkspace('ws-1', activity);

      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it('should skip closed sockets', () => {
      const mockSocket = {
        id: 'socket-1',
        workspaceId: 'ws-1',
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
      };

      gateway.registerClient(
        mockSocket as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-1',
      );

      const activity: ActivityLogDto = {
        id: 'a-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
        noteId: null,
        type: 'NOTE_DELETED',
        metadata: {},
        createdAt: '2026-03-28T10:00:00.000Z',
      };

      gateway.sendToWorkspace('ws-1', activity);

      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 for unknown workspace', () => {
      expect(gateway.getConnectionCount('unknown')).toBe(0);
    });

    it('should return correct count after registering clients', () => {
      const mockSocket = {
        id: 'socket-1',
        workspaceId: 'ws-1',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      gateway.registerClient(
        mockSocket as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-1',
      );

      expect(gateway.getConnectionCount('ws-1')).toBe(1);
    });
  });

  describe('getTotalConnectionCount', () => {
    it('should return total across all workspaces', () => {
      const socket1 = {
        id: 's1',
        workspaceId: 'ws-1',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };
      const socket2 = {
        id: 's2',
        workspaceId: 'ws-2',
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      gateway.registerClient(
        socket1 as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-1',
      );
      gateway.registerClient(
        socket2 as unknown as WebSocket & { id: string; workspaceId?: string },
        'ws-2',
      );

      expect(gateway.getTotalConnectionCount()).toBe(2);
    });
  });
});
