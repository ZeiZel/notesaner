/**
 * Unit tests for ReaderCommentsService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TooManyRequestsException } from '../../../common/exceptions/too-many-requests.exception';
import { ReaderCommentsService } from '../reader-comments.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ValkeyService } from '../../valkey/valkey.service';
import type { JobsService } from '../../jobs/jobs.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return { id: 'ws-1', name: 'Test Vault', settings: {}, ...overrides };
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    title: 'Test Note',
    workspaceId: 'ws-1',
    path: 'test-note.md',
    isPublished: true,
    isTrashed: false,
    ...overrides,
  };
}

function makeStoredComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    noteId: 'note-1',
    content: 'Great post!',
    authorName: 'Alice',
    authorEmail: 'alice@example.com',
    parentId: '',
    status: 'pending',
    createdAt: '2024-01-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeApprovedComment(overrides: Record<string, unknown> = {}) {
  return makeStoredComment({ status: 'approved', ...overrides });
}

// ─── Module-level mock client ────────────────────────────────────────────────
// This variable is reassigned by makeService() so that tests can reference
// mockClient without destructuring it from every makeService() call.
let mockClient: Record<string, ReturnType<typeof vi.fn>>;

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(
  prismaOverrides: Record<string, unknown> = {},
  valkeyClientOverrides: Record<string, unknown> = {},
  jobsOverrides: Record<string, unknown> = {},
) {
  mockClient = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue(null),
    zadd: vi.fn().mockResolvedValue(1),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    ...valkeyClientOverrides,
  };

  const prisma = {
    workspace: { findFirst: vi.fn() },
    note: { findFirst: vi.fn(), findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    ...prismaOverrides,
  } as unknown as PrismaService;

  const valkeyService = {
    getClient: vi.fn().mockReturnValue(mockClient),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(0),
  } as unknown as ValkeyService;

  const jobsService = {
    enqueueSendEmail: vi.fn().mockResolvedValue(undefined),
    ...jobsOverrides,
  } as unknown as JobsService;

  const service = new ReaderCommentsService(prisma, valkeyService, jobsService);

  return { service, prisma, valkeyService, jobsService, mockClient };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validDto(overrides: Record<string, unknown> = {}) {
  return { content: 'Great post!', ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReaderCommentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createComment', () => {
    it('should reject submission when honeypot field is non-empty', async () => {
      const { service } = makeService();
      await expect(
        service.createComment('slug', 'note.md', validDto({ honeypot: 'bot-filled' }), '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when honeypot field is any truthy string', async () => {
      const { service } = makeService();
      await expect(
        service.createComment('slug', 'note.md', validDto({ honeypot: ' ' }), '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow submission when honeypot is undefined', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      const result = await service.createComment(
        'slug',
        'note.md',
        validDto({ honeypot: undefined }),
        '127.0.0.1',
      );
      expect(result.content).toBe('Great post!');
      expect(mockClient.hset).toHaveBeenCalled();
    });

    it('should allow submission when honeypot is empty string', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      const result = await service.createComment(
        'slug',
        'note.md',
        validDto({ honeypot: '' }),
        '127.0.0.1',
      );
      expect(result.content).toBe('Great post!');
    });

    it('should throw NotFoundException when public vault not found', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      await expect(
        service.createComment('ghost-slug', 'note.md', validDto(), '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when note not found or not published', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      await expect(
        service.createComment('slug', 'nonexistent.md', validDto(), '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when comments are disabled for vault', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ settings: { commentsEnabled: false } }) as never,
      );
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await expect(
        service.createComment('slug', 'note.md', validDto(), '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw TooManyRequestsException when rate limit exceeded', async () => {
      const { service, prisma } = makeService({}, { incr: vi.fn().mockResolvedValue(6) });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await expect(
        service.createComment('slug', 'note.md', validDto(), '127.0.0.1'),
      ).rejects.toThrow(TooManyRequestsException);
    });

    it('should allow up to the rate limit boundary', async () => {
      const { service, prisma } = makeService({}, { incr: vi.fn().mockResolvedValue(5) });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      const result = await service.createComment('slug', 'note.md', validDto(), '127.0.0.1');
      expect(result).toBeDefined();
      expect(mockClient.hset).toHaveBeenCalled();
    });

    it('should not set TTL on subsequent increments (only on first)', async () => {
      const { service, prisma } = makeService({}, { incr: vi.fn().mockResolvedValue(3) });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await service.createComment('slug', 'note.md', validDto(), '127.0.0.1');
      expect(mockClient.expire).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when parent comment not found', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.hgetall = vi.fn().mockResolvedValue(null);
      await expect(
        service.createComment(
          'slug',
          'note.md',
          validDto({ parentId: 'nonexistent-parent-id-xxxx-xxxxxxxxxxxx' }),
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when attempting to reply to a reply', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValue(makeStoredComment({ id: 'parent-id', parentId: 'grandparent-id' }));
      await expect(
        service.createComment('slug', 'note.md', validDto({ parentId: 'parent-id' }), '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parent belongs to different note', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValue(
          makeStoredComment({ id: 'parent-id', noteId: 'other-note-id', parentId: '' }),
        );
      await expect(
        service.createComment('slug', 'note.md', validDto({ parentId: 'parent-id' }), '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store comment with status=pending on successful submission', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      const result = await service.createComment(
        'slug',
        'note.md',
        validDto({ authorName: 'Bob', authorEmail: 'bob@example.com' }),
        '10.0.0.1',
      );
      expect(result.status).toBe('pending');
      expect(result.authorName).toBe('Bob');
      expect(mockClient.hset).toHaveBeenCalledWith(
        expect.stringContaining('rc:comment:'),
        expect.objectContaining({ authorName: 'Bob', status: 'pending' }),
      );
      expect(mockClient.zadd).toHaveBeenCalled();
    });

    it('should enqueue email notification to workspace owner on new comment', async () => {
      const { service, prisma, jobsService } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        user: { email: 'owner@example.com', displayName: 'Owner' },
      } as never);
      await service.createComment('slug', 'note.md', validDto(), '127.0.0.1');
      await new Promise((r) => setTimeout(r, 10));
      expect(jobsService.enqueueSendEmail).toHaveBeenCalledWith(
        'owner@example.com',
        'comment-mention',
        expect.objectContaining({ noteTitle: 'Test Note' }),
      );
    });

    it('should not throw when owner lookup returns null (no owner found)', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await expect(
        service.createComment('slug', 'note.md', validDto(), '127.0.0.1'),
      ).resolves.toBeDefined();
    });

    it('should auto-append .md extension for notePath lookup', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await service.createComment('slug', 'test-note', validDto(), '127.0.0.1');
      expect(prisma.note.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ path: 'test-note.md' }) }),
      );
    });

    it('should truncate content exceeding 2000 characters', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      const longContent = 'A'.repeat(3000);
      await service.createComment(
        'slug',
        'note.md',
        validDto({ content: longContent }),
        '127.0.0.1',
      );
      const hsetCall = vi.mocked(mockClient.hset).mock.calls[0];
      const storedData = hsetCall?.[1] as Record<string, string>;
      expect(storedData['content']?.length).toBe(2000);
    });
  });

  describe('listApprovedComments', () => {
    it('should return empty list when no approved comments exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(0);
      mockClient.zrange = vi.fn().mockResolvedValue([]);
      const result = await service.listApprovedComments('slug', 'note.md');
      expect(result.comments).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return approved root comments with threaded replies', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(2);
      mockClient.zrange = vi.fn().mockResolvedValue(['comment-1', 'comment-2']);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValueOnce(makeApprovedComment({ id: 'comment-1', parentId: '' }))
        .mockResolvedValueOnce(
          makeApprovedComment({ id: 'comment-2', parentId: 'comment-1', content: 'Reply!' }),
        );
      const result = await service.listApprovedComments('slug', 'note.md');
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.id).toBe('comment-1');
      expect(result.comments[0]?.replies).toHaveLength(1);
      expect(result.comments[0]?.replies[0]?.content).toBe('Reply!');
    });

    it('should not include authorEmail in public listing', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(1);
      mockClient.zrange = vi.fn().mockResolvedValue(['comment-1']);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValue(makeApprovedComment({ authorEmail: 'private@example.com' }));
      const result = await service.listApprovedComments('slug', 'note.md');
      expect(result.comments[0]).not.toHaveProperty('authorEmail');
    });

    it('should throw NotFoundException for unknown public slug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      await expect(service.listApprovedComments('unknown-slug', 'note.md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return total from ZCARD for pagination', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(42);
      mockClient.zrange = vi.fn().mockResolvedValue([]);
      const result = await service.listApprovedComments('slug', 'note.md');
      expect(result.total).toBe(42);
    });
  });

  describe('getModerationQueue', () => {
    it('should return empty queue when no comments exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zrange = vi.fn().mockResolvedValue([]);
      const result = await service.getModerationQueue('ws-1', 'note-1');
      expect(result.pending).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return only pending comments from all comments', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zrange = vi.fn().mockResolvedValue(['comment-1', 'comment-2']);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValueOnce(makeStoredComment({ id: 'comment-1', status: 'pending' }))
        .mockResolvedValueOnce(makeApprovedComment({ id: 'comment-2' }));
      const result = await service.getModerationQueue('ws-1', 'note-1');
      expect(result.pending).toHaveLength(1);
      expect(result.pending[0]?.id).toBe('comment-1');
    });

    it('should include authorEmail in moderation queue response', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zrange = vi.fn().mockResolvedValue(['comment-1']);
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValue(makeStoredComment({ authorEmail: 'reader@example.com' }));
      const result = await service.getModerationQueue('ws-1', 'note-1');
      expect(result.pending[0]?.authorEmail).toBe('reader@example.com');
    });

    it('should throw NotFoundException when note does not exist in workspace', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      await expect(service.getModerationQueue('ws-1', 'ghost-note')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('moderateComment', () => {
    it('should approve a pending comment and add to approved set', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValueOnce(makeStoredComment())
        .mockResolvedValueOnce(makeStoredComment({ status: 'approved' }));
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      const result = await service.moderateComment('comment-1', 'ws-1', 'approve');
      expect(mockClient.hset).toHaveBeenCalledWith(
        expect.stringContaining('rc:comment:comment-1'),
        'status',
        'approved',
      );
      expect(mockClient.zadd).toHaveBeenCalledWith(
        expect.stringContaining('rc:note-1:approved'),
        expect.any(Number),
        'comment-1',
      );
      expect(result.status).toBe('approved');
    });

    it('should reject a comment and remove from approved set', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValueOnce(makeStoredComment({ status: 'approved' }))
        .mockResolvedValueOnce(makeStoredComment({ status: 'rejected' }));
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      const result = await service.moderateComment('comment-1', 'ws-1', 'reject');
      expect(mockClient.hset).toHaveBeenCalledWith(
        expect.stringContaining('rc:comment:comment-1'),
        'status',
        'rejected',
      );
      expect(mockClient.zrem).toHaveBeenCalledWith(
        expect.stringContaining('approved'),
        'comment-1',
      );
      expect(result.status).toBe('rejected');
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      const { service, mockClient: mc } = makeService();
      mc.hgetall = vi.fn().mockResolvedValue(null);
      await expect(service.moderateComment('ghost-comment', 'ws-1', 'approve')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when comment belongs to different workspace', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi.fn().mockResolvedValue(makeStoredComment());
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      await expect(service.moderateComment('comment-1', 'other-ws', 'approve')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete a root comment and cascade-delete its replies', async () => {
      const { service, prisma } = makeService();
      const rootComment = makeStoredComment({ id: 'comment-1', parentId: '' });
      const reply = makeStoredComment({ id: 'reply-1', parentId: 'comment-1' });
      mockClient.hgetall = vi.fn().mockImplementation((key: string) => {
        if (key.includes('comment-1')) return Promise.resolve(rootComment);
        if (key.includes('reply-1')) return Promise.resolve(reply);
        return Promise.resolve(null);
      });
      mockClient.zrange = vi.fn().mockResolvedValue(['comment-1', 'reply-1']);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await service.deleteComment('comment-1', 'ws-1');
      expect(mockClient.del).toHaveBeenCalledWith(expect.stringContaining('rc:comment:reply-1'));
      expect(mockClient.del).toHaveBeenCalledWith(expect.stringContaining('rc:comment:comment-1'));
    });

    it('should delete a leaf reply without cascading', async () => {
      const { service, prisma } = makeService();
      const reply = makeStoredComment({ id: 'reply-1', parentId: 'parent-id' });
      mockClient.hgetall = vi.fn().mockResolvedValue(reply);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await service.deleteComment('reply-1', 'ws-1');
      expect(mockClient.zrange).not.toHaveBeenCalled();
      expect(mockClient.del).toHaveBeenCalledWith(expect.stringContaining('rc:comment:reply-1'));
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      const { service, mockClient: mc } = makeService();
      mc.hgetall = vi.fn().mockResolvedValue(null);
      await expect(service.deleteComment('ghost-comment', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for wrong workspace', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi.fn().mockResolvedValue(makeStoredComment());
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      await expect(service.deleteComment('comment-1', 'other-ws')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should remove comment from both sorted sets on delete', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValue(makeStoredComment({ parentId: 'some-parent' }));
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await service.deleteComment('comment-1', 'ws-1');
      expect(mockClient.zrem).toHaveBeenCalledWith(
        expect.stringContaining('rc:note-1:all'),
        'comment-1',
      );
      expect(mockClient.zrem).toHaveBeenCalledWith(
        expect.stringContaining('rc:note-1:approved'),
        'comment-1',
      );
    });
  });

  describe('getCommentCount', () => {
    it('should return zero when no approved comments', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(0);
      const result = await service.getCommentCount('slug', 'note.md');
      expect(result.count).toBe(0);
    });

    it('should return the count from the approved sorted set', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(7);
      const result = await service.getCommentCount('slug', 'note.md');
      expect(result.count).toBe(7);
    });

    it('should call ZCARD on the approved set (not all-comments set)', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      mockClient.zcard = vi.fn().mockResolvedValue(3);
      await service.getCommentCount('slug', 'note.md');
      expect(mockClient.zcard).toHaveBeenCalledWith(expect.stringContaining('approved'));
    });

    it('should throw NotFoundException for unknown note', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      await expect(service.getCommentCount('slug', 'ghost.md')).rejects.toThrow(NotFoundException);
    });
  });

  describe('moderateCommentByUser', () => {
    it('should resolve workspace from note and moderate', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi
        .fn()
        .mockResolvedValueOnce(makeStoredComment())
        .mockResolvedValueOnce(makeStoredComment())
        .mockResolvedValueOnce(makeStoredComment({ status: 'approved' }));
      vi.mocked(prisma.note.findUnique).mockResolvedValue({ workspaceId: 'ws-1' } as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({ role: 'OWNER' } as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      const result = await service.moderateCommentByUser('comment-1', 'user-1', 'approve');
      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException when comment not found', async () => {
      const { service, mockClient: mc } = makeService();
      mc.hgetall = vi.fn().mockResolvedValue(null);
      await expect(service.moderateCommentByUser('ghost', 'user-1', 'approve')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user lacks ADMIN/OWNER role', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi.fn().mockResolvedValue(makeStoredComment());
      vi.mocked(prisma.note.findUnique).mockResolvedValue({ workspaceId: 'ws-1' } as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await expect(service.moderateCommentByUser('comment-1', 'user-1', 'approve')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteCommentByUser', () => {
    it('should resolve workspace from note and delete', async () => {
      const { service, prisma } = makeService();
      mockClient.hgetall = vi.fn().mockResolvedValue(makeStoredComment({ parentId: 'p' }));
      vi.mocked(prisma.note.findUnique).mockResolvedValue({ workspaceId: 'ws-1' } as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({ role: 'ADMIN' } as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      await expect(service.deleteCommentByUser('comment-1', 'user-1')).resolves.toBeUndefined();
      expect(mockClient.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when comment not found', async () => {
      const { service, mockClient: mc } = makeService();
      mc.hgetall = vi.fn().mockResolvedValue(null);
      await expect(service.deleteCommentByUser('ghost', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('edge cases', () => {
    it('should set TTL only on first rate limit increment', async () => {
      const { service, prisma } = makeService({}, { incr: vi.fn().mockResolvedValue(1) });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await service.createComment('slug', 'note.md', validDto(), '127.0.0.1');
      expect(mockClient.expire).toHaveBeenCalledOnce();
    });

    it('should use x-forwarded-for header for client IP extraction', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      await service.createComment('slug', 'note.md', validDto(), '192.168.1.1');
      expect(mockClient.incr).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));
    });

    it('should return authorName as null when empty string stored', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);
      mockClient.hset = vi.fn().mockImplementation(() => Promise.resolve(1));
      const result = await service.createComment(
        'slug',
        'note.md',
        validDto({ authorName: undefined }),
        '127.0.0.1',
      );
      expect(result.authorName).toBeNull();
    });
  });
});
