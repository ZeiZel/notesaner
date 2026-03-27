/**
 * Unit tests for CommentsService.
 *
 * PrismaClient is fully mocked so no database connection is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock PrismaClient before importing the service so the constructor receives
// the mocked version.
// ---------------------------------------------------------------------------
const mockNote = { findUnique: vi.fn() };
const mockComment = {
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrisma = {
  note: mockNote,
  comment: mockComment,
};

vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    note = mockNote;
    comment = mockComment;
  }
  return { PrismaClient: MockPrismaClient };
});

import { CommentsService } from '../comments.service';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const NOTE_ID = 'note-001';
const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const COMMENT_ID = 'comment-001';
const REPLY_ID = 'reply-001';

const baseUser = { id: USER_ID, displayName: 'Alice', avatarUrl: null };

function makeComment(overrides: Partial<{
  id: string;
  noteId: string;
  userId: string;
  content: string;
  position: unknown;
  parentId: string | null;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: COMMENT_ID,
    noteId: NOTE_ID,
    userId: USER_ID,
    content: 'Hello world',
    position: null,
    parentId: null,
    isResolved: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    user: baseUser,
    replies: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommentsService();
  });

  // -------------------------------------------------------------------------
  // createComment
  // -------------------------------------------------------------------------

  describe('createComment', () => {
    it('creates a root comment and returns it with empty replies', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });
      const created = makeComment({ content: 'A comment' });
      mockPrisma.comment.create.mockResolvedValue(created);

      const result = await service.createComment(NOTE_ID, USER_ID, {
        content: 'A comment',
        position: { from: 10, to: 20 },
      });

      expect(result.id).toBe(COMMENT_ID);
      expect(result.replies).toEqual([]);
      expect(result.mentionedUsers).toEqual([]);
      expect(mockPrisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            noteId: NOTE_ID,
            userId: USER_ID,
            content: 'A comment',
            parentId: null,
          }),
        }),
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockPrisma.note.findUnique.mockResolvedValue(null);

      await expect(
        service.createComment('nonexistent-note', USER_ID, { content: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ZodError for empty content', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });

      await expect(
        service.createComment(NOTE_ID, USER_ID, { content: '' }),
      ).rejects.toThrow();
    });

    it('parses @mentions from content', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });
      const created = makeComment({ content: 'Hey @bob and @alice, see this!' });
      mockPrisma.comment.create.mockResolvedValue(created);

      const result = await service.createComment(NOTE_ID, USER_ID, {
        content: 'Hey @bob and @alice, see this!',
      });

      expect(result.mentionedUsers).toContain('bob');
      expect(result.mentionedUsers).toContain('alice');
    });

    it('deduplicates repeated @mentions', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });
      const created = makeComment({ content: '@bob @bob @bob' });
      mockPrisma.comment.create.mockResolvedValue(created);

      const result = await service.createComment(NOTE_ID, USER_ID, {
        content: '@bob @bob @bob',
      });

      expect(result.mentionedUsers.filter((u) => u === 'bob')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // listComments
  // -------------------------------------------------------------------------

  describe('listComments', () => {
    it('returns comments sorted by position.from ascending', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });

      const comments = [
        makeComment({ id: 'c3', position: { from: 100, to: 110 } }),
        makeComment({ id: 'c1', position: { from: 0, to: 5 } }),
        makeComment({ id: 'c2', position: { from: 50, to: 60 } }),
      ];
      mockPrisma.comment.findMany.mockResolvedValue(comments);

      const result = await service.listComments(NOTE_ID);

      expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('places comments without position at the end', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });

      const comments = [
        makeComment({ id: 'c-nopos', position: null }),
        makeComment({ id: 'c-pos', position: { from: 10, to: 20 } }),
      ];
      mockPrisma.comment.findMany.mockResolvedValue(comments);

      const result = await service.listComments(NOTE_ID);

      expect(result[0].id).toBe('c-pos');
      expect(result[1].id).toBe('c-nopos');
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockPrisma.note.findUnique.mockResolvedValue(null);

      await expect(service.listComments('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns mentionedUsers computed from content', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: NOTE_ID });
      mockPrisma.comment.findMany.mockResolvedValue([
        makeComment({ content: 'cc @dave' }),
      ]);

      const [comment] = await service.listComments(NOTE_ID);
      expect(comment.mentionedUsers).toContain('dave');
    });
  });

  // -------------------------------------------------------------------------
  // updateComment
  // -------------------------------------------------------------------------

  describe('updateComment', () => {
    it('allows the author to edit content', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment());
      const updated = makeComment({ content: 'Updated text' });
      mockPrisma.comment.update.mockResolvedValue({ ...updated, replies: [] });

      const result = await service.updateComment(COMMENT_ID, USER_ID, {
        content: 'Updated text',
      });

      expect(result.content).toBe('Updated text');
    });

    it('throws ForbiddenException when non-author tries to edit', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment());

      await expect(
        service.updateComment(COMMENT_ID, OTHER_USER_ID, { content: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown commentId', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateComment('ghost-id', USER_ID, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects empty content', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment());

      await expect(
        service.updateComment(COMMENT_ID, USER_ID, { content: '' }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // deleteComment
  // -------------------------------------------------------------------------

  describe('deleteComment', () => {
    it('allows the author to delete their comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment());
      mockPrisma.comment.delete.mockResolvedValue({});

      await expect(
        service.deleteComment(COMMENT_ID, USER_ID, false),
      ).resolves.toBeUndefined();

      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    });

    it('allows an admin to delete any comment', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment({ userId: OTHER_USER_ID }));
      mockPrisma.comment.delete.mockResolvedValue({});

      await expect(
        service.deleteComment(COMMENT_ID, USER_ID, true /* isAdmin */),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when non-admin non-author tries to delete', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(makeComment({ userId: OTHER_USER_ID }));

      await expect(
        service.deleteComment(COMMENT_ID, USER_ID, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown commentId', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteComment('ghost-id', USER_ID, false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // createReply
  // -------------------------------------------------------------------------

  describe('createReply', () => {
    it('creates a reply attached to a root comment', async () => {
      const parent = makeComment({ id: COMMENT_ID, parentId: null });
      mockPrisma.comment.findUnique.mockResolvedValue(parent);

      const reply = makeComment({ id: REPLY_ID, parentId: COMMENT_ID, content: 'A reply' });
      mockPrisma.comment.create.mockResolvedValue(reply);

      const result = await service.createReply(COMMENT_ID, USER_ID, {
        content: 'A reply',
      });

      expect(result.parentId).toBe(COMMENT_ID);
      expect(mockPrisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: COMMENT_ID,
            noteId: NOTE_ID,
          }),
        }),
      );
    });

    it('rejects replying to a reply (max depth = 1)', async () => {
      const nestedReply = makeComment({ id: REPLY_ID, parentId: COMMENT_ID });
      mockPrisma.comment.findUnique.mockResolvedValue(nestedReply);

      await expect(
        service.createReply(REPLY_ID, USER_ID, { content: 'nested' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when parent comment does not exist', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.createReply('ghost-parent', USER_ID, { content: 'reply' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // resolveComment
  // -------------------------------------------------------------------------

  describe('resolveComment', () => {
    it('resolves an open comment thread', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(
        makeComment({ isResolved: false, parentId: null }),
      );
      const resolved = makeComment({ isResolved: true });
      mockPrisma.comment.update.mockResolvedValue({ ...resolved, replies: [] });

      const result = await service.resolveComment(COMMENT_ID, USER_ID);
      expect(result.isResolved).toBe(true);
      expect(mockPrisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isResolved: true } }),
      );
    });

    it('reopens an already-resolved comment thread (toggle)', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(
        makeComment({ isResolved: true, parentId: null }),
      );
      const reopened = makeComment({ isResolved: false });
      mockPrisma.comment.update.mockResolvedValue({ ...reopened, replies: [] });

      const result = await service.resolveComment(COMMENT_ID, USER_ID);
      expect(result.isResolved).toBe(false);
    });

    it('throws UnprocessableEntityException when trying to resolve a reply', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(
        makeComment({ parentId: COMMENT_ID }),
      );

      await expect(
        service.resolveComment(REPLY_ID, USER_ID),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException for unknown commentId', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveComment('ghost-id', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // parseMentions (unit)
  // -------------------------------------------------------------------------

  describe('parseMentions', () => {
    it('extracts single mention', () => {
      expect(service.parseMentions('hello @alice')).toEqual(['alice']);
    });

    it('extracts multiple distinct mentions', () => {
      const result = service.parseMentions('@alice and @bob');
      expect(result).toContain('alice');
      expect(result).toContain('bob');
      expect(result).toHaveLength(2);
    });

    it('deduplicates repeated mentions', () => {
      expect(service.parseMentions('@alice @alice @alice')).toHaveLength(1);
    });

    it('returns empty array when no mentions present', () => {
      expect(service.parseMentions('no mentions here')).toHaveLength(0);
    });

    it('handles mentions with dots and hyphens', () => {
      const result = service.parseMentions('@john.doe @jane-doe');
      expect(result).toContain('john.doe');
      expect(result).toContain('jane-doe');
    });
  });
});
