import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock PrismaClient — must be defined before importing the service so the
// constructor receives the mocked version.
// ---------------------------------------------------------------------------

const mockWorkspaceMember = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
};
const mockWorkspace = { findUnique: vi.fn() };

vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    workspaceMember = mockWorkspaceMember;
    workspace = mockWorkspace;
  }
  return { PrismaClient: MockPrismaClient };
});

import { WorkspaceSwitchService } from '../workspace-switch.service';

const mockPrisma = {
  workspaceMember: mockWorkspaceMember,
  workspace: mockWorkspace,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('WorkspaceSwitchService', () => {
  let service: WorkspaceSwitchService;

  const userId = 'user-1';
  const workspaceId = 'ws-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceSwitchService();
  });

  // -----------------------------------------------------------------------
  // listUserWorkspaces
  // -----------------------------------------------------------------------

  describe('listUserWorkspaces', () => {
    it('should return workspaces with stats and role', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        {
          role: 'OWNER',
          workspace: {
            id: workspaceId,
            name: 'My Workspace',
            slug: 'my-workspace',
            description: 'A description',
            isPublic: false,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-03-28'),
            _count: { members: 5, notes: 42 },
          },
        },
        {
          role: 'EDITOR',
          workspace: {
            id: 'ws-2',
            name: 'Team Notes',
            slug: 'team-notes',
            description: null,
            isPublic: true,
            createdAt: new Date('2026-02-15'),
            updatedAt: new Date('2026-03-27'),
            _count: { members: 12, notes: 200 },
          },
        },
      ]);

      const result = await service.listUserWorkspaces(userId);

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('My Workspace');
      expect(result[0]!.role).toBe('OWNER');
      expect(result[0]!.memberCount).toBe(5);
      expect(result[0]!.noteCount).toBe(42);
      expect(result[1]!.role).toBe('EDITOR');
      expect(result[1]!.isPublic).toBe(true);
    });

    it('should return empty array for user with no workspaces', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

      const result = await service.listUserWorkspaces(userId);

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // switchWorkspace
  // -----------------------------------------------------------------------

  describe('switchWorkspace', () => {
    it('should return workspace details and membership for valid member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({
        role: 'ADMIN',
        joinedAt: new Date('2026-02-01'),
        workspace: {
          id: workspaceId,
          name: 'My Workspace',
          slug: 'my-workspace',
          description: 'A description',
          isPublic: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-03-28'),
        },
      });

      const result = await service.switchWorkspace(userId, workspaceId);

      expect(result.workspace.name).toBe('My Workspace');
      expect(result.workspace.slug).toBe('my-workspace');
      expect(result.membership.role).toBe('ADMIN');
      expect(result.membership.joinedAt).toMatch(/2026-02-01/);
    });

    it('should throw ForbiddenException for non-member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: workspaceId });

      await expect(service.switchWorkspace(userId, workspaceId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent workspace', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.switchWorkspace(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
