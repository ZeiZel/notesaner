import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComponentOverridesService } from '../component-overrides.service';

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  workspaceMember: {
    findUnique: vi.fn(),
  },
  componentOverride: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  overrideAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../../../prisma/prisma.service', () => ({
  PrismaService: vi.fn().mockImplementation(() => mockPrisma),
}));

// getComponentMeta is a pure function — no mock needed unless testing unknown ids.

// ── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-1';
const USER_ID = 'user-1';
const COMPONENT_ID = 'NoteCard';

function adminMember() {
  return { role: 'OWNER' };
}

function noMember() {
  return null;
}

function makeOverride(partial: Partial<{ status: string; sourceCode: string }> = {}) {
  return {
    id: 'ov-1',
    workspaceId: WORKSPACE_ID,
    componentId: COMPONENT_ID,
    sourceCode: 'export default function NoteCard() { return null; }',
    compiledCode: null,
    pinnedBaseVersion: '1.0.0',
    status: 'draft',
    compileError: null,
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ComponentOverridesService', () => {
  let service: ComponentOverridesService;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaService } = require('../../../prisma/prisma.service');
    service = new ComponentOverridesService(new PrismaService());
  });

  // ── assertAdminRole ──────────────────────────────────────────────────────

  describe('admin role guard', () => {
    it('throws ForbiddenException when user has no membership', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(noMember());
      mockPrisma.componentOverride.findMany.mockResolvedValue([]);

      await expect(service.list(WORKSPACE_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role is EDITOR', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'EDITOR' });
      mockPrisma.componentOverride.findMany.mockResolvedValue([]);

      await expect(service.list(WORKSPACE_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('allows OWNER role', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      mockPrisma.componentOverride.findMany.mockResolvedValue([]);

      const result = await service.list(WORKSPACE_ID, USER_ID);
      expect(result).toEqual([]);
    });

    it('allows ADMIN role', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockPrisma.componentOverride.findMany.mockResolvedValue([]);

      const result = await service.list(WORKSPACE_ID, USER_ID);
      expect(result).toEqual([]);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequestException for unknown componentId', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());

      await expect(
        service.create(WORKSPACE_ID, { componentId: 'Unknown', sourceCode: '' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when override already exists', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      mockPrisma.componentOverride.findUnique.mockResolvedValue(makeOverride());

      await expect(
        service.create(
          WORKSPACE_ID,
          { componentId: COMPONENT_ID, sourceCode: 'new code' },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a draft override and writes audit log', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      mockPrisma.componentOverride.findUnique.mockResolvedValue(null);
      const record = makeOverride();
      mockPrisma.componentOverride.create.mockResolvedValue(record);
      mockPrisma.overrideAuditLog.create.mockResolvedValue({});

      const result = await service.create(
        WORKSPACE_ID,
        { componentId: COMPONENT_ID, sourceCode: 'code' },
        USER_ID,
      );

      expect(result).toEqual(record);
      expect(mockPrisma.overrideAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'created', newStatus: 'draft' }),
        }),
      );
    });
  });

  // ── getOne ───────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('throws NotFoundException when no override exists', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      mockPrisma.componentOverride.findUnique.mockResolvedValue(null);

      await expect(service.getOne(WORKSPACE_ID, COMPONENT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns existing override', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      const record = makeOverride();
      mockPrisma.componentOverride.findUnique.mockResolvedValue(record);

      const result = await service.getOne(WORKSPACE_ID, COMPONENT_ID, USER_ID);
      expect(result).toEqual(record);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('resets status to draft when source changes', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      const record = makeOverride({ status: 'active' });
      mockPrisma.componentOverride.findUnique.mockResolvedValue(record);
      const updated = makeOverride({ status: 'draft' });
      mockPrisma.componentOverride.update.mockResolvedValue(updated);
      mockPrisma.overrideAuditLog.create.mockResolvedValue({});

      const result = await service.update(
        WORKSPACE_ID,
        COMPONENT_ID,
        { sourceCode: 'new' },
        USER_ID,
      );
      expect(result.status).toBe('draft');
    });
  });

  // ── revert ───────────────────────────────────────────────────────────────

  describe('revert', () => {
    it('sets status to reverted and clears compiledCode', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(adminMember());
      const record = makeOverride({ status: 'active' });
      mockPrisma.componentOverride.findUnique.mockResolvedValue(record);
      const reverted = makeOverride({ status: 'reverted' });
      mockPrisma.componentOverride.update.mockResolvedValue(reverted);
      mockPrisma.overrideAuditLog.create.mockResolvedValue({});

      const result = await service.revert(WORKSPACE_ID, COMPONENT_ID, USER_ID);

      expect(mockPrisma.componentOverride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'reverted', compiledCode: null }),
        }),
      );
      expect(result.status).toBe('reverted');
    });
  });

  // ── getRegistry ──────────────────────────────────────────────────────────

  describe('getRegistry', () => {
    it('returns all 8 overridable components', async () => {
      const registry = await service.getRegistry();
      expect(registry).toHaveLength(8);
      const ids = registry.map((c) => c.id);
      expect(ids).toContain('NoteCard');
      expect(ids).toContain('CodeBlock');
      expect(ids).toContain('SearchResultItem');
    });
  });
});
