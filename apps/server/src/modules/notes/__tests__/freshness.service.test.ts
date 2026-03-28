/**
 * Unit tests for FreshnessService
 *
 * Coverage:
 *   - calculateFreshness: fresh/aging/stale states, note not found, lastVerifiedAt override
 *   - getStaleNotes: status filter, folder filter, owner extraction
 *   - markAsReviewed: happy path, note not found, version audit entry
 *   - getNeedsReviewQueue: pagination, status filter, owner filter, folder filter
 *   - updateWorkspaceThresholds: validation errors, happy path
 *   - emitStaleNotifications: event emission, skipping recently verified
 *   - resolveThresholds: default fallback, workspace override
 *   - computeFreshnessResult: all status boundaries
 *   - extractLastVerifiedAt: valid/invalid/missing frontmatter
 *   - extractOwnerFromFrontmatter: various cases
 *   - daysBetween: edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  FreshnessService,
  DEFAULT_FRESHNESS_THRESHOLD_DAYS,
  DEFAULT_WARNING_THRESHOLD_DAYS,
  FRESHNESS_STALE_EVENT,
} from '../freshness.service';
import type { PrismaService } from '../../../prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function makeNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note-1',
    workspaceId: 'ws-1',
    title: 'Test Note',
    path: 'notes/test.md',
    frontmatter: {},
    createdById: 'user-1',
    updatedAt: daysAgo(10),
    createdAt: daysAgo(30),
    ...overrides,
  };
}

function makeWorkspace(settings: Record<string, unknown> = {}) {
  return {
    id: 'ws-1',
    settings,
  };
}

function buildService() {
  const prisma = {
    note: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    noteVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;

  const service = new FreshnessService(prisma);

  return { service, prisma };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FreshnessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── resolveThresholds ──────────────────────────────────────────────────────

  describe('resolveThresholds', () => {
    it('returns defaults when workspace has no freshness settings', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace({}) as never);

      const result = await service.resolveThresholds('ws-1');

      expect(result.agingThresholdDays).toBe(DEFAULT_FRESHNESS_THRESHOLD_DAYS);
      expect(result.staleThresholdDays).toBe(DEFAULT_WARNING_THRESHOLD_DAYS);
    });

    it('returns defaults when workspace is not found', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      const result = await service.resolveThresholds('ws-1');

      expect(result.agingThresholdDays).toBe(DEFAULT_FRESHNESS_THRESHOLD_DAYS);
      expect(result.staleThresholdDays).toBe(DEFAULT_WARNING_THRESHOLD_DAYS);
    });

    it('returns custom thresholds when workspace settings are configured', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          freshnessThresholdDays: 30,
          warningThresholdDays: 60,
        }) as never,
      );

      const result = await service.resolveThresholds('ws-1');

      expect(result.agingThresholdDays).toBe(30);
      expect(result.staleThresholdDays).toBe(60);
    });

    it('falls back to default when setting value is 0 (invalid)', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ freshnessThresholdDays: 0 }) as never,
      );

      const result = await service.resolveThresholds('ws-1');

      expect(result.agingThresholdDays).toBe(DEFAULT_FRESHNESS_THRESHOLD_DAYS);
    });
  });

  // ── computeFreshnessResult ─────────────────────────────────────────────────

  describe('computeFreshnessResult', () => {
    const aging = DEFAULT_FRESHNESS_THRESHOLD_DAYS; // 60
    const stale = DEFAULT_WARNING_THRESHOLD_DAYS; // 90

    it('returns fresh for a note edited 5 days ago', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(5), null, aging, stale);

      expect(result.status).toBe('fresh');
      expect(result.ageInDays).toBe(5);
      expect(result.isVerified).toBe(false);
    });

    it('returns aging for a note at exactly the aging threshold', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(aging), null, aging, stale);

      expect(result.status).toBe('aging');
      expect(result.ageInDays).toBe(aging);
    });

    it('returns aging for a note between aging and stale thresholds', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(75), null, aging, stale);

      expect(result.status).toBe('aging');
    });

    it('returns stale for a note at exactly the stale threshold', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(stale), null, aging, stale);

      expect(result.status).toBe('stale');
      expect(result.ageInDays).toBe(stale);
    });

    it('returns stale for a note beyond the stale threshold', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(120), null, aging, stale);

      expect(result.status).toBe('stale');
      expect(result.ageInDays).toBe(120);
    });

    it('uses lastVerifiedAt as anchor when more recent than updatedAt', () => {
      const { service } = buildService();
      const updatedAt = daysAgo(100); // old
      const lastVerifiedAt = daysAgo(5); // recent review

      const result = service.computeFreshnessResult(
        'note-1',
        updatedAt,
        lastVerifiedAt,
        aging,
        stale,
      );

      expect(result.status).toBe('fresh');
      expect(result.ageInDays).toBe(5);
      expect(result.isVerified).toBe(true);
    });

    it('uses updatedAt as anchor when lastVerifiedAt is older than updatedAt', () => {
      const { service } = buildService();
      const updatedAt = daysAgo(5); // recent edit
      const lastVerifiedAt = daysAgo(100); // old review (before last edit)

      const result = service.computeFreshnessResult(
        'note-1',
        updatedAt,
        lastVerifiedAt,
        aging,
        stale,
      );

      // The last edit was recent, so anchor is updatedAt
      expect(result.status).toBe('fresh');
      expect(result.ageInDays).toBe(5);
      expect(result.isVerified).toBe(false);
    });

    it('includes the noteId in the result', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-abc', daysAgo(5), null, aging, stale);

      expect(result.noteId).toBe('note-abc');
    });

    it('includes the agingThresholdDays and staleThresholdDays in result', () => {
      const { service } = buildService();
      const result = service.computeFreshnessResult('note-1', daysAgo(5), null, 30, 60);

      expect(result.agingThresholdDays).toBe(30);
      expect(result.staleThresholdDays).toBe(60);
    });

    it('returns 0 ageInDays for a note just updated (today)', () => {
      const { service } = buildService();
      const now = new Date();
      const result = service.computeFreshnessResult('note-1', now, null, aging, stale);

      expect(result.ageInDays).toBe(0);
      expect(result.status).toBe('fresh');
    });
  });

  // ── extractLastVerifiedAt ──────────────────────────────────────────────────

  describe('extractLastVerifiedAt', () => {
    it('returns null for null frontmatter', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt(null)).toBeNull();
    });

    it('returns null for empty object', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt({})).toBeNull();
    });

    it('returns null when lastVerifiedAt is missing', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt({ title: 'Hello' })).toBeNull();
    });

    it('returns null when lastVerifiedAt is not a string', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt({ lastVerifiedAt: 12345 })).toBeNull();
    });

    it('returns null for invalid ISO date string', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt({ lastVerifiedAt: 'not-a-date' })).toBeNull();
    });

    it('returns null for empty string', () => {
      const { service } = buildService();
      expect(service.extractLastVerifiedAt({ lastVerifiedAt: '' })).toBeNull();
    });

    it('returns a Date for a valid ISO 8601 string', () => {
      const { service } = buildService();
      const iso = '2025-06-15T12:00:00.000Z';
      const result = service.extractLastVerifiedAt({ lastVerifiedAt: iso });

      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe(iso);
    });
  });

  // ── extractOwnerFromFrontmatter ────────────────────────────────────────────

  describe('extractOwnerFromFrontmatter', () => {
    it('returns null for null frontmatter', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter(null)).toBeNull();
    });

    it('returns null when owner is not present', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({})).toBeNull();
    });

    it('returns null when owner is an empty string', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({ owner: '' })).toBeNull();
    });

    it('returns null when owner is a whitespace-only string', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({ owner: '   ' })).toBeNull();
    });

    it('returns null when owner is not a string', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({ owner: 123 })).toBeNull();
    });

    it('returns the owner user ID when set', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({ owner: 'user-42' })).toBe('user-42');
    });

    it('trims whitespace from the owner value', () => {
      const { service } = buildService();
      expect(service.extractOwnerFromFrontmatter({ owner: '  user-42  ' })).toBe('user-42');
    });
  });

  // ── daysBetween ────────────────────────────────────────────────────────────

  describe('daysBetween', () => {
    it('returns 0 for the same date', () => {
      const { service } = buildService();
      const now = new Date();
      expect(service.daysBetween(now, now)).toBe(0);
    });

    it('returns 0 when from is after to (non-negative)', () => {
      const { service } = buildService();
      const later = new Date();
      const earlier = new Date(later.getTime() - 86400 * 1000 * 5);
      expect(service.daysBetween(later, earlier)).toBe(0);
    });

    it('returns the correct number of whole days', () => {
      const { service } = buildService();
      const from = daysAgo(30);
      const to = new Date();
      expect(service.daysBetween(from, to)).toBe(30);
    });

    it('floors partial days to whole days', () => {
      const { service } = buildService();
      // 1.5 days = 36 hours
      const from = new Date(Date.now() - 36 * 60 * 60 * 1000);
      expect(service.daysBetween(from, new Date())).toBe(1);
    });
  });

  // ── calculateFreshness ─────────────────────────────────────────────────────

  describe('calculateFreshness', () => {
    it('throws NotFoundException for a non-existent note', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await expect(service.calculateFreshness('ws-1', 'missing-note')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns fresh status for a recently edited note', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue({
        updatedAt: daysAgo(5),
        frontmatter: {},
      } as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.calculateFreshness('ws-1', 'note-1');

      expect(result.status).toBe('fresh');
      expect(result.noteId).toBe('note-1');
    });

    it('returns stale status for an old note without verification', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue({
        updatedAt: daysAgo(120),
        frontmatter: {},
      } as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.calculateFreshness('ws-1', 'note-1');

      expect(result.status).toBe('stale');
    });

    it('uses lastVerifiedAt from frontmatter when more recent than updatedAt', async () => {
      const { service, prisma } = buildService();
      const verifiedAt = daysAgo(5);
      vi.mocked(prisma.note.findFirst).mockResolvedValue({
        updatedAt: daysAgo(120),
        frontmatter: { lastVerifiedAt: verifiedAt.toISOString() },
      } as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.calculateFreshness('ws-1', 'note-1');

      expect(result.status).toBe('fresh');
      expect(result.isVerified).toBe(true);
    });

    it('uses custom workspace thresholds when configured', async () => {
      const { service, prisma } = buildService();
      // Note edited 35 days ago — would be fresh with default (60-day) threshold
      // but aging with 30-day threshold
      vi.mocked(prisma.note.findFirst).mockResolvedValue({
        updatedAt: daysAgo(35),
        frontmatter: {},
      } as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ freshnessThresholdDays: 30, warningThresholdDays: 60 }) as never,
      );

      const result = await service.calculateFreshness('ws-1', 'note-1');

      expect(result.status).toBe('aging');
    });
  });

  // ── markAsReviewed ─────────────────────────────────────────────────────────

  describe('markAsReviewed', () => {
    it('throws NotFoundException when note does not exist', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(null);

      await expect(service.markAsReviewed('ws-1', 'note-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates the frontmatter with lastVerifiedAt', async () => {
      const { service, prisma } = buildService();
      const note = makeNote({ frontmatter: { title: 'Hello' } });
      vi.mocked(prisma.note.findFirst).mockResolvedValue(note as never);
      vi.mocked(prisma.note.update).mockResolvedValue(note as never);
      vi.mocked(prisma.noteVersion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.markAsReviewed('ws-1', 'note-1', 'user-1');

      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'note-1' },
          data: expect.objectContaining({
            frontmatter: expect.objectContaining({
              lastVerifiedAt: expect.any(String),
            }),
          }),
        }),
      );
      expect(result.noteId).toBe('note-1');
      expect(result.reviewedById).toBe('user-1');
      expect(result.lastVerifiedAt).toBeDefined();
    });

    it('preserves existing frontmatter fields when writing lastVerifiedAt', async () => {
      const { service, prisma } = buildService();
      const note = makeNote({ frontmatter: { owner: 'user-2', tags: ['a', 'b'] } });
      vi.mocked(prisma.note.findFirst).mockResolvedValue(note as never);
      vi.mocked(prisma.note.update).mockResolvedValue(note as never);
      vi.mocked(prisma.noteVersion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await service.markAsReviewed('ws-1', 'note-1', 'user-1');

      const updateCall = vi.mocked(prisma.note.update).mock.calls[0][0];
      const fm = (updateCall as { data: { frontmatter: Record<string, unknown> } }).data
        .frontmatter;
      expect(fm['owner']).toBe('user-2');
      expect(fm['tags']).toEqual(['a', 'b']);
    });

    it('creates a version audit entry when version history exists', async () => {
      const { service, prisma } = buildService();
      const note = makeNote();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(note as never);
      vi.mocked(prisma.note.update).mockResolvedValue(note as never);
      vi.mocked(prisma.noteVersion.findFirst).mockResolvedValue({
        version: 3,
        content: '# Existing content',
      } as never);
      vi.mocked(prisma.noteVersion.create).mockResolvedValue({} as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await service.markAsReviewed('ws-1', 'note-1', 'user-1');

      expect(prisma.noteVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            noteId: 'note-1',
            version: 4,
            createdById: 'user-1',
            message: expect.stringContaining('Marked as reviewed'),
          }),
        }),
      );
    });

    it('does not create a version entry when no version history exists', async () => {
      const { service, prisma } = buildService();
      const note = makeNote();
      vi.mocked(prisma.note.findFirst).mockResolvedValue(note as never);
      vi.mocked(prisma.note.update).mockResolvedValue(note as never);
      vi.mocked(prisma.noteVersion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await service.markAsReviewed('ws-1', 'note-1', 'user-1');

      expect(prisma.noteVersion.create).not.toHaveBeenCalled();
    });

    it('returns fresh status after review of a previously stale note', async () => {
      const { service, prisma } = buildService();
      const note = makeNote({ updatedAt: daysAgo(120) });
      vi.mocked(prisma.note.findFirst).mockResolvedValue(note as never);
      vi.mocked(prisma.note.update).mockResolvedValue(note as never);
      vi.mocked(prisma.noteVersion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.markAsReviewed('ws-1', 'note-1', 'user-1');

      // After review, the note is fresh (just reviewed = 0 days ago)
      expect(result.status).toBe('fresh');
    });
  });

  // ── getNeedsReviewQueue ────────────────────────────────────────────────────

  describe('getNeedsReviewQueue', () => {
    it('returns stale notes by default', async () => {
      const { service, prisma } = buildService();

      const staleNote = makeNote({ id: 'note-stale', updatedAt: daysAgo(120), frontmatter: {} });
      vi.mocked(prisma.note.findMany).mockResolvedValue([staleNote] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', {});

      expect(result.data.length).toBe(1);
      expect(result.data[0].noteId).toBe('note-stale');
      expect(result.data[0].status).toBe('stale');
    });

    it('filters out notes that do not match the requested status', async () => {
      const { service, prisma } = buildService();

      // One stale, one aging (based on mock data)
      const notes = [
        makeNote({ id: 'n1', updatedAt: daysAgo(120), frontmatter: {} }), // stale
        makeNote({ id: 'n2', updatedAt: daysAgo(70), frontmatter: {} }), // aging
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', { status: 'stale' });

      // Only stale note should be returned
      expect(result.data.length).toBe(1);
      expect(result.data[0].noteId).toBe('n1');
    });

    it('filters by ownerId when provided', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'n1', updatedAt: daysAgo(120), frontmatter: { owner: 'user-1' } }),
        makeNote({ id: 'n2', updatedAt: daysAgo(120), frontmatter: { owner: 'user-2' } }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', {
        status: 'stale',
        ownerId: 'user-1',
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].ownerId).toBe('user-1');
    });

    it('applies the limit parameter', async () => {
      const { service, prisma } = buildService();

      const notes = Array.from({ length: 10 }, (_, i) =>
        makeNote({ id: `note-${i}`, updatedAt: daysAgo(120 + i), frontmatter: {} }),
      );
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', { status: 'stale', limit: 3 });

      expect(result.data.length).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBeDefined();
    });

    it('applies cursor-based pagination', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'note-1', updatedAt: daysAgo(150), frontmatter: {} }),
        makeNote({ id: 'note-2', updatedAt: daysAgo(130), frontmatter: {} }),
        makeNote({ id: 'note-3', updatedAt: daysAgo(110), frontmatter: {} }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const page1 = await service.getNeedsReviewQueue('ws-1', { status: 'stale', limit: 2 });
      const cursor = page1.pagination.cursor!;

      // Get page 2 starting after cursor
      const page2 = await service.getNeedsReviewQueue('ws-1', {
        status: 'stale',
        limit: 2,
        cursor,
      });

      expect(page2.data.length).toBe(1);
      expect(page2.pagination.hasMore).toBe(false);
    });

    it('returns correct total count', async () => {
      const { service, prisma } = buildService();

      const notes = Array.from({ length: 5 }, (_, i) =>
        makeNote({ id: `note-${i}`, updatedAt: daysAgo(120), frontmatter: {} }),
      );
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', { status: 'stale' });

      expect(result.pagination.total).toBe(5);
    });

    it('includes thresholds in the response', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', {});

      expect(result.thresholds.agingThresholdDays).toBe(DEFAULT_FRESHNESS_THRESHOLD_DAYS);
      expect(result.thresholds.staleThresholdDays).toBe(DEFAULT_WARNING_THRESHOLD_DAYS);
    });

    it('sorts results by ageInDays descending (most stale first)', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'note-100d', updatedAt: daysAgo(100), frontmatter: {} }),
        makeNote({ id: 'note-150d', updatedAt: daysAgo(150), frontmatter: {} }),
        makeNote({ id: 'note-120d', updatedAt: daysAgo(120), frontmatter: {} }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', { status: 'stale' });

      expect(result.data[0].noteId).toBe('note-150d');
      expect(result.data[1].noteId).toBe('note-120d');
      expect(result.data[2].noteId).toBe('note-100d');
    });

    it('falls back to createdById as ownerId when frontmatter.owner is not set', async () => {
      const { service, prisma } = buildService();

      const note = makeNote({
        id: 'note-1',
        createdById: 'creator-user',
        updatedAt: daysAgo(120),
        frontmatter: {},
      });
      vi.mocked(prisma.note.findMany).mockResolvedValue([note] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getNeedsReviewQueue('ws-1', { status: 'stale' });

      expect(result.data[0].ownerId).toBe('creator-user');
    });
  });

  // ── getStaleNotes ──────────────────────────────────────────────────────────

  describe('getStaleNotes', () => {
    it('returns stale notes when status is stale', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'stale-1', updatedAt: daysAgo(120), frontmatter: {} }),
        makeNote({ id: 'stale-2', updatedAt: daysAgo(100), frontmatter: {} }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getStaleNotes('ws-1', 'stale');

      expect(result.length).toBe(2);
      result.forEach((item) => expect(item.status).toBe('stale'));
    });

    it('filters out notes that do not match the requested status in memory', async () => {
      const { service, prisma } = buildService();

      // Mix of stale and aging notes
      const notes = [
        makeNote({ id: 'stale-1', updatedAt: daysAgo(120), frontmatter: {} }), // stale
        makeNote({ id: 'aging-1', updatedAt: daysAgo(70), frontmatter: {} }), // aging
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getStaleNotes('ws-1', 'stale');

      // Only stale notes should be in the result
      expect(result.every((n) => n.status === 'stale')).toBe(true);
    });

    it('returns all notes when status is all', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'fresh-1', updatedAt: daysAgo(5), frontmatter: {} }),
        makeNote({ id: 'aging-1', updatedAt: daysAgo(70), frontmatter: {} }),
        makeNote({ id: 'stale-1', updatedAt: daysAgo(120), frontmatter: {} }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getStaleNotes('ws-1', 'all');

      expect(result.length).toBe(3);
    });

    it('respects lastVerifiedAt override when computing status', async () => {
      const { service, prisma } = buildService();

      // Note was edited 120 days ago (stale) but verified 3 days ago (fresh)
      const verifiedRecently = daysAgo(3);
      const note = makeNote({
        id: 'note-1',
        updatedAt: daysAgo(120),
        frontmatter: { lastVerifiedAt: verifiedRecently.toISOString() },
      });
      vi.mocked(prisma.note.findMany).mockResolvedValue([note] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      // When looking for stale notes, this note should be excluded (it was recently verified)
      const result = await service.getStaleNotes('ws-1', 'stale');

      expect(result.length).toBe(0);
    });
  });

  // ── updateWorkspaceThresholds ──────────────────────────────────────────────

  describe('updateWorkspaceThresholds', () => {
    it('throws BadRequestException when warningThreshold <= freshnessThreshold', async () => {
      const { service } = buildService();

      await expect(service.updateWorkspaceThresholds('ws-1', 60, 60)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when warningThreshold < freshnessThreshold', async () => {
      const { service } = buildService();

      await expect(service.updateWorkspaceThresholds('ws-1', 90, 60)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when freshnessThreshold < 1', async () => {
      const { service } = buildService();

      await expect(service.updateWorkspaceThresholds('ws-1', 0, 60)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when warningThreshold > 730', async () => {
      const { service } = buildService();

      await expect(service.updateWorkspaceThresholds('ws-1', 30, 731)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when workspace does not exist', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.updateWorkspaceThresholds('ws-1', 30, 60)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('saves the thresholds to workspace settings', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue({} as never);

      const result = await service.updateWorkspaceThresholds('ws-1', 30, 60);

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            settings: expect.objectContaining({
              freshnessThresholdDays: 30,
              warningThresholdDays: 60,
            }),
          }),
        }),
      );
      expect(result.freshnessThresholdDays).toBe(30);
      expect(result.warningThresholdDays).toBe(60);
    });

    it('merges new thresholds into existing workspace settings', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ existingKey: 'preserved', freshnessThresholdDays: 45 }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue({} as never);

      await service.updateWorkspaceThresholds('ws-1', 30, 60);

      const updateCall = vi.mocked(prisma.workspace.update).mock.calls[0][0];
      const settings = (updateCall as { data: { settings: Record<string, unknown> } }).data
        .settings;
      expect(settings['existingKey']).toBe('preserved');
      expect(settings['freshnessThresholdDays']).toBe(30);
    });
  });

  // ── emitStaleNotifications ─────────────────────────────────────────────────

  describe('emitStaleNotifications', () => {
    it('emits a stale event for each qualifying note', async () => {
      const { service, prisma } = buildService();

      const notes = [
        makeNote({ id: 'n1', updatedAt: daysAgo(120), frontmatter: {}, createdById: 'user-1' }),
        makeNote({ id: 'n2', updatedAt: daysAgo(100), frontmatter: {}, createdById: 'user-2' }),
      ];
      vi.mocked(prisma.note.findMany).mockResolvedValue(notes as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const emittedEvents: unknown[] = [];
      service.events.on(FRESHNESS_STALE_EVENT, (event) => emittedEvents.push(event));

      const count = await service.emitStaleNotifications('ws-1');

      expect(count).toBe(2);
      expect(emittedEvents.length).toBe(2);
    });

    it('skips notes that were recently verified (after stale cutoff)', async () => {
      const { service, prisma } = buildService();

      // Note is "stale" based on updatedAt but was recently verified
      const note = makeNote({
        id: 'n1',
        updatedAt: daysAgo(120),
        frontmatter: { lastVerifiedAt: daysAgo(5).toISOString() },
      });
      vi.mocked(prisma.note.findMany).mockResolvedValue([note] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const emittedEvents: unknown[] = [];
      service.events.on(FRESHNESS_STALE_EVENT, (event) => emittedEvents.push(event));

      const count = await service.emitStaleNotifications('ws-1');

      expect(count).toBe(0);
      expect(emittedEvents.length).toBe(0);
    });

    it('emits event with correct ownerId from frontmatter', async () => {
      const { service, prisma } = buildService();

      const note = makeNote({
        id: 'n1',
        updatedAt: daysAgo(120),
        frontmatter: { owner: 'owner-user-99' },
        createdById: 'creator-user',
      });
      vi.mocked(prisma.note.findMany).mockResolvedValue([note] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const emittedEvents: { ownerId: string }[] = [];
      service.events.on(FRESHNESS_STALE_EVENT, (event) =>
        emittedEvents.push(event as { ownerId: string }),
      );

      await service.emitStaleNotifications('ws-1');

      expect(emittedEvents[0].ownerId).toBe('owner-user-99');
    });

    it('falls back to createdById in event when frontmatter.owner is absent', async () => {
      const { service, prisma } = buildService();

      const note = makeNote({
        id: 'n1',
        updatedAt: daysAgo(120),
        frontmatter: {},
        createdById: 'fallback-creator',
      });
      vi.mocked(prisma.note.findMany).mockResolvedValue([note] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const emittedEvents: { ownerId: string }[] = [];
      service.events.on(FRESHNESS_STALE_EVENT, (event) =>
        emittedEvents.push(event as { ownerId: string }),
      );

      await service.emitStaleNotifications('ws-1');

      expect(emittedEvents[0].ownerId).toBe('fallback-creator');
    });

    it('returns 0 when no stale notes exist', async () => {
      const { service, prisma } = buildService();
      vi.mocked(prisma.note.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const count = await service.emitStaleNotifications('ws-1');

      expect(count).toBe(0);
    });
  });
});
