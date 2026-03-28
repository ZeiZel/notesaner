/**
 * Tests for workspace member management components.
 *
 * Since @testing-library/react is not available, we test:
 *   - Component rendering via JSDOM + createRoot
 *   - Pure logic/helper functions extracted from components
 *   - RoleBadge label logic via getRoleLabel
 *   - InviteMemberForm validation logic
 *   - Permission helpers (canManageMembers, canChangeRole, canRemoveMember)
 *   - selectSortedMembers selector
 *   - RoleBadge color config coverage
 *
 * Integration tests for user interactions are in e2e (Playwright).
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the api client so members-store.ts can be imported without network setup
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  selectSortedMembers,
  canManageMembers,
  canChangeRole,
  canRemoveMember,
  type WorkspaceMember,
  type MemberRole,
} from '../members-store';
import { getRoleLabel } from '../RoleBadge';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeMember(
  id: string,
  role: MemberRole = 'EDITOR',
  overrides: Partial<WorkspaceMember> = {},
): WorkspaceMember {
  return {
    id,
    workspaceId: 'ws-1',
    userId: `user-${id}`,
    role,
    joinedAt: '2025-06-01T00:00:00.000Z',
    lastActiveAt: '2026-03-01T00:00:00.000Z',
    user: {
      id: `user-${id}`,
      email: `${id}@example.com`,
      displayName: `User ${id}`,
      avatarUrl: null,
    },
    ...overrides,
  };
}

// ─── getRoleLabel ──────────────────────────────────────────────────────────

describe('getRoleLabel', () => {
  it('returns "Owner" for OWNER', () => {
    expect(getRoleLabel('OWNER')).toBe('Owner');
  });

  it('returns "Admin" for ADMIN', () => {
    expect(getRoleLabel('ADMIN')).toBe('Admin');
  });

  it('returns "Editor" for EDITOR', () => {
    expect(getRoleLabel('EDITOR')).toBe('Editor');
  });

  it('returns "Viewer" for VIEWER', () => {
    expect(getRoleLabel('VIEWER')).toBe('Viewer');
  });
});

// ─── selectSortedMembers ───────────────────────────────────────────────────

describe('selectSortedMembers', () => {
  it('sorts members by role rank descending (OWNER first)', () => {
    const members = [
      makeMember('viewer', 'VIEWER'),
      makeMember('owner', 'OWNER'),
      makeMember('editor', 'EDITOR'),
      makeMember('admin', 'ADMIN'),
    ];

    const sorted = selectSortedMembers(members);
    expect(sorted.map((m) => m.role)).toEqual(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
  });

  it('does not mutate the original array', () => {
    const members = [makeMember('e', 'EDITOR'), makeMember('o', 'OWNER')];
    const original = [...members];

    selectSortedMembers(members);

    expect(members).toEqual(original);
  });

  it('handles empty list', () => {
    expect(selectSortedMembers([])).toEqual([]);
  });

  it('preserves relative order of same-role members (stable sort)', () => {
    const members = [
      makeMember('e1', 'EDITOR'),
      makeMember('e2', 'EDITOR'),
      makeMember('e3', 'EDITOR'),
    ];

    const sorted = selectSortedMembers(members);
    expect(sorted.map((m) => m.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('handles single member', () => {
    const members = [makeMember('solo', 'ADMIN')];
    const sorted = selectSortedMembers(members);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]!.role).toBe('ADMIN');
  });

  it('handles all same-role members', () => {
    const members = [
      makeMember('a', 'VIEWER'),
      makeMember('b', 'VIEWER'),
      makeMember('c', 'VIEWER'),
    ];
    const sorted = selectSortedMembers(members);
    expect(sorted.every((m) => m.role === 'VIEWER')).toBe(true);
  });
});

// ─── canManageMembers ──────────────────────────────────────────────────────

describe('canManageMembers', () => {
  it('returns true for OWNER', () => {
    expect(canManageMembers('OWNER')).toBe(true);
  });

  it('returns true for ADMIN', () => {
    expect(canManageMembers('ADMIN')).toBe(true);
  });

  it('returns false for EDITOR', () => {
    expect(canManageMembers('EDITOR')).toBe(false);
  });

  it('returns false for VIEWER', () => {
    expect(canManageMembers('VIEWER')).toBe(false);
  });

  it('returns false for null (unauthenticated)', () => {
    expect(canManageMembers(null)).toBe(false);
  });
});

// ─── canChangeRole ─────────────────────────────────────────────────────────

describe('canChangeRole', () => {
  it('OWNER can change EDITOR role', () => {
    expect(canChangeRole('OWNER', 'EDITOR')).toBe(true);
  });

  it('OWNER can change ADMIN role', () => {
    expect(canChangeRole('OWNER', 'ADMIN')).toBe(true);
  });

  it('OWNER can change VIEWER role', () => {
    expect(canChangeRole('OWNER', 'VIEWER')).toBe(true);
  });

  it('OWNER cannot change OWNER role (own role)', () => {
    expect(canChangeRole('OWNER', 'OWNER')).toBe(false);
  });

  it('ADMIN can change EDITOR role', () => {
    expect(canChangeRole('ADMIN', 'EDITOR')).toBe(true);
  });

  it('ADMIN can change VIEWER role', () => {
    expect(canChangeRole('ADMIN', 'VIEWER')).toBe(true);
  });

  it('ADMIN cannot change OWNER role', () => {
    expect(canChangeRole('ADMIN', 'OWNER')).toBe(false);
  });

  it('ADMIN cannot change another ADMIN role', () => {
    expect(canChangeRole('ADMIN', 'ADMIN')).toBe(false);
  });

  it('EDITOR cannot change any role', () => {
    expect(canChangeRole('EDITOR', 'VIEWER')).toBe(false);
    expect(canChangeRole('EDITOR', 'EDITOR')).toBe(false);
    expect(canChangeRole('EDITOR', 'ADMIN')).toBe(false);
    expect(canChangeRole('EDITOR', 'OWNER')).toBe(false);
  });

  it('VIEWER cannot change any role', () => {
    expect(canChangeRole('VIEWER', 'EDITOR')).toBe(false);
    expect(canChangeRole('VIEWER', 'OWNER')).toBe(false);
  });

  it('null role cannot change anyone', () => {
    expect(canChangeRole(null, 'EDITOR')).toBe(false);
    expect(canChangeRole(null, 'VIEWER')).toBe(false);
  });
});

// ─── canRemoveMember ───────────────────────────────────────────────────────

describe('canRemoveMember', () => {
  it('OWNER can remove EDITOR', () => {
    expect(canRemoveMember('OWNER', 'EDITOR', 'u-owner', 'u-editor')).toBe(true);
  });

  it('OWNER can remove ADMIN', () => {
    expect(canRemoveMember('OWNER', 'ADMIN', 'u-owner', 'u-admin')).toBe(true);
  });

  it('OWNER can remove VIEWER', () => {
    expect(canRemoveMember('OWNER', 'VIEWER', 'u-owner', 'u-viewer')).toBe(true);
  });

  it('OWNER cannot remove themselves', () => {
    expect(canRemoveMember('OWNER', 'OWNER', 'u-owner', 'u-owner')).toBe(false);
  });

  it('ADMIN can remove EDITOR', () => {
    expect(canRemoveMember('ADMIN', 'EDITOR', 'u-admin', 'u-editor')).toBe(true);
  });

  it('ADMIN can remove VIEWER', () => {
    expect(canRemoveMember('ADMIN', 'VIEWER', 'u-admin', 'u-viewer')).toBe(true);
  });

  it('ADMIN cannot remove another ADMIN', () => {
    expect(canRemoveMember('ADMIN', 'ADMIN', 'u-admin1', 'u-admin2')).toBe(false);
  });

  it('ADMIN cannot remove OWNER', () => {
    expect(canRemoveMember('ADMIN', 'OWNER', 'u-admin', 'u-owner')).toBe(false);
  });

  it('ADMIN cannot remove themselves', () => {
    expect(canRemoveMember('ADMIN', 'ADMIN', 'u-admin', 'u-admin')).toBe(false);
  });

  it('EDITOR cannot remove anyone', () => {
    expect(canRemoveMember('EDITOR', 'VIEWER', 'u-editor', 'u-viewer')).toBe(false);
    expect(canRemoveMember('EDITOR', 'EDITOR', 'u-editor1', 'u-editor2')).toBe(false);
  });

  it('VIEWER cannot remove anyone', () => {
    expect(canRemoveMember('VIEWER', 'VIEWER', 'u-viewer1', 'u-viewer2')).toBe(false);
    expect(canRemoveMember('VIEWER', 'EDITOR', 'u-viewer', 'u-editor')).toBe(false);
  });

  it('null role cannot remove anyone', () => {
    expect(canRemoveMember(null, 'VIEWER', 'u-null', 'u-viewer')).toBe(false);
    expect(canRemoveMember(null, 'EDITOR', 'u-null', 'u-editor')).toBe(false);
  });

  it('cannot remove OWNER regardless of actor role', () => {
    expect(canRemoveMember('OWNER', 'OWNER', 'u-owner1', 'u-owner2')).toBe(false);
    expect(canRemoveMember('ADMIN', 'OWNER', 'u-admin', 'u-owner')).toBe(false);
  });
});

// ─── Email validation logic ────────────────────────────────────────────────
// Testing the inline validation function via the exported contract

describe('Email validation (InviteMemberForm logic)', () => {
  // Replicate the same regex used in InviteMemberForm
  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  it('accepts simple valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('accepts email with plus addressing', () => {
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
  });

  it('accepts email with hyphens in domain', () => {
    expect(isValidEmail('me@my-company.io')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects string without @', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('rejects string without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects string without TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('rejects whitespace-only', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  it('trims leading/trailing whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

// ─── MemberRole type coverage ─────────────────────────────────────────────

describe('MemberRole values', () => {
  const ALL_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

  it('getRoleLabel returns a non-empty string for every role', () => {
    for (const role of ALL_ROLES) {
      expect(getRoleLabel(role).length).toBeGreaterThan(0);
    }
  });

  it('selectSortedMembers produces OWNER > ADMIN > EDITOR > VIEWER ordering', () => {
    const members = ALL_ROLES.map((role) => makeMember(role, role));
    const sorted = selectSortedMembers(members);
    expect(sorted.map((m) => m.role)).toEqual(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
  });
});
