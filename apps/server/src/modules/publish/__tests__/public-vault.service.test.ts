/**
 * Unit tests for PublicVaultService.
 *
 * All external dependencies (PrismaService, FilesService, ValkeyService) are
 * mocked so no real database, filesystem, or cache access occurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PublicVaultService } from '../public-vault.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { ValkeyService } from '../../valkey/valkey.service';
import type { PublicVaultQueryDto } from '../dto/public-vault-query.dto';
import { renderToHtml } from '@notesaner/markdown';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@notesaner/markdown', () => ({
  renderToHtml: vi.fn().mockResolvedValue('<h1>Test Note</h1>'),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspace(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ws-1',
    name: 'Test Vault',
    slug: 'test-vault',
    description: 'A test vault description',
    storagePath: '/tmp/ws-1',
    isPublic: true,
    publicSlug: 'test-public-vault',
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    path: 'folder/test-note.md',
    title: 'Test Note',
    contentHash: 'abc123',
    wordCount: 10,
    frontmatter: {},
    isPublished: true,
    isTrashed: false,
    trashedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    createdById: 'user-1',
    lastEditedById: 'user-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
  prismaOverrides: Record<string, unknown> = {},
  filesOverrides: Record<string, unknown> = {},
  valkeyOverrides: Record<string, unknown> = {},
) {
  const mockClient = {
    scan: vi.fn().mockResolvedValue(['0', []]),
  };

  const prisma = {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    note: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;

  const filesService = {
    readFile: vi.fn().mockResolvedValue('# Test Note\n\nHello world.'),
    ...filesOverrides,
  } as unknown as FilesService;

  const valkeyService = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(0),
    getClient: vi.fn().mockReturnValue(mockClient),
    ...valkeyOverrides,
  } as unknown as ValkeyService;

  const service = new PublicVaultService(prisma, filesService, valkeyService);

  return { service, prisma, filesService, valkeyService, mockClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicVaultService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateSlugUniqueness ───────────────────────────────────────────────

  describe('validateSlugUniqueness', () => {
    it('should resolve when slug is not taken', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.validateSlugUniqueness('available-slug')).resolves.toBeUndefined();
    });

    it('should throw ConflictException when slug is taken by another workspace', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-other' }) as never,
      );

      await expect(service.validateSlugUniqueness('taken-slug')).rejects.toThrow(ConflictException);
    });

    it('should resolve when slug is taken only by the excluded workspace itself', async () => {
      const { service, prisma } = makeService();
      // findFirst returns null because the WHERE clause excludes the workspace
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.validateSlugUniqueness('my-slug', 'ws-1')).resolves.toBeUndefined();

      expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ NOT: { id: 'ws-1' } }),
        }),
      );
    });

    it('should include conflict error message with the slug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-other' }) as never,
      );

      await expect(service.validateSlugUniqueness('conflict-slug')).rejects.toThrow(
        'conflict-slug',
      );
    });
  });

  // ─── toggleVaultPublic ────────────────────────────────────────────────────

  describe('toggleVaultPublic', () => {
    it('should enable public access and set publicSlug', async () => {
      const { service, prisma } = makeService();
      const workspace = makeWorkspace({ isPublic: false, publicSlug: null });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null); // no slug conflict
      vi.mocked(prisma.workspace.update).mockResolvedValue(
        makeWorkspace({ isPublic: true, publicSlug: 'new-slug' }) as never,
      );

      const result = await service.toggleVaultPublic('ws-1', {
        isPublic: true,
        publicSlug: 'new-slug',
      });

      expect(result.isPublic).toBe(true);
      expect(result.publicSlug).toBe('new-slug');
      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPublic: true, publicSlug: 'new-slug' }),
        }),
      );
    });

    it('should disable public access without changing publicSlug', async () => {
      const { service, prisma } = makeService();
      const workspace = makeWorkspace({ isPublic: true, publicSlug: 'existing-slug' });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue(
        makeWorkspace({ isPublic: false, publicSlug: 'existing-slug' }) as never,
      );

      const result = await service.toggleVaultPublic('ws-1', { isPublic: false });

      expect(result.isPublic).toBe(false);
      expect(result.publicSlug).toBe('existing-slug');
    });

    it('should throw BadRequestException when isPublic=true but no publicSlug', async () => {
      const { service } = makeService();

      await expect(service.toggleVaultPublic('ws-1', { isPublic: true })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.toggleVaultPublic('ghost', { isPublic: false })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when new publicSlug is taken', async () => {
      const { service, prisma } = makeService();
      const workspace = makeWorkspace({ publicSlug: 'old-slug' });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      // Slug conflict
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-other' }) as never,
      );

      await expect(
        service.toggleVaultPublic('ws-1', { isPublic: true, publicSlug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should not check slug uniqueness when publicSlug matches current', async () => {
      const { service, prisma } = makeService();
      const workspace = makeWorkspace({ publicSlug: 'same-slug' });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue(
        makeWorkspace({ isPublic: true, publicSlug: 'same-slug' }) as never,
      );

      await service.toggleVaultPublic('ws-1', {
        isPublic: true,
        publicSlug: 'same-slug',
      });

      // validateSlugUniqueness should not be called (slug unchanged)
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('should invalidate cache for old and new slugs', async () => {
      const { service, prisma, valkeyService } = makeService();
      const workspace = makeWorkspace({ publicSlug: 'old-slug' });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.update).mockResolvedValue(
        makeWorkspace({ publicSlug: 'new-slug' }) as never,
      );

      await service.toggleVaultPublic('ws-1', {
        isPublic: true,
        publicSlug: 'new-slug',
      });

      expect(valkeyService.del).toHaveBeenCalled();
    });

    it('should not fail when isPublic=false and workspace had no publicSlug', async () => {
      const { service, prisma, valkeyService } = makeService();
      const workspace = makeWorkspace({ publicSlug: null, isPublic: false });

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(workspace as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue(
        makeWorkspace({ isPublic: false, publicSlug: null }) as never,
      );

      const result = await service.toggleVaultPublic('ws-1', { isPublic: false });

      expect(result.isPublic).toBe(false);
      expect(result.publicSlug).toBeNull();
      // No cache keys to invalidate
      expect(valkeyService.del).not.toHaveBeenCalled();
    });
  });

  // ─── findVaultBySlug ──────────────────────────────────────────────────────

  describe('findVaultBySlug', () => {
    it('should return workspace for a valid public slug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);

      const result = await service.findVaultBySlug('test-public-vault');

      expect(result.id).toBe('ws-1');
      expect(result.publicSlug).toBe('test-public-vault');
    });

    it('should throw NotFoundException for an unknown slug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.findVaultBySlug('ghost-slug')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for a workspace that is not public', async () => {
      // The query already filters by isPublic=true, so findFirst returns null
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.findVaultBySlug('private-vault')).rejects.toThrow(NotFoundException);

      expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublic: true }),
        }),
      );
    });

    it('should include the workspace id in the error NotFoundException', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.findVaultBySlug('no-such-vault')).rejects.toThrow(
        'Public vault not found',
      );
    });
  });

  // ─── getVaultIndex ────────────────────────────────────────────────────────

  describe('getVaultIndex', () => {
    it('should return vault metadata with published note count', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(7);

      const result = await service.getVaultIndex('test-public-vault');

      expect(result).toEqual({
        slug: 'test-public-vault',
        name: 'Test Vault',
        description: 'A test vault description',
        publishedNoteCount: 7,
      });
    });

    it('should cache the result in ValKey', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(3);

      await service.getVaultIndex('test-public-vault');

      expect(valkeyService.set).toHaveBeenCalledWith(
        expect.stringContaining('test-public-vault'),
        expect.any(String),
        300,
      );
    });

    it('should return cached result without hitting the database', async () => {
      const cached = {
        slug: 'test-public-vault',
        name: 'Cached Vault',
        description: null,
        publishedNoteCount: 2,
      };
      const { service, valkeyService, prisma } = makeService();
      vi.mocked(valkeyService.get).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getVaultIndex('test-public-vault');

      expect(result).toEqual(cached);
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('should handle workspace with null description', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ description: null }) as never,
      );
      vi.mocked(prisma.note.count).mockResolvedValue(0);

      const result = await service.getVaultIndex('test-public-vault');

      expect(result.description).toBeNull();
    });

    it('should propagate NotFoundException from findVaultBySlug', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.getVaultIndex('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPublishedNotes ────────────────────────────────────────────────────

  describe('getPublishedNotes', () => {
    const defaultQuery: PublicVaultQueryDto = {};

    it('should return the first page of published notes', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(2);
      vi.mocked(prisma.note.findMany).mockResolvedValue([
        makeNote({ id: 'note-1', path: 'a.md', title: 'A' }),
        makeNote({ id: 'note-2', path: 'b.md', title: 'B' }),
      ] as never[]);

      const result = await service.getPublishedNotes('test-public-vault', defaultQuery);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ path: 'a.md', title: 'A' });
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.total).toBe(2);
    });

    it('should indicate hasMore=true when more pages are available', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(25);

      // Return 21 notes — limit 20 + 1 extra signals more pages
      const notes = Array.from({ length: 21 }, (_, i) =>
        makeNote({ id: `note-${i}`, path: `note-${i}.md`, title: `Note ${i}` }),
      );
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never[]);

      const result = await service.getPublishedNotes('test-public-vault', { limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('note-19');
    });

    it('should pass cursor to Prisma for offset-based navigation', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(10);
      vi.mocked(prisma.note.findMany).mockResolvedValue([makeNote({ id: 'note-5' })] as never[]);

      await service.getPublishedNotes('test-public-vault', { cursor: 'note-4' });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'note-4' },
          skip: 1,
        }),
      );
    });

    it('should apply sortBy=title with sortDir=desc', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', {
        sortBy: 'title',
        sortDir: 'desc',
      });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'desc' },
        }),
      );
    });

    it('should apply sortBy=updatedAt with sortDir=asc', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', {
        sortBy: 'updatedAt',
        sortDir: 'asc',
      });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'asc' } }),
      );
    });

    it('should default to sortBy=path, sortDir=asc', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', {});

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { path: 'asc' } }),
      );
    });

    it('should filter notes by folder prefix', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', { folder: 'projects' });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            path: { startsWith: 'projects/' },
          }),
        }),
      );
    });

    it('should use default limit of 20 when not specified', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', {});

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }), // limit+1
      );
    });

    it('should cache the paginated result', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(0);
      vi.mocked(prisma.note.findMany).mockResolvedValue([]);

      await service.getPublishedNotes('test-public-vault', {});

      expect(valkeyService.set).toHaveBeenCalledWith(
        expect.stringContaining('test-public-vault'),
        expect.any(String),
        300,
      );
    });

    it('should return cached result without querying the database', async () => {
      const cached: ReturnType<typeof makeNote> & { items: unknown[] } = {
        ...makeNote(),
        items: [],
        nextCursor: null,
        hasMore: false,
        total: 0,
      } as never;
      const { service, valkeyService, prisma } = makeService();
      vi.mocked(valkeyService.get).mockResolvedValue(JSON.stringify(cached));

      await service.getPublishedNotes('test-public-vault', {});

      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('should return ISO 8601 updatedAt strings for each note', async () => {
      const { service, prisma } = makeService();
      const noteDate = new Date('2024-06-15T12:00:00.000Z');
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.count).mockResolvedValue(1);
      vi.mocked(prisma.note.findMany).mockResolvedValue([
        makeNote({ updatedAt: noteDate }),
      ] as never[]);

      const result = await service.getPublishedNotes('test-public-vault', {});

      expect(result.items[0].updatedAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should propagate NotFoundException when vault does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

      await expect(service.getPublishedNotes('ghost-vault', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPublishedNote ─────────────────────────────────────────────────────

  describe('getPublishedNote', () => {
    it('should render a published note and return HTML', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);

      const result = await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(result).toMatchObject({
        id: 'note-1',
        path: 'folder/test-note.md',
        title: 'Test Note',
        html: '<h1>Test Note</h1>',
      });
    });

    it('should include frontmatter in the response', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(
        makeNote({ frontmatter: { tags: ['a', 'b'], draft: false } }) as never,
      );

      const result = await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(result.frontmatter).toEqual({ tags: ['a', 'b'], draft: false });
    });

    it('should auto-append .md extension when omitted in notePath', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);

      await service.getPublishedNote('test-public-vault', 'folder/test-note');

      expect(prisma.note.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ path: 'folder/test-note.md' }),
        }),
      );
    });

    it('should not double-append .md extension', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);

      await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(prisma.note.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ path: 'folder/test-note.md' }),
        }),
      );
    });

    it('should throw NotFoundException when note is not published', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);

      await expect(service.getPublishedNote('test-public-vault', 'secret.md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when note is trashed', async () => {
      // Trashed notes are filtered by the DB query (isTrashed: false)
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null); // filtered out

      await expect(service.getPublishedNote('test-public-vault', 'trashed.md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when vault is private', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null); // isPublic=false filtered out

      await expect(service.getPublishedNote('private-vault', 'any.md')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should cache the rendered note', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);

      await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(valkeyService.set).toHaveBeenCalledWith(
        expect.stringContaining('folder/test-note.md'),
        expect.any(String),
        300,
      );
    });

    it('should return cached result without hitting the database', async () => {
      const cached = {
        id: 'note-1',
        path: 'folder/test-note.md',
        title: 'Cached Note',
        html: '<p>Cached</p>',
        updatedAt: '2024-01-01T00:00:00.000Z',
        frontmatter: {},
      };
      const { service, valkeyService, prisma } = makeService();
      vi.mocked(valkeyService.get).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(result).toEqual(cached);
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('should use /p/:slug/ as the wikiLink base URL', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(makeNote() as never);

      await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(renderToHtml).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ wikiLinkBase: '/p/test-public-vault/' }),
      );
    });

    it('should return an ISO 8601 updatedAt string', async () => {
      const { service, prisma } = makeService();
      const noteDate = new Date('2024-08-20T09:30:00.000Z');
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.note.findFirst).mockResolvedValue(
        makeNote({ updatedAt: noteDate }) as never,
      );

      const result = await service.getPublishedNote('test-public-vault', 'folder/test-note.md');

      expect(result.updatedAt).toBe('2024-08-20T09:30:00.000Z');
    });
  });

  // ─── invalidateCacheForWorkspace ──────────────────────────────────────────

  describe('invalidateCacheForWorkspace', () => {
    it('should delete cache keys for the workspace public slug', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await service.invalidateCacheForWorkspace('ws-1');

      expect(valkeyService.del).toHaveBeenCalled();
    });

    it('should not call del when workspace has no publicSlug', async () => {
      const { service, prisma, valkeyService } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ publicSlug: null }) as never,
      );

      await service.invalidateCacheForWorkspace('ws-1');

      expect(valkeyService.del).not.toHaveBeenCalled();
    });

    it('should not throw when workspace does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.invalidateCacheForWorkspace('ghost-ws')).resolves.toBeUndefined();
    });

    it('should call SCAN with the correct key patterns to find note cache entries', async () => {
      const { service, prisma, mockClient } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      // Simulate SCAN returning some note keys
      mockClient.scan
        .mockResolvedValueOnce(['0', ['pv:notes:test-public-vault:key']])
        .mockResolvedValueOnce(['0', ['pv:note:test-public-vault:folder/a.md']]);

      await service.invalidateCacheForWorkspace('ws-1');

      // SCAN should have been called at least twice (once per pattern)
      expect(mockClient.scan).toHaveBeenCalledTimes(2);
    });

    it('should handle SCAN errors gracefully without throwing', async () => {
      const { service, prisma, valkeyService } = makeService(
        {},
        {},
        {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(undefined),
          del: vi.fn().mockResolvedValue(0),
          getClient: vi.fn().mockReturnValue({
            scan: vi.fn().mockRejectedValue(new Error('Redis connection error')),
          }),
        },
      );
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      // Should not throw even when SCAN fails
      await expect(service.invalidateCacheForWorkspace('ws-1')).resolves.toBeUndefined();
      // del is still called for the static vault index key
      expect(valkeyService.del).toHaveBeenCalled();
    });
  });
});
