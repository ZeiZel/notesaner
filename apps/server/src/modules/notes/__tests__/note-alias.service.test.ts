import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock PrismaClient — must be hoisted before the service import so the
// constructor receives the test double.
// ---------------------------------------------------------------------------

const mockNote = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
};

vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    note = mockNote;
  }
  return { PrismaClient: MockPrismaClient };
});

import { NoteAliasService } from '../note-alias.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'workspace-1';
const NOTE_ID = 'note-1';
const OTHER_NOTE_ID = 'note-2';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NoteAliasService', () => {
  let service: NoteAliasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NoteAliasService();
  });

  // =========================================================================
  // resolveAlias
  // =========================================================================

  describe('resolveAlias', () => {
    it('returns the note details for a valid alias', async () => {
      mockNote.findFirst.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: 'my-note',
      });

      const result = await service.resolveAlias(WORKSPACE_ID, 'my-note');

      expect(result).toEqual({ noteId: NOTE_ID, workspaceId: WORKSPACE_ID, alias: 'my-note' });
      expect(mockNote.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, alias: 'my-note' },
        select: { id: true, workspaceId: true, alias: true },
      });
    });

    it('throws NotFoundException when alias does not exist', async () => {
      mockNote.findFirst.mockResolvedValue(null);

      await expect(service.resolveAlias(WORKSPACE_ID, 'missing-alias')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when note exists but alias is null', async () => {
      mockNote.findFirst.mockResolvedValue({ id: NOTE_ID, workspaceId: WORKSPACE_ID, alias: null });

      await expect(service.resolveAlias(WORKSPACE_ID, 'any-alias')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // setAlias
  // =========================================================================

  describe('setAlias', () => {
    it('sets an alias when the note exists and alias is free', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });
      mockNote.findFirst.mockResolvedValue(null); // no conflict
      mockNote.update.mockResolvedValue({ id: NOTE_ID, alias: 'my-note' });

      const result = await service.setAlias(NOTE_ID, WORKSPACE_ID, 'my-note');

      expect(result).toEqual({ noteId: NOTE_ID, workspaceId: WORKSPACE_ID, alias: 'my-note' });
      expect(mockNote.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { alias: 'my-note' },
      });
    });

    it('is idempotent — skips DB write when alias is unchanged', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: 'same-alias',
      });

      const result = await service.setAlias(NOTE_ID, WORKSPACE_ID, 'same-alias');

      expect(result).toEqual({
        noteId: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: 'same-alias',
      });
      expect(mockNote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockNote.findUnique.mockResolvedValue(null);

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, 'some-alias')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when note belongs to a different workspace', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: 'other-workspace',
        alias: null,
      });

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, 'some-alias')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when alias is already used by another note', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });
      mockNote.findFirst.mockResolvedValue({ id: OTHER_NOTE_ID }); // conflict

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, 'taken-alias')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException for an invalid alias format (uppercase)', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, 'Invalid-Alias')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for alias with leading hyphen', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, '-bad-alias')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for an empty alias string', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });

      await expect(service.setAlias(NOTE_ID, WORKSPACE_ID, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // removeAlias
  // =========================================================================

  describe('removeAlias', () => {
    it('clears the alias from a note that has one', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: 'old-alias',
      });
      mockNote.update.mockResolvedValue({ id: NOTE_ID, alias: null });

      await service.removeAlias(NOTE_ID, WORKSPACE_ID);

      expect(mockNote.update).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
        data: { alias: null },
      });
    });

    it('is idempotent — does nothing when note already has no alias', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: WORKSPACE_ID,
        alias: null,
      });

      await service.removeAlias(NOTE_ID, WORKSPACE_ID);

      expect(mockNote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when note does not exist', async () => {
      mockNote.findUnique.mockResolvedValue(null);

      await expect(service.removeAlias(NOTE_ID, WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when note belongs to a different workspace', async () => {
      mockNote.findUnique.mockResolvedValue({
        id: NOTE_ID,
        workspaceId: 'other-workspace',
        alias: 'some-alias',
      });

      await expect(service.removeAlias(NOTE_ID, WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // generateAlias
  // =========================================================================

  describe('generateAlias', () => {
    it('converts a simple title to a lowercase slug', () => {
      expect(service.generateAlias('My Daily Journal')).toBe('my-daily-journal');
    });

    it('removes diacritics from accented characters', () => {
      expect(service.generateAlias('Café au Lait')).toBe('cafe-au-lait');
    });

    it('collapses multiple non-alphanumeric characters into a single hyphen', () => {
      expect(service.generateAlias('Hello   ---   World')).toBe('hello-world');
    });

    it('strips leading and trailing hyphens', () => {
      expect(service.generateAlias('  leading and trailing  ')).toBe('leading-and-trailing');
    });

    it('returns an empty string for a title with no valid characters', () => {
      expect(service.generateAlias('!!!')).toBe('');
    });

    it('truncates long titles at a word boundary (last hyphen before 120 chars)', () => {
      // Construct a 200-character title using repeated words
      const longTitle = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
      const result = service.generateAlias(longTitle);

      expect(result.length).toBeLessThanOrEqual(120);
      // Should not end with a hyphen
      expect(result.endsWith('-')).toBe(false);
    });

    it('handles numeric-only titles', () => {
      expect(service.generateAlias('2024 01 15')).toBe('2024-01-15');
    });

    it('preserves hyphens that are already in the title', () => {
      expect(service.generateAlias('well-known concepts')).toBe('well-known-concepts');
    });
  });

  // =========================================================================
  // isValidAliasFormat (internal helper, exposed for testing)
  // =========================================================================

  describe('isValidAliasFormat', () => {
    it.each(['my-note', 'note123', 'a', '0', 'abc-def-ghi'])(
      'accepts valid alias "%s"',
      (alias) => {
        expect(service.isValidAliasFormat(alias)).toBe(true);
      },
    );

    it.each(['-leading-hyphen', 'trailing-hyphen-', 'UPPERCASE', 'has space', 'special!chars', ''])(
      'rejects invalid alias "%s"',
      (alias) => {
        expect(service.isValidAliasFormat(alias)).toBe(false);
      },
    );
  });
});
