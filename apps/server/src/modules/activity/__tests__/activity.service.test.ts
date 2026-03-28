import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ActivityGateway } from '../activity.gateway';
import type { NotificationsService } from '../../notifications/notifications.service';

// ---- Mocks ----

function createMockPrisma() {
  return {
    activityLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    noteFollow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
}

function createMockGateway() {
  return {
    sendToWorkspace: vi.fn(),
  } as unknown as ActivityGateway;
}

function createMockNotificationsService() {
  return {
    create: vi.fn(),
    createBulk: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  } as unknown as NotificationsService;
}

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let gateway: ReturnType<typeof createMockGateway>;
  let notificationsService: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    gateway = createMockGateway();
    notificationsService = createMockNotificationsService();

    service = new ActivityService(
      prisma as unknown as PrismaService,
      gateway as unknown as ActivityGateway,
      notificationsService as unknown as NotificationsService,
    );
  });

  // ---- create ----

  describe('create', () => {
    const input = {
      workspaceId: 'ws-1',
      userId: 'user-1',
      noteId: 'note-1',
      type: 'NOTE_CREATED' as const,
      metadata: { noteTitle: 'Test Note', notePath: 'test.md' },
    };

    it('should create an activity log entry and push via WebSocket', async () => {
      const createdRecord = {
        id: 'activity-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        noteId: 'note-1',
        type: 'NOTE_CREATED',
        metadata: { noteTitle: 'Test Note', notePath: 'test.md' },
        createdAt: new Date('2026-03-28T10:00:00Z'),
        user: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
      };

      (prisma.activityLog.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);
      (prisma.noteFollow.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.create(input);

      expect(result.id).toBe('activity-1');
      expect(result.type).toBe('NOTE_CREATED');
      expect(result.user.displayName).toBe('Alice');
      expect(prisma.activityLog.create).toHaveBeenCalledTimes(1);
      expect(gateway.sendToWorkspace).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({ id: 'activity-1' }),
      );
    });

    it('should notify followers excluding the actor', async () => {
      const createdRecord = {
        id: 'activity-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        noteId: 'note-1',
        type: 'NOTE_EDITED',
        metadata: {},
        createdAt: new Date(),
        user: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
      };

      (prisma.activityLog.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);
      (prisma.noteFollow.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { userId: 'user-1' }, // actor, should be excluded
        { userId: 'user-2' }, // follower, should be notified
        { userId: 'user-3' }, // follower, should be notified
      ]);

      await service.create(input);

      expect(notificationsService.createBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user-2' }),
          expect.objectContaining({ userId: 'user-3' }),
        ]),
      );
      // Should not include the actor
      const bulkInputs = (notificationsService.createBulk as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Array<{ userId: string }>;
      expect(bulkInputs.every((i) => i.userId !== 'user-1')).toBe(true);
    });

    it('should not notify when there are no followers', async () => {
      const createdRecord = {
        id: 'activity-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        noteId: 'note-1',
        type: 'NOTE_CREATED',
        metadata: {},
        createdAt: new Date(),
        user: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
      };

      (prisma.activityLog.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdRecord);
      (prisma.noteFollow.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.create(input);

      expect(notificationsService.createBulk).not.toHaveBeenCalled();
    });
  });

  // ---- findAllForWorkspace ----

  describe('findAllForWorkspace', () => {
    it('should return paginated activity for a workspace', async () => {
      const items = [
        {
          id: 'a-1',
          workspaceId: 'ws-1',
          userId: 'u-1',
          noteId: 'n-1',
          type: 'NOTE_CREATED',
          metadata: {},
          createdAt: new Date(),
          user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
        },
      ];

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([items, 1]);

      const result = await service.findAllForWorkspace('ws-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should calculate hasMore correctly', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `a-${i}`,
        workspaceId: 'ws-1',
        userId: 'u-1',
        noteId: 'n-1',
        type: 'NOTE_CREATED',
        metadata: {},
        createdAt: new Date(),
        user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
      }));

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([items, 50]);

      const result = await service.findAllForWorkspace('ws-1', { page: 1, limit: 20 });

      expect(result.pagination.hasMore).toBe(true);
    });
  });

  // ---- findAllForNote ----

  describe('findAllForNote', () => {
    it('should return paginated activity for a note', async () => {
      const items = [
        {
          id: 'a-1',
          workspaceId: 'ws-1',
          userId: 'u-1',
          noteId: 'note-1',
          type: 'NOTE_EDITED',
          metadata: {},
          createdAt: new Date(),
          user: { id: 'u-1', displayName: 'Alice', avatarUrl: null },
        },
      ];

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([items, 1]);

      const result = await service.findAllForNote('note-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.noteId).toBe('note-1');
    });
  });

  // ---- followNote / unfollowNote ----

  describe('followNote', () => {
    it('should create a note follow record', async () => {
      const follow = {
        id: 'f-1',
        noteId: 'note-1',
        userId: 'user-1',
        createdAt: new Date('2026-03-28T10:00:00Z'),
      };

      (prisma.noteFollow.create as ReturnType<typeof vi.fn>).mockResolvedValue(follow);

      const result = await service.followNote('note-1', 'user-1');

      expect(result.noteId).toBe('note-1');
      expect(result.userId).toBe('user-1');
    });

    it('should throw ConflictException on duplicate follow', async () => {
      (prisma.noteFollow.create as ReturnType<typeof vi.fn>).mockRejectedValue({
        code: 'P2002',
      });

      await expect(service.followNote('note-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('unfollowNote', () => {
    it('should delete the follow record', async () => {
      (prisma.noteFollow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'f-1' });
      (prisma.noteFollow.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.unfollowNote('note-1', 'user-1');

      expect(prisma.noteFollow.delete).toHaveBeenCalledWith({
        where: { noteId_userId: { noteId: 'note-1', userId: 'user-1' } },
      });
    });

    it('should throw NotFoundException when not following', async () => {
      (prisma.noteFollow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.unfollowNote('note-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ---- isFollowing ----

  describe('isFollowing', () => {
    it('should return true when following', async () => {
      (prisma.noteFollow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'f-1' });

      const result = await service.isFollowing('note-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false when not following', async () => {
      (prisma.noteFollow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.isFollowing('note-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  // ---- detectMentions ----

  describe('detectMentions', () => {
    it('should detect @mentions and resolve to user IDs', async () => {
      (prisma.workspaceMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { userId: 'u-1' },
        { userId: 'u-2' },
      ]);

      const result = await service.detectMentions('ws-1', 'Hello @Alice and @Bob, check this out');

      expect(result).toEqual(['u-1', 'u-2']);
      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-1',
            user: {
              displayName: {
                in: ['Alice', 'Bob'],
                mode: 'insensitive',
              },
            },
          }),
        }),
      );
    });

    it('should return empty array when no mentions found', async () => {
      const result = await service.detectMentions('ws-1', 'No mentions here');

      expect(result).toEqual([]);
      expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
    });

    it('should deduplicate user IDs', async () => {
      (prisma.workspaceMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { userId: 'u-1' },
      ]);

      const result = await service.detectMentions('ws-1', '@Alice @Alice');

      expect(result).toEqual(['u-1']);
    });
  });
});
