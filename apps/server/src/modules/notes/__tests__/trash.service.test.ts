/**
 * Unit tests for TrashService
 *
 * Coverage:
 *   - moveToTrash: moves file, updates DB, idempotent on already-trashed note
 *   - restoreFromTrash: restores file, updates DB, throws on collision, idempotent on non-trashed
 *   - permanentDelete: deletes DB + file, throws when note not in trash
 *   - listTrash: pagination, empty result, cursor-based paging
 *   - emptyTrash: bulk delete, returns count, handles file-delete errors
 *   - purgeExpired: purges only notes older than retention cutoff
 *   - Error handling: note not found, FS errors swallowed for best-effort ops
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TrashService, TRASH_RETENTION_DAYS } from '../trash.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Mocks for fs/promises (hoisted so vi.mock works at module level)
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, rename, rm } from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    path: 'folder/my-note.md',
    title: 'My Note',
    isTrashed: false,
    trashedAt: null,
    wordCount: 120,
    ...overrides,
  };
}

function buildService() {
  const prisma = {
    note: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as unknown as PrismaService;

  const configService = {
    get: vi.fn().mockReturnValue('/storage'),
  } as unknown as ConfigService;

  const service = new TrashService(prisma, configService);

  return { service, prisma };
}

// ---------------------------------------------------------------------------
// moveToTrash
// ---------------------------------------------------------------------------

describe('TrashService.moveToTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves file and updates DB when note exists and is not trashed', async () => {
    const { service, prisma } = buildService();
    const note = makeNote();
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);
    (prisma.note.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await service.moveToTrash('ws-1', 'note-1');

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('.trash'), { recursive: true });
    expect(rename).toHaveBeenCalledWith(
      expect.stringContaining('folder/my-note.md'),
      expect.stringContaining('.trash/folder/my-note.md'),
    );
    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: expect.objectContaining({
        isTrashed: true,
        trashedAt: expect.any(Date),
        path: expect.stringContaining('.trash'),
      }),
    });
  });

  it('is idempotent: does nothing when note is already trashed', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: true, trashedAt: new Date() });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);

    await service.moveToTrash('ws-1', 'note-1');

    expect(rename).not.toHaveBeenCalled();
    expect(prisma.note.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when note does not exist', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.moveToTrash('ws-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('does NOT update DB when file move fails', async () => {
    const { service, prisma } = buildService();
    const note = makeNote();
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);
    (rename as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('disk full'));

    await expect(service.moveToTrash('ws-1', 'note-1')).rejects.toThrow('disk full');
    expect(prisma.note.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// restoreFromTrash
// ---------------------------------------------------------------------------

describe('TrashService.restoreFromTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves file back and clears trashedAt when note is trashed', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({
      isTrashed: true,
      trashedAt: new Date(),
      path: '.trash/folder/my-note.md',
    });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);
    // No collision
    (prisma.note.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(null);
    (prisma.note.update as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await service.restoreFromTrash('ws-1', 'note-1');

    expect(rename).toHaveBeenCalledWith(
      expect.stringContaining('.trash/folder/my-note.md'),
      expect.stringContaining('folder/my-note.md'),
    );
    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: {
        isTrashed: false,
        trashedAt: null,
        path: 'folder/my-note.md',
      },
    });
  });

  it('is idempotent: does nothing when note is not trashed', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: false });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);

    await service.restoreFromTrash('ws-1', 'note-1');

    expect(rename).not.toHaveBeenCalled();
    expect(prisma.note.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when original path is occupied by another note', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: true, path: '.trash/folder/my-note.md' });
    // First call: find the note. Second call: collision check returns a conflicting note.
    (prisma.note.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce({ id: 'note-other' });

    await expect(service.restoreFromTrash('ws-1', 'note-1')).rejects.toThrow(BadRequestException);
    expect(rename).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when note does not exist', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.restoreFromTrash('ws-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// permanentDelete
// ---------------------------------------------------------------------------

describe('TrashService.permanentDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes DB record and file when note is in trash', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: true, path: '.trash/folder/my-note.md' });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);
    (prisma.note.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await service.permanentDelete('ws-1', 'note-1');

    expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: 'note-1' } });
    expect(rm).toHaveBeenCalledWith(expect.stringContaining('.trash/folder/my-note.md'), {
      force: true,
    });
  });

  it('throws BadRequestException when note is not in trash', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: false });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);

    await expect(service.permanentDelete('ws-1', 'note-1')).rejects.toThrow(BadRequestException);
    expect(prisma.note.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when note does not exist', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.permanentDelete('ws-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('does not throw when file delete fails (ENOENT is silent)', async () => {
    const { service, prisma } = buildService();
    const note = makeNote({ isTrashed: true, path: '.trash/folder/my-note.md' });
    (prisma.note.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(note);
    (prisma.note.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (rm as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('not found'), { code: 'ENOENT' }),
    );

    await expect(service.permanentDelete('ws-1', 'note-1')).resolves.toBeUndefined();
    expect(prisma.note.delete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listTrash
// ---------------------------------------------------------------------------

describe('TrashService.listTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated results with hasMore=false when fewer items than limit', async () => {
    const { service, prisma } = buildService();
    const items = [
      makeNote({ id: 'n1', isTrashed: true, trashedAt: new Date() }),
      makeNote({ id: 'n2', isTrashed: true, trashedAt: new Date() }),
    ];
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items);
    (prisma.note.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const result = await service.listTrash('ws-1', undefined, 20);

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.total).toBe(2);
  });

  it('returns hasMore=true and nextCursor when more items exist', async () => {
    const { service, prisma } = buildService();
    // Return limit+1 items to signal there are more
    const items = Array.from({ length: 21 }, (_, i) =>
      makeNote({ id: `n${i}`, isTrashed: true, trashedAt: new Date() }),
    );
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items);
    (prisma.note.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);

    const result = await service.listTrash('ws-1', undefined, 20);

    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('n19');
  });

  it('returns empty result when workspace has no trashed notes', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.note.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const result = await service.listTrash('ws-1');

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('clamps limit to 100 maximum', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.note.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await service.listTrash('ws-1', undefined, 9999);

    expect(prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }), // 100 + 1 for hasMore check
    );
  });
});

// ---------------------------------------------------------------------------
// emptyTrash
// ---------------------------------------------------------------------------

describe('TrashService.emptyTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes all trashed notes and returns count', async () => {
    const { service, prisma } = buildService();
    const notes = [
      makeNote({ id: 'n1', isTrashed: true, path: '.trash/a.md' }),
      makeNote({ id: 'n2', isTrashed: true, path: '.trash/b.md' }),
    ];
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(notes);
    (prisma.note.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    const count = await service.emptyTrash('ws-1');

    expect(count).toBe(2);
    expect(prisma.note.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] } },
    });
    expect(rm).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when trash is empty', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const count = await service.emptyTrash('ws-1');

    expect(count).toBe(0);
    expect(prisma.note.deleteMany).not.toHaveBeenCalled();
  });

  it('continues and returns count even when some file deletions fail', async () => {
    const { service, prisma } = buildService();
    const notes = [
      makeNote({ id: 'n1', isTrashed: true, path: '.trash/a.md' }),
      makeNote({ id: 'n2', isTrashed: true, path: '.trash/b.md' }),
    ];
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(notes);
    (prisma.note.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (rm as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('I/O error'))
      .mockResolvedValueOnce(undefined);

    const count = await service.emptyTrash('ws-1');

    // DB deletion still counted even when FS fails
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// purgeExpired
// ---------------------------------------------------------------------------

describe('TrashService.purgeExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes notes whose trashedAt is older than retentionDays', async () => {
    const { service, prisma } = buildService();

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35); // 35 days ago > 30-day default

    const expiredNotes = [
      makeNote({
        id: 'n1',
        workspaceId: 'ws-1',
        path: '.trash/old.md',
        isTrashed: true,
        trashedAt: oldDate,
      }),
    ];

    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(expiredNotes);
    (prisma.note.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const count = await service.purgeExpired();

    expect(count).toBe(1);
    expect(prisma.note.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1'] } },
    });
  });

  it('respects custom retentionDays', async () => {
    const { service, prisma } = buildService();

    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await service.purgeExpired(7);

    const callArgs = (prisma.note.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cutoff: Date = callArgs.where.trashedAt.lte;

    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 7);

    // Allow a 5-second window for test execution time
    expect(Math.abs(cutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(5_000);
  });

  it('returns 0 when no notes are expired', async () => {
    const { service, prisma } = buildService();
    (prisma.note.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const count = await service.purgeExpired();

    expect(count).toBe(0);
    expect(prisma.note.deleteMany).not.toHaveBeenCalled();
  });

  it('default retention matches TRASH_RETENTION_DAYS constant', () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });
});
