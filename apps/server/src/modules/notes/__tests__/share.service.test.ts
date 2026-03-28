import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock PrismaClient — must be defined before importing the service so the
// constructor receives the mocked version.
// ---------------------------------------------------------------------------

const mockNote = { findUnique: vi.fn() };
const mockNoteShare = {
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
};
const mockUser = { findUnique: vi.fn() };
const mockWorkspaceMember = { findUnique: vi.fn() };

vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    note = mockNote;
    noteShare = mockNoteShare;
    user = mockUser;
    workspaceMember = mockWorkspaceMember;
  }
  return { PrismaClient: MockPrismaClient };
});

import { ShareService } from '../share.service';

const mockPrisma = {
  note: mockNote,
  noteShare: mockNoteShare,
  user: mockUser,
  workspaceMember: mockWorkspaceMember,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('ShareService', () => {
  let service: ShareService;

  const userId = 'user-1';
  const noteId = 'note-1';
  const workspaceId = 'workspace-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShareService();
  });

  // -----------------------------------------------------------------------
  // createShare — email
  // -----------------------------------------------------------------------

  describe('createShare (email)', () => {
    it('should create an email share with a valid user', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId }) // assertNoteExists
        .mockResolvedValueOnce({ createdById: userId, workspaceId }); // assertUserCanShare

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'bob@example.com',
        displayName: 'Bob',
      });

      mockPrisma.noteShare.findFirst.mockResolvedValue(null); // no existing share

      mockPrisma.noteShare.create.mockResolvedValue({
        id: 'share-1',
        noteId,
        sharedBy: userId,
        sharedWith: 'user-2',
        permission: 'VIEW',
        token: 'abc123',
        passwordHash: null,
        expiresAt: null,
        accessCount: 0,
        lastAccessedAt: null,
        createdAt: new Date('2026-03-28'),
        sharedWithUser: { email: 'bob@example.com', displayName: 'Bob' },
      });

      const result = await service.createShare(noteId, userId, {
        type: 'email',
        email: 'bob@example.com',
        permission: 'VIEW',
      });

      expect(result.sharedWithEmail).toBe('bob@example.com');
      expect(result.sharedWithName).toBe('Bob');
      expect(result.permission).toBe('VIEW');
      expect(result.hasPassword).toBe(false);
    });

    it('should throw NotFoundException for non-existent user email', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId })
        .mockResolvedValueOnce({ createdById: userId, workspaceId });

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createShare(noteId, userId, {
          type: 'email',
          email: 'nobody@example.com',
          permission: 'VIEW',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when sharing with yourself', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId })
        .mockResolvedValueOnce({ createdById: userId, workspaceId });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'me@example.com',
        displayName: 'Me',
      });

      await expect(
        service.createShare(noteId, userId, {
          type: 'email',
          email: 'me@example.com',
          permission: 'VIEW',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate share', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId })
        .mockResolvedValueOnce({ createdById: userId, workspaceId });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'bob@example.com',
        displayName: 'Bob',
      });

      mockPrisma.noteShare.findFirst.mockResolvedValue({ id: 'existing-share' });

      await expect(
        service.createShare(noteId, userId, {
          type: 'email',
          email: 'bob@example.com',
          permission: 'VIEW',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // createShare — link
  // -----------------------------------------------------------------------

  describe('createShare (link)', () => {
    it('should create a link share without password', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId })
        .mockResolvedValueOnce({ createdById: userId, workspaceId });

      mockPrisma.noteShare.create.mockResolvedValue({
        id: 'share-link-1',
        noteId,
        sharedBy: userId,
        sharedWith: null,
        permission: 'VIEW',
        token: 'token-abc',
        passwordHash: null,
        expiresAt: null,
        accessCount: 0,
        lastAccessedAt: null,
        createdAt: new Date('2026-03-28'),
        sharedWithUser: null,
      });

      const result = await service.createShare(noteId, userId, {
        type: 'link',
        permission: 'VIEW',
      });

      expect(result.sharedWith).toBeNull();
      expect(result.hasPassword).toBe(false);
      expect(result.token).toBeDefined();
    });

    it('should create a link share with password', async () => {
      mockPrisma.note.findUnique
        .mockResolvedValueOnce({ id: noteId })
        .mockResolvedValueOnce({ createdById: userId, workspaceId });

      mockPrisma.noteShare.create.mockResolvedValue({
        id: 'share-link-2',
        noteId,
        sharedBy: userId,
        sharedWith: null,
        permission: 'EDIT',
        token: 'token-xyz',
        passwordHash: 'hashed',
        expiresAt: null,
        accessCount: 0,
        lastAccessedAt: null,
        createdAt: new Date('2026-03-28'),
        sharedWithUser: null,
      });

      const result = await service.createShare(noteId, userId, {
        type: 'link',
        permission: 'EDIT',
        password: 'secret123',
      });

      expect(result.hasPassword).toBe(true);
      expect(result.permission).toBe('EDIT');
    });
  });

  // -----------------------------------------------------------------------
  // listShares
  // -----------------------------------------------------------------------

  describe('listShares', () => {
    it('should return all shares for a note', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({ id: noteId });

      mockPrisma.noteShare.findMany.mockResolvedValue([
        {
          id: 'share-1',
          noteId,
          sharedBy: userId,
          sharedWith: 'user-2',
          permission: 'VIEW',
          token: 'token1',
          passwordHash: null,
          expiresAt: null,
          accessCount: 3,
          lastAccessedAt: new Date('2026-03-27'),
          createdAt: new Date('2026-03-20'),
          sharedWithUser: { email: 'bob@example.com', displayName: 'Bob' },
        },
      ]);

      const result = await service.listShares(noteId);

      expect(result).toHaveLength(1);
      expect(result[0]!.sharedWithEmail).toBe('bob@example.com');
      expect(result[0]!.accessCount).toBe(3);
    });

    it('should throw NotFoundException for non-existent note', async () => {
      mockPrisma.note.findUnique.mockResolvedValue(null);

      await expect(service.listShares('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // deleteShare
  // -----------------------------------------------------------------------

  describe('deleteShare', () => {
    it('should delete a share owned by the user', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        sharedBy: userId,
      });

      mockPrisma.noteShare.delete.mockResolvedValue({});

      await service.deleteShare(noteId, 'share-1', userId);

      expect(mockPrisma.noteShare.delete).toHaveBeenCalledWith({
        where: { id: 'share-1' },
      });
    });

    it('should throw NotFoundException for non-existent share', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue(null);

      await expect(service.deleteShare(noteId, 'bad-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-creator non-admin tries to delete', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        sharedBy: 'other-user',
      });

      mockPrisma.note.findUnique.mockResolvedValue({ workspaceId });

      mockPrisma.workspaceMember.findUnique.mockResolvedValue({
        role: 'VIEWER',
      });

      await expect(service.deleteShare(noteId, 'share-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getShareByToken
  // -----------------------------------------------------------------------

  describe('getShareByToken', () => {
    it('should return share metadata for a valid token', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'VIEW',
        passwordHash: null,
        expiresAt: null,
        note: { id: noteId, title: 'My Note' },
        sharedByUser: { displayName: 'Alice' },
      });

      const result = await service.getShareByToken('valid-token');

      expect(result.noteTitle).toBe('My Note');
      expect(result.requiresPassword).toBe(false);
      expect(result.isExpired).toBe(false);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue(null);

      await expect(service.getShareByToken('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('should mark expired shares as expired', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'VIEW',
        passwordHash: null,
        expiresAt: new Date('2020-01-01'),
        note: { id: noteId, title: 'My Note' },
        sharedByUser: { displayName: 'Alice' },
      });

      const result = await service.getShareByToken('expired-token');

      expect(result.isExpired).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // verifySharePassword
  // -----------------------------------------------------------------------

  describe('verifySharePassword', () => {
    it('should throw UnauthorizedException for wrong password', async () => {
      // Compute the hash for "correct-password" to set up the mock
      const { createHash } = await import('crypto');
      const correctHash = createHash('sha256').update('correct-password').digest('hex');

      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'VIEW',
        passwordHash: correctHash,
        expiresAt: null,
      });

      await expect(service.verifySharePassword('token-1', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException for expired share', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'VIEW',
        passwordHash: 'hash',
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.verifySharePassword('token-1', 'any')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // accessShareLink
  // -----------------------------------------------------------------------

  describe('accessShareLink', () => {
    it('should grant access for a non-password share', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'COMMENT',
        passwordHash: null,
        expiresAt: null,
      });

      mockPrisma.noteShare.update.mockResolvedValue({});

      const result = await service.accessShareLink('good-token');

      expect(result.noteId).toBe(noteId);
      expect(result.permission).toBe('COMMENT');
    });

    it('should throw BadRequestException for password-protected share', async () => {
      mockPrisma.noteShare.findUnique.mockResolvedValue({
        id: 'share-1',
        noteId,
        permission: 'VIEW',
        passwordHash: 'some-hash',
        expiresAt: null,
      });

      await expect(service.accessShareLink('pw-token')).rejects.toThrow(BadRequestException);
    });
  });
});
