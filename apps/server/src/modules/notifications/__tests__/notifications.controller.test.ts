import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

// ─── Mock service ───────────────────────────────────────────────────────────

function createMockNotificationsService() {
  return {
    findAllForUser: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    updateDigestSchedule: vi.fn(),
    create: vi.fn(),
    createBulk: vi.fn(),
    processDigest: vi.fn(),
  } as unknown as NotificationsService;
}

// Helper to access mock functions
function mockFn(obj: unknown) {
  return obj as ReturnType<typeof vi.fn>;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: ReturnType<typeof createMockNotificationsService>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    email: 'test@example.com',
    isSuperAdmin: false,
    sessionId: 'session-1',
  };

  beforeEach(() => {
    service = createMockNotificationsService();
    controller = new NotificationsController(service);
  });

  describe('getNotifications', () => {
    it('should pass user ID and query params to service', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        unreadCount: 0,
      };
      mockFn(service.findAllForUser).mockResolvedValue(mockResponse);

      const result = await controller.getNotifications(mockUser, {
        limit: 10,
        offset: 5,
        type: 'COMMENT_MENTION' as never,
      });

      expect(service.findAllForUser).toHaveBeenCalledWith('user-1', {
        limit: 10,
        offset: 5,
        type: 'COMMENT_MENTION',
        isRead: undefined,
      });
      expect(result).toBe(mockResponse);
    });

    it('should use defaults when no query params provided', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        unreadCount: 0,
      };
      mockFn(service.findAllForUser).mockResolvedValue(mockResponse);

      await controller.getNotifications(mockUser, {});

      expect(service.findAllForUser).toHaveBeenCalledWith('user-1', {
        limit: undefined,
        offset: undefined,
        type: undefined,
        isRead: undefined,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for authenticated user', async () => {
      mockFn(service.getUnreadCount).mockResolvedValue({ count: 3 });

      const result = await controller.getUnreadCount(mockUser);

      expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      const mockNotification = {
        id: 'n-1',
        type: 'COMMENT_MENTION',
        title: 'Test',
        body: 'Test body',
        isRead: true,
        metadata: {},
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mockFn(service.markAsRead).mockResolvedValue(mockNotification);

      const result = await controller.markAsRead(mockUser, 'n-1');

      expect(service.markAsRead).toHaveBeenCalledWith('user-1', 'n-1');
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockFn(service.markAllAsRead).mockResolvedValue({ updated: 5 });

      const result = await controller.markAllAsRead(mockUser);

      expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ updated: 5 });
    });
  });

  describe('getPreferences', () => {
    it('should return notification preferences', async () => {
      const mockPrefs = {
        preferences: [
          { type: 'COMMENT_MENTION', channel: 'BOTH' },
          { type: 'NOTE_SHARED', channel: 'IN_APP' },
        ],
        frequency: 'DAILY',
        lastSentAt: null,
      };
      mockFn(service.getPreferences).mockResolvedValue(mockPrefs);

      const result = await controller.getPreferences(mockUser);

      expect(service.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toBe(mockPrefs);
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      const input = {
        preferences: [{ type: 'COMMENT_MENTION' as const, channel: 'IN_APP' as const }],
      };
      mockFn(service.updatePreferences).mockResolvedValue(input.preferences);

      const _result = await controller.updatePreferences(mockUser, input);

      expect(service.updatePreferences).toHaveBeenCalledWith('user-1', input.preferences);
    });
  });

  describe('updateDigestSchedule', () => {
    it('should update digest schedule', async () => {
      mockFn(service.updateDigestSchedule).mockResolvedValue({
        frequency: 'WEEKLY',
        lastSentAt: null,
      });

      const result = await controller.updateDigestSchedule(mockUser, {
        frequency: 'WEEKLY',
      });

      expect(service.updateDigestSchedule).toHaveBeenCalledWith('user-1', 'WEEKLY');
      expect(result.frequency).toBe('WEEKLY');
    });
  });
});
