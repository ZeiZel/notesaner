/**
 * Unit tests for FreshnessCheckProcessor
 *
 * Coverage:
 *   - processFreshnessCheck: single workspace, all workspaces, no stale notes
 *   - Email grouping: groups stale notes by owner, sends one email per owner
 *   - Error handling: workspace check failure, email send failure
 *   - Skips inactive users and owners without user records
 *   - Unknown job name handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreshnessCheckProcessor } from '../processors/freshness-check.processor';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { EmailService } from '../../email/email.service';
import type { FreshnessService } from '../../notes/freshness.service';
import type { FreshnessCheckJobData } from '../jobs.types';
import { FRESHNESS_CHECK_JOB } from '../jobs.constants';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeJob(data: FreshnessCheckJobData, name = FRESHNESS_CHECK_JOB) {
  return {
    name,
    data,
    updateProgress: vi.fn(),
  } as never;
}

function buildProcessor() {
  const prisma = {
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  } as unknown as PrismaService;

  const freshnessService = {
    getStaleNotes: vi.fn(),
    resolveThresholds: vi.fn().mockResolvedValue({
      agingThresholdDays: 60,
      staleThresholdDays: 90,
    }),
    emitStaleNotifications: vi.fn().mockResolvedValue(0),
  } as unknown as FreshnessService;

  const emailService = {
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailService;

  const processor = new FreshnessCheckProcessor(prisma, freshnessService, emailService);

  return { processor, prisma, freshnessService, emailService };
}

function makeStaleNote(overrides: Record<string, unknown> = {}) {
  return {
    noteId: 'note-1',
    workspaceId: 'ws-1',
    title: 'Stale Note',
    path: 'docs/stale.md',
    status: 'stale' as const,
    ageInDays: 120,
    anchorDate: new Date().toISOString(),
    isVerified: false,
    ownerId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FreshnessCheckProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for unknown job name', async () => {
    const { processor } = buildProcessor();

    await expect(processor.process(makeJob({}, 'unknown-job'))).rejects.toThrow('Unknown job name');
  });

  describe('single workspace check', () => {
    it('sends email for stale notes grouped by owner', async () => {
      const { processor, prisma, freshnessService, emailService } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test-ws',
      } as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([
        makeStaleNote({ noteId: 'n1', ownerId: 'user-1', title: 'Note A' }),
        makeStaleNote({ noteId: 'n2', ownerId: 'user-1', title: 'Note B' }),
        makeStaleNote({ noteId: 'n3', ownerId: 'user-2', title: 'Note C' }),
      ] as never);

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', email: 'alice@test.com', displayName: 'Alice' },
        { id: 'user-2', email: 'bob@test.com', displayName: 'Bob' },
      ] as never);

      const result = await processor.process(makeJob({ workspaceId: 'ws-1' }));

      expect(result.workspacesChecked).toBe(1);
      expect(result.staleNotesFound).toBe(3);
      expect(result.emailsQueued).toBe(2);
      expect(emailService.send).toHaveBeenCalledTimes(2);

      // Verify Alice's email contains both notes
      const aliceCall = vi
        .mocked(emailService.send)
        .mock.calls.find((call) => call[0].to === 'alice@test.com');
      expect(aliceCall).toBeDefined();
      expect(aliceCall![0].template).toBe('freshness-alert');
      expect(aliceCall![0].variables?.displayName).toBe('Alice');
      expect((aliceCall![0].variables?.notes as unknown[]).length).toBe(2);
    });

    it('returns zero counts when no stale notes exist', async () => {
      const { processor, prisma, freshnessService, emailService } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: 'ws-1',
        name: 'Clean Workspace',
        slug: 'clean-ws',
      } as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([] as never);

      const result = await processor.process(makeJob({ workspaceId: 'ws-1' }));

      expect(result.staleNotesFound).toBe(0);
      expect(result.emailsQueued).toBe(0);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('returns zero workspaces checked when workspace not found', async () => {
      const { processor, prisma } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      const result = await processor.process(makeJob({ workspaceId: 'missing' }));

      expect(result.workspacesChecked).toBe(0);
      expect(result.staleNotesFound).toBe(0);
    });
  });

  describe('all workspaces check', () => {
    it('iterates over all workspaces when no workspaceId given', async () => {
      const { processor, prisma, freshnessService } = buildProcessor();

      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        { id: 'ws-1', name: 'WS One', slug: 'ws-one' },
        { id: 'ws-2', name: 'WS Two', slug: 'ws-two' },
      ] as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([] as never);

      const result = await processor.process(makeJob({}));

      expect(result.workspacesChecked).toBe(2);
      expect(freshnessService.getStaleNotes).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('skips notes with no ownerId', async () => {
      const { processor, prisma, freshnessService, emailService } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: 'ws-1',
        name: 'Test',
        slug: 'test',
      } as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([
        makeStaleNote({ noteId: 'n1', ownerId: null, title: 'Orphan Note' }),
      ] as never);

      // No owners to look up since ownerId is null
      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

      const result = await processor.process(makeJob({ workspaceId: 'ws-1' }));

      expect(result.staleNotesFound).toBe(1);
      expect(result.emailsQueued).toBe(0);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('skips owners whose user record is not found or inactive', async () => {
      const { processor, prisma, freshnessService, emailService } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: 'ws-1',
        name: 'Test',
        slug: 'test',
      } as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([
        makeStaleNote({ noteId: 'n1', ownerId: 'deleted-user' }),
      ] as never);

      // User not found in DB
      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

      const result = await processor.process(makeJob({ workspaceId: 'ws-1' }));

      expect(result.staleNotesFound).toBe(1);
      expect(result.emailsQueued).toBe(0);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('continues processing when email send fails for one owner', async () => {
      const { processor, prisma, freshnessService, emailService } = buildProcessor();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: 'ws-1',
        name: 'Test',
        slug: 'test',
      } as never);

      vi.mocked(freshnessService.getStaleNotes).mockResolvedValue([
        makeStaleNote({ noteId: 'n1', ownerId: 'user-1' }),
        makeStaleNote({ noteId: 'n2', ownerId: 'user-2' }),
      ] as never);

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', email: 'fail@test.com', displayName: 'Fail User' },
        { id: 'user-2', email: 'ok@test.com', displayName: 'OK User' },
      ] as never);

      // First send fails, second succeeds
      vi.mocked(emailService.send)
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(undefined);

      const result = await processor.process(makeJob({ workspaceId: 'ws-1' }));

      // One email succeeded, one failed — emailsQueued counts only successes
      expect(result.emailsQueued).toBe(1);
      expect(emailService.send).toHaveBeenCalledTimes(2);
    });

    it('continues processing other workspaces when one fails', async () => {
      const { processor, prisma, freshnessService } = buildProcessor();

      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        { id: 'ws-1', name: 'Broken WS', slug: 'broken' },
        { id: 'ws-2', name: 'OK WS', slug: 'ok' },
      ] as never);

      // First workspace throws, second succeeds
      vi.mocked(freshnessService.getStaleNotes)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce([] as never);

      const result = await processor.process(makeJob({}));

      expect(result.workspacesChecked).toBe(2);
      // The broken workspace contributed 0 (error caught), ok workspace also 0 (no stale)
      expect(result.staleNotesFound).toBe(0);
    });
  });
});
