import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { EmailService } from '../../email/email.service';
import type { NotificationsGateway } from '../notifications.gateway';

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
      deleteMany: vi.fn(),
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

function createMockGateway() {
  return {
    sendNotification: vi.fn(),
    sendUnreadCount: vi.fn(),
    getConnectionCount: vi.fn().mockReturnValue(0),
  } as unknown as NotificationsGateway;
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
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
  let gateway: ReturnType<typeof createMockGateway>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    emailService = createMockEmailService();
    gateway = createMockGateway();
    redis = createMockRedis();
    // Construct directly — avoids NestJS DI overhead in unit tests
    service = new NotificationsService(prisma, emailService, gateway, redis as unknown as null);
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const input = {
      userId: 'user-1',
      type: 'COMMENT_MENTION' as const,
      title: 'You were mentioned',
      body: 'Alice mentioned you in Project Notes',
      noteId: 'note-1',
      metadata: { noteId: 'note-1', commentId: 'comment-1' } as Record<string, unknown>,
    };

    it('should create in-app notification and send email when channel is BOTH', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue(null); // defaults to BOTH
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-1',
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        noteId: input.noteId,
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
      expect(result?.noteId).toBe('note-1');
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should push notification via WebSocket when creating in-app notification', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue(null);
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-ws',
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        noteId: input.noteId,
        isRead: false,
        metadata: input.metadata,
        createdAt: new Date(),
      });
      mockFn(prisma.user.findUnique).mockResolvedValue({
        email: 'alice@example.com',
        displayName: 'Alice',
      });

      await service.create(input);

      expect(gateway.sendNotification).toHaveBeenCalledTimes(1);
      expect(gateway.sendNotification).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'notif-ws' }),
      );
    });

    it('should create in-app notification only when channel is IN_APP', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'IN_APP',
      });
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-2',
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        noteId: input.noteId,
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

    it('should skip when rate limited', async () => {
      mockFn(redis.get).mockResolvedValue('100'); // At the limit

      const result = await service.create(input);

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should increment rate limit counter after creating notification', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'IN_APP',
      });
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-rl',
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        noteId: null,
        isRead: false,
        metadata: {},
        createdAt: new Date(),
      });

      await service.create({ ...input, noteId: undefined });

      expect(redis.incr).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining('notif:rate:user-1'), 3600);
    });

    it('should create notification with null noteId when not provided', async () => {
      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'IN_APP',
      });
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-no-note',
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        noteId: null,
        isRead: false,
        metadata: {},
        createdAt: new Date(),
      });

      const result = await service.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
      });

      expect(result).not.toBeNull();
      expect(result?.noteId).toBeNull();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            noteId: null,
          }),
        }),
      );
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
          noteId: 'note-1',
          metadata: {},
          createdAt: new Date('2026-01-02'),
        },
        {
          id: 'n-2',
          type: 'NOTE_SHARED',
          title: 'Title 2',
          body: 'Body 2',
          isRead: true,
          noteId: null,
          metadata: {},
          createdAt: new Date('2026-01-01'),
        },
      ];

      mockFn(prisma.$transaction).mockResolvedValue([mockNotifications, 2, 1]);

      const result = await service.findAllForUser('user-1', { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].noteId).toBe('note-1');
      expect(result.data[1].noteId).toBeNull();
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
            noteId: null,
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
    it('should mark a notification as read and push unread count via WebSocket', async () => {
      const notification = {
        id: 'n-1',
        userId: 'user-1',
        type: 'COMMENT_MENTION',
        title: 'Title',
        body: 'Body',
        isRead: false,
        noteId: null,
        metadata: {},
        createdAt: new Date(),
      };

      mockFn(prisma.notification.findFirst).mockResolvedValue(notification);
      mockFn(prisma.notification.update).mockResolvedValue({
        ...notification,
        isRead: true,
      });
      mockFn(prisma.notification.count).mockResolvedValue(2);

      const result = await service.markAsRead('user-1', 'n-1');

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { isRead: true },
      });
      expect(gateway.sendUnreadCount).toHaveBeenCalledWith('user-1', 2);
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
    it('should mark all unread notifications as read and push zero count', async () => {
      mockFn(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
      expect(gateway.sendUnreadCount).toHaveBeenCalledWith('user-1', 0);
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockFn(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(0);
      // Should NOT push WebSocket when nothing changed
      expect(gateway.sendUnreadCount).not.toHaveBeenCalled();
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

  // ─── Rate limiting (no Redis) ─────────────────────────────────────────

  describe('rate limiting without Redis', () => {
    it('should fail open when Redis is not available', async () => {
      const serviceNoRedis = new NotificationsService(prisma, emailService, gateway, null);

      mockFn(prisma.notificationPreference.findUnique).mockResolvedValue({
        channel: 'IN_APP',
      });
      mockFn(prisma.notification.create).mockResolvedValue({
        id: 'notif-no-redis',
        userId: 'user-1',
        type: 'COMMENT_MENTION',
        title: 'Test',
        body: 'Test',
        noteId: null,
        isRead: false,
        metadata: {},
        createdAt: new Date(),
      });

      const result = await serviceNoRedis.create({
        userId: 'user-1',
        type: 'COMMENT_MENTION',
        title: 'Test',
        body: 'Test',
      });

      expect(result).not.toBeNull();
    });
  });
});
