/**
 * LinkTypesService unit tests
 *
 * Tests cover:
 *   - listForWorkspace: includes built-ins and workspace customs
 *   - create: happy path, slug collision with built-in, slug collision with custom
 *   - delete: happy path, built-in guard, wrong workspace guard
 *   - setLinkType: happy path, clear type, link not found, type not accessible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LinkTypesService } from '../link-types.service';
import type { CreateLinkTypeDto } from '../dto/link-type.dto';
import type { LinkRelationshipType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeRelType(overrides: Partial<LinkRelationshipType> = {}): LinkRelationshipType {
  return {
    id: 'lrt-1',
    workspaceId: null,
    slug: 'relates-to',
    label: 'Relates to',
    color: '#6366f1',
    description: null,
    isBuiltIn: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makePrisma() {
  return {
    linkRelationshipType: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeRelType()),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    noteLink: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'link-1', relationshipTypeId: null }),
    },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('LinkTypesService', () => {
  let service: LinkTypesService;
  let prisma: ReturnType<typeof makePrisma>;

  const WORKSPACE_ID = 'ws-1';

  beforeEach(() => {
    prisma = makePrisma();
    service = new LinkTypesService(prisma as never);
  });

  // ─── listForWorkspace ────────────────────────────────────────────────────

  describe('listForWorkspace', () => {
    it('returns mapped DTOs including built-in and workspace types', async () => {
      const builtIn = makeRelType({ id: 'lrt-built-in' });
      const custom = makeRelType({
        id: 'lrt-custom',
        workspaceId: WORKSPACE_ID,
        slug: 'my-type',
        label: 'My Type',
        isBuiltIn: false,
      });

      prisma.linkRelationshipType.findMany.mockResolvedValue([builtIn, custom]);

      const result = await service.listForWorkspace(WORKSPACE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('lrt-built-in');
      expect(result[1].id).toBe('lrt-custom');
      expect(result[0].workspaceId).toBeNull();
      expect(result[1].workspaceId).toBe(WORKSPACE_ID);

      // Verify the query scope includes both null and workspace-specific rows
      expect(prisma.linkRelationshipType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ workspaceId: null }, { workspaceId: WORKSPACE_ID }],
          },
        }),
      );
    });

    it('returns empty array when no types exist', async () => {
      prisma.linkRelationshipType.findMany.mockResolvedValue([]);
      const result = await service.listForWorkspace(WORKSPACE_ID);
      expect(result).toEqual([]);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateLinkTypeDto = {
      slug: 'my-custom',
      label: 'My Custom Type',
      color: '#3b82f6',
    };

    it('creates a custom type when slug is available', async () => {
      // No conflicts
      prisma.linkRelationshipType.findFirst.mockResolvedValue(null);

      const created = makeRelType({
        id: 'lrt-new',
        workspaceId: WORKSPACE_ID,
        slug: dto.slug,
        label: dto.label,
        isBuiltIn: false,
      });
      prisma.linkRelationshipType.create.mockResolvedValue(created);

      const result = await service.create(WORKSPACE_ID, dto);

      expect(result.slug).toBe(dto.slug);
      expect(result.label).toBe(dto.label);
      expect(result.isBuiltIn).toBe(false);
      expect(prisma.linkRelationshipType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          slug: dto.slug,
          label: dto.label,
          isBuiltIn: false,
        }),
      });
    });

    it('throws ConflictException when slug collides with a built-in', async () => {
      // First findFirst call = built-in collision check
      prisma.linkRelationshipType.findFirst.mockResolvedValueOnce(makeRelType({ slug: dto.slug }));

      await expect(service.create(WORKSPACE_ID, dto)).rejects.toThrow(ConflictException);
      expect(prisma.linkRelationshipType.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when slug collides with existing custom type', async () => {
      // First call (built-in check) = null, second call (custom check) = existing
      prisma.linkRelationshipType.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          makeRelType({
            id: 'lrt-existing',
            workspaceId: WORKSPACE_ID,
            slug: dto.slug,
            isBuiltIn: false,
          }),
        );

      await expect(service.create(WORKSPACE_ID, dto)).rejects.toThrow(ConflictException);
    });

    it('uses default color #6366f1 when no color is provided', async () => {
      prisma.linkRelationshipType.findFirst.mockResolvedValue(null);

      const created = makeRelType({
        workspaceId: WORKSPACE_ID,
        slug: 'no-color',
        label: 'No Color',
        isBuiltIn: false,
        color: '#6366f1',
      });
      prisma.linkRelationshipType.create.mockResolvedValue(created);

      await service.create(WORKSPACE_ID, { slug: 'no-color', label: 'No Color' });

      expect(prisma.linkRelationshipType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ color: '#6366f1' }),
      });
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes a custom workspace type', async () => {
      const custom = makeRelType({
        id: 'lrt-custom',
        workspaceId: WORKSPACE_ID,
        slug: 'my-type',
        isBuiltIn: false,
      });
      prisma.linkRelationshipType.findUnique.mockResolvedValue(custom);

      await service.delete(WORKSPACE_ID, 'lrt-custom');

      expect(prisma.linkRelationshipType.delete).toHaveBeenCalledWith({
        where: { id: 'lrt-custom' },
      });
    });

    it('throws NotFoundException when type does not exist', async () => {
      prisma.linkRelationshipType.findUnique.mockResolvedValue(null);

      await expect(service.delete(WORKSPACE_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.linkRelationshipType.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when type belongs to different workspace', async () => {
      const otherWorkspaceType = makeRelType({
        id: 'lrt-other',
        workspaceId: 'other-ws',
        isBuiltIn: false,
      });
      prisma.linkRelationshipType.findUnique.mockResolvedValue(otherWorkspaceType);

      await expect(service.delete(WORKSPACE_ID, 'lrt-other')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when attempting to delete a built-in type', async () => {
      const builtIn = makeRelType({
        id: 'lrt-built-in',
        workspaceId: WORKSPACE_ID,
        isBuiltIn: true,
      });
      prisma.linkRelationshipType.findUnique.mockResolvedValue(builtIn);

      await expect(service.delete(WORKSPACE_ID, 'lrt-built-in')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.linkRelationshipType.delete).not.toHaveBeenCalled();
    });
  });

  // ─── setLinkType ─────────────────────────────────────────────────────────

  describe('setLinkType', () => {
    it('sets a relationship type on an existing link', async () => {
      prisma.noteLink.findFirst.mockResolvedValue({ id: 'link-1' });
      prisma.linkRelationshipType.findFirst.mockResolvedValue(makeRelType({ id: 'lrt-1' }));
      prisma.noteLink.update.mockResolvedValue({ id: 'link-1', relationshipTypeId: 'lrt-1' });

      const result = await service.setLinkType(WORKSPACE_ID, 'link-1', 'lrt-1');

      expect(result.id).toBe('link-1');
      expect(result.relationshipTypeId).toBe('lrt-1');
      expect(prisma.noteLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { relationshipTypeId: 'lrt-1' },
        select: { id: true, relationshipTypeId: true },
      });
    });

    it('clears relationship type when null is passed', async () => {
      prisma.noteLink.findFirst.mockResolvedValue({ id: 'link-1' });
      prisma.noteLink.update.mockResolvedValue({ id: 'link-1', relationshipTypeId: null });

      const result = await service.setLinkType(WORKSPACE_ID, 'link-1', null);

      expect(result.relationshipTypeId).toBeNull();
      // Should not check relationship type when null
      expect(prisma.linkRelationshipType.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when NoteLink does not belong to workspace', async () => {
      prisma.noteLink.findFirst.mockResolvedValue(null);

      await expect(service.setLinkType(WORKSPACE_ID, 'missing-link', 'lrt-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.noteLink.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when relationship type is not accessible for workspace', async () => {
      prisma.noteLink.findFirst.mockResolvedValue({ id: 'link-1' });
      // type not found / not in workspace
      prisma.linkRelationshipType.findFirst.mockResolvedValue(null);

      await expect(
        service.setLinkType(WORKSPACE_ID, 'link-1', 'inaccessible-type'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.noteLink.update).not.toHaveBeenCalled();
    });
  });
});
