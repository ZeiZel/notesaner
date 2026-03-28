import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { EmailService } from '../../email/email.service';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    notificationDigestSchedule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
}

function createMockEmailService() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    sendBulk: vi.fn(),
  } as unknown as EmailService;
}

// Helper to access mock functions
function mockFn(obj: unknown) {
  return obj as ReturnType<typeof vi.fn>;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let emailService: ReturnType<typeof createMockEmailService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    emailService = createMockEmailService();
    // Construct directly — avoids NestJS DI overhead in unit tests
    service = new NotificationsService(prisma, emailService);
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const input = {
      userId: 'user-1',
      type: 'COMMENT_MENTION' as const,
      title: 'You were mentioned',
      body: 'Alice mentioned you in Project Notes',
      metadata: { noteId: 'note-1', commentId: 'comment-1' } as Record<string, unknown>,
    };

    it('should create in-app notification and send email when channel is BOTH', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue(null); // defaults to BOTH
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-1',
        ...input,
        isRead: false,
        metadata: input.metadata,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      mockFn(prisma.user.findUnique).mockResolvedValue({
        email: 'alice@example.com',
        displayName: 'Alice',
      });

      const result = await service.create(input);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('notif-1');
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should create in-app notification only when channel is IN_APP', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'IN_APP',
      });
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-2',
        ...input,
        isRead: false,
        metadata: input.metadata,
        createdAt: new Date(),
      });

      const result = await service.create(input);

      expect(result).not.toBeNull();
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should send email only when channel is EMAIL', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'EMAIL',
      });
      mockFn(prisma.user.findUnique).mockResolvedValue({
        email: 'bob@example.com',
        displayName: 'Bob',
      });

      const result = await service.create(input);

      expect(result).toBeNull(); // No in-app notification created
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should skip entirely when channel is NONE', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'NONE',
      });

      const result = await service.create(input);

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });

  // ─── findAllForUser ───────────────────────────────────────────────────

  describe('findAllForUser', () => {
    it('should return paginated notifications with unread count', async () => {
      const mockNotifications = [
        {
          id: 'n-1',
          type: 'COMMENT_MENTION',
          title: 'Title 1',
          body: 'Body 1',
          isRead: false,
          metadata: {},
          createdAt: new Date('2026-01-02'),
        },
        {
          id: 'n-2',
          type: 'NOTE_SHARED',
          title: 'Title 2',
          body: 'Body 2',
          isRead: true,
          metadata: {},
          createdAt: new Date('2026-01-01'),
        },
      ];

      mockFn(prisma.$transaction).mockResolvedValue([mockNotifications, 2, 1]);

      const result = await service.findAllForUser('user-1', { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.unreadCount).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should indicate hasMore when more results exist', async () => {
      mockFn(prisma.$transaction).mockResolvedValue([
        [
          {
            id: 'n-1',
            type: 'COMMENT_MENTION',
            title: 'T',
            body: 'B',
            isRead: false,
            metadata: {},
            createdAt: new Date(),
          },
        ],
        10,
        5,
      ]);

      const result = await service.findAllForUser('user-1', { limit: 1, offset: 0 });

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.total).toBe(10);
    });
  });

  // ─── getUnreadCount ───────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      mockFn(prisma.notification.count).mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = {
        id: 'n-1',
        userId: 'user-1',
        type: 'COMMENT_MENTION',
        title: 'Title',
        body: 'Body',
        isRead: false,
        metadata: {},
        createdAt: new Date(),
      };

      mockFn(prisma.notification.findFirst).mockResolvedValue(notification);
      mockFn(prisma.notification.update).mockResolvedValue({
        ...notification,
        isRead: true,
      });

      const result = await service.markAsRead('user-1', 'n-1');

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockFn(prisma.notification.findFirst).mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'n-999')).rejects.toThrow(NotFoundException);
    });

    it('should not allow marking another user notification', async () => {
      mockFn(prisma.notification.findFirst).mockResolvedValue(null);

      await expect(service.markAsRead('user-2', 'n-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockFn(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockFn(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(0);
    });
  });

  // ─── getPreferences ───────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('should return all types with defaults for missing preferences', async () => {
      mockFn(prisma.$transaction).mockResolvedValue([
        [{ type: 'COMMENT_MENTION', channel: 'IN_APP' }],
        null, // no digest schedule
      ]);

      const result = await service.getPreferences('user-1');

      expect(result.preferences).toHaveLength(4);

      const commentPref = result.preferences.find((p) => p.type === 'COMMENT_MENTION');
      expect(commentPref?.channel).toBe('IN_APP');

      const noteSharedPref = result.preferences.find((p) => p.type === 'NOTE_SHARED');
      expect(noteSharedPref?.channel).toBe('BOTH'); // default

      expect(result.frequency).toBe('DAILY'); // default
      expect(result.lastSentAt).toBeNull();
    });

    it('should return digest schedule when set', async () => {
      mockFn(prisma.$transaction).mockResolvedValue([
        [],
        {
          frequency: 'WEEKLY',
          lastSentAt: new Date('2026-01-01T08:00:00Z'),
        },
      ]);

      const result = await service.getPreferences('user-1');

      expect(result.frequency).toBe('WEEKLY');
      expect(result.lastSentAt).toBe('2026-01-01T08:00:00.000Z');
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('should upsert preferences for given types', async () => {
      const input = [
        { type: 'COMMENT_MENTION' as const, channel: 'IN_APP' as const },
        { type: 'NOTE_SHARED' as const, channel: 'NONE' as const },
      ];

      mockFn(prisma.$transaction).mockResolvedValue(
        input.map((p) => ({ type: p.type, channel: p.channel })),
      );

      const result = await service.updatePreferences('user-1', input);

      expect(result).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateDigestSchedule ─────────────────────────────────────────────

  describe('updateDigestSchedule', () => {
    it('should upsert the digest schedule', async () => {
      mockFn(prisma.notificationDigestSchedule.upsert).mockResolvedValue({
        frequency: 'WEEKLY',
        lastSentAt: null,
      });

      const result = await service.updateDigestSchedule('user-1', 'WEEKLY');

      expect(result.frequency).toBe('WEEKLY');
      expect(result.lastSentAt).toBeNull();
    });
  });

  // ─── processDigest ────────────────────────────────────────────────────

  describe('processDigest', () => {
    it('should process digests for users with matching frequency', async () => {
      mockFn(prisma.notificationDigestSchedule.findMany).mockResolvedValue([
        {
          id: 'schedule-1',
          userId: 'user-1',
          frequency: 'DAILY',
          lastSentAt: new Date('2026-01-01'),
          user: { email: 'alice@example.com', displayName: 'Alice' },
        },
      ]);

      mockFn(prisma.notification.findMany).mockResolvedValue([
        {
          title: 'Mentioned',
          body: 'Someone mentioned you',
          type: 'COMMENT_MENTION',
          createdAt: new Date('2026-01-02'),
        },
      ]);

      mockFn(prisma.notificationDigestSchedule.update).mockResolvedValue({});

      const result = await service.processDigest('DAILY');

      expect(result.usersProcessed).toBe(1);
      expect(result.emailsSent).toBe(1);
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should skip users with no new notifications', async () => {
      mockFn(prisma.notificationDigestSchedule.findMany).mockResolvedValue([
        {
          id: 'schedule-1',
          userId: 'user-1',
          frequency: 'DAILY',
          lastSentAt: new Date('2026-01-01'),
          user: { email: 'alice@example.com', displayName: 'Alice' },
        },
      ]);

      mockFn(prisma.notification.findMany).mockResolvedValue([]);

      const result = await service.processDigest('DAILY');

      expect(result.usersProcessed).toBe(1);
      expect(result.emailsSent).toBe(0);
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });
});
