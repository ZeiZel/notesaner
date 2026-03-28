/**
 * Tests for members-store.ts
 *
 * Covers:
 *   - fetchMembers — happy path, error
 *   - fetchInvitations — happy path, error
 *   - inviteMember — adds to pendingInvites, error propagation
 *   - changeRole — optimistic update, rollback on error
 *   - removeMember — optimistic removal, rollback on error
 *   - resendInvite — updates expiresAt on success, error
 *   - cancelInvite — optimistic removal, rollback on error
 *   - clearError — resets error field
 *   - selectSortedMembers — ordering by role rank
 *   - canManageMembers — permission checks
 *   - canChangeRole — permission checks
 *   - canRemoveMember — permission checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useMembersStore,
  selectSortedMembers,
  canManageMembers,
  canChangeRole,
  canRemoveMember,
  type WorkspaceMember,
  type PendingInvitation,
  type MemberRole,
} from '../model/members-store';

// ─── Mock the API client ───────────────────────────────────────────────────

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/shared/api/client';

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
    joinedAt: '2025-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-15T10:00:00.000Z',
    user: {
      id: `user-${id}`,
      email: `${id}@example.com`,
      displayName: `User ${id}`,
      avatarUrl: null,
    },
    ...overrides,
  };
}

function makeInvite(id: string, overrides: Partial<PendingInvitation> = {}): PendingInvitation {
  return {
    id,
    workspaceId: 'ws-1',
    email: `invite-${id}@example.com`,
    role: 'EDITOR',
    status: 'PENDING',
    invitedByName: 'Admin User',
    expiresAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-03-28T00:00:00.000Z',
    ...overrides,
  };
}

function resetStore(): void {
  useMembersStore.setState({
    members: [],
    pendingInvites: [],
    isLoading: false,
    error: null,
  });
}

// ─── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

// ─── fetchMembers ──────────────────────────────────────────────────────────

describe('useMembersStore — fetchMembers', () => {
  it('populates members on success', async () => {
    const members = [makeMember('alice'), makeMember('bob', 'ADMIN')];
    vi.mocked(apiClient.get).mockResolvedValueOnce(members);

    await useMembersStore.getState().fetchMembers('token', 'ws-1');

    const state = useMembersStore.getState();
    expect(state.members).toHaveLength(2);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets isLoading to true during fetch and false after', async () => {
    let resolveMembers!: (v: WorkspaceMember[]) => void;
    const deferred = new Promise<WorkspaceMember[]>((r) => {
      resolveMembers = r;
    });
    vi.mocked(apiClient.get).mockReturnValueOnce(deferred);

    const fetchPromise = useMembersStore.getState().fetchMembers('token', 'ws-1');
    expect(useMembersStore.getState().isLoading).toBe(true);

    resolveMembers([]);
    await fetchPromise;
    expect(useMembersStore.getState().isLoading).toBe(false);
  });

  it('sets error and re-throws on API failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));

    await expect(useMembersStore.getState().fetchMembers('token', 'ws-1')).rejects.toThrow(
      'Network error',
    );

    const state = useMembersStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.isLoading).toBe(false);
  });

  it('replaces existing members list on subsequent fetch', async () => {
    useMembersStore.setState({ members: [makeMember('old')] });
    const newMembers = [makeMember('new1'), makeMember('new2')];
    vi.mocked(apiClient.get).mockResolvedValueOnce(newMembers);

    await useMembersStore.getState().fetchMembers('token', 'ws-1');

    expect(useMembersStore.getState().members).toHaveLength(2);
    expect(useMembersStore.getState().members[0]!.id).toBe('new1');
  });

  it('calls the correct API endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([]);

    await useMembersStore.getState().fetchMembers('my-token', 'ws-42');

    expect(apiClient.get).toHaveBeenCalledWith('/api/workspaces/ws-42/members', {
      token: 'my-token',
    });
  });
});

// ─── fetchInvitations ──────────────────────────────────────────────────────

describe('useMembersStore — fetchInvitations', () => {
  it('populates pendingInvites on success', async () => {
    const invites = [makeInvite('inv-1'), makeInvite('inv-2')];
    vi.mocked(apiClient.get).mockResolvedValueOnce(invites);

    await useMembersStore.getState().fetchInvitations('token', 'ws-1');

    expect(useMembersStore.getState().pendingInvites).toHaveLength(2);
  });

  it('sets error on failure and re-throws', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('403 Forbidden'));

    await expect(useMembersStore.getState().fetchInvitations('token', 'ws-1')).rejects.toThrow(
      '403 Forbidden',
    );

    expect(useMembersStore.getState().error).toBe('403 Forbidden');
  });

  it('calls correct API endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([]);

    await useMembersStore.getState().fetchInvitations('my-token', 'ws-99');

    expect(apiClient.get).toHaveBeenCalledWith('/api/workspaces/ws-99/invitations', {
      token: 'my-token',
    });
  });
});

// ─── inviteMember ──────────────────────────────────────────────────────────

describe('useMembersStore — inviteMember', () => {
  it('appends returned invitation to pendingInvites', async () => {
    const invite = makeInvite('new-invite');
    vi.mocked(apiClient.post).mockResolvedValueOnce(invite);

    await useMembersStore.getState().inviteMember('token', 'ws-1', {
      email: 'new@example.com',
      role: 'EDITOR',
    });

    expect(useMembersStore.getState().pendingInvites).toContain(invite);
  });

  it('returns the created invitation', async () => {
    const invite = makeInvite('returned-invite');
    vi.mocked(apiClient.post).mockResolvedValueOnce(invite);

    const result = await useMembersStore.getState().inviteMember('token', 'ws-1', {
      email: 'test@example.com',
      role: 'VIEWER',
    });

    expect(result.id).toBe('returned-invite');
  });

  it('sets error and re-throws on API failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('User is already a member'));

    await expect(
      useMembersStore.getState().inviteMember('token', 'ws-1', {
        email: 'existing@example.com',
        role: 'VIEWER',
      }),
    ).rejects.toThrow('User is already a member');

    expect(useMembersStore.getState().error).toBe('User is already a member');
  });

  it('does not modify members list on success', async () => {
    const existingMember = makeMember('existing');
    useMembersStore.setState({ members: [existingMember] });
    vi.mocked(apiClient.post).mockResolvedValueOnce(makeInvite('inv'));

    await useMembersStore.getState().inviteMember('token', 'ws-1', {
      email: 'new@example.com',
      role: 'EDITOR',
    });

    expect(useMembersStore.getState().members).toHaveLength(1);
  });

  it('posts to the correct endpoint with email and role', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(makeInvite('x'));

    await useMembersStore.getState().inviteMember('my-token', 'ws-5', {
      email: 'hello@example.com',
      role: 'ADMIN',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/workspaces/ws-5/invitations',
      { email: 'hello@example.com', role: 'ADMIN' },
      { token: 'my-token' },
    );
  });
});

// ─── changeRole ────────────────────────────────────────────────────────────

describe('useMembersStore — changeRole', () => {
  const member = makeMember('m1', 'EDITOR');

  beforeEach(() => {
    useMembersStore.setState({ members: [member, makeMember('m2', 'VIEWER')] });
  });

  it('updates member role optimistically before API call returns', async () => {
    let resolveApi!: () => void;
    vi.mocked(apiClient.patch).mockReturnValueOnce(
      new Promise((r) => {
        resolveApi = r as () => void;
      }),
    );

    const changePromise = useMembersStore.getState().changeRole('token', 'ws-1', 'm1', 'ADMIN');

    // Optimistic update should be visible immediately
    const updatedMember = useMembersStore.getState().members.find((m) => m.id === 'm1');
    expect(updatedMember?.role).toBe('ADMIN');

    resolveApi();
    await changePromise;
  });

  it('commits the role change on API success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce(undefined);

    await useMembersStore.getState().changeRole('token', 'ws-1', 'm1', 'ADMIN');

    const updated = useMembersStore.getState().members.find((m) => m.id === 'm1');
    expect(updated?.role).toBe('ADMIN');
  });

  it('rolls back to previous role on API failure', async () => {
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new Error('Permission denied'));

    await expect(
      useMembersStore.getState().changeRole('token', 'ws-1', 'm1', 'ADMIN'),
    ).rejects.toThrow('Permission denied');

    const rolledBack = useMembersStore.getState().members.find((m) => m.id === 'm1');
    expect(rolledBack?.role).toBe('EDITOR');
  });

  it('sets error message on failure', async () => {
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new Error('Server error'));

    try {
      await useMembersStore.getState().changeRole('token', 'ws-1', 'm1', 'ADMIN');
    } catch {
      // expected
    }

    expect(useMembersStore.getState().error).toBe('Server error');
  });

  it('does not change other members when updating one', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce(undefined);

    await useMembersStore.getState().changeRole('token', 'ws-1', 'm1', 'ADMIN');

    const other = useMembersStore.getState().members.find((m) => m.id === 'm2');
    expect(other?.role).toBe('VIEWER');
  });
});

// ─── removeMember ──────────────────────────────────────────────────────────

describe('useMembersStore — removeMember', () => {
  beforeEach(() => {
    useMembersStore.setState({
      members: [makeMember('m1', 'EDITOR'), makeMember('m2', 'VIEWER')],
    });
  });

  it('removes member from list optimistically', async () => {
    let resolveApi!: () => void;
    vi.mocked(apiClient.delete).mockReturnValueOnce(
      new Promise((r) => {
        resolveApi = r as () => void;
      }),
    );

    const removePromise = useMembersStore.getState().removeMember('token', 'ws-1', 'm1');

    // Should be removed before API returns
    expect(useMembersStore.getState().members.find((m) => m.id === 'm1')).toBeUndefined();

    resolveApi();
    await removePromise;
  });

  it('commits removal on API success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await useMembersStore.getState().removeMember('token', 'ws-1', 'm1');

    expect(useMembersStore.getState().members).toHaveLength(1);
    expect(useMembersStore.getState().members[0]!.id).toBe('m2');
  });

  it('restores member on API failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Cannot remove owner'));

    await expect(useMembersStore.getState().removeMember('token', 'ws-1', 'm1')).rejects.toThrow(
      'Cannot remove owner',
    );

    expect(useMembersStore.getState().members).toHaveLength(2);
    expect(useMembersStore.getState().members.find((m) => m.id === 'm1')).toBeDefined();
  });

  it('sets error on failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Forbidden'));

    try {
      await useMembersStore.getState().removeMember('token', 'ws-1', 'm1');
    } catch {
      // expected
    }

    expect(useMembersStore.getState().error).toBe('Forbidden');
  });

  it('calls the correct endpoint', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await useMembersStore.getState().removeMember('my-token', 'ws-42', 'm99');

    expect(apiClient.delete).toHaveBeenCalledWith('/api/workspaces/ws-42/members/m99', {
      token: 'my-token',
    });
  });
});

// ─── resendInvite ──────────────────────────────────────────────────────────

describe('useMembersStore — resendInvite', () => {
  beforeEach(() => {
    useMembersStore.setState({
      pendingInvites: [
        makeInvite('inv-1', { expiresAt: '2026-04-01T00:00:00.000Z' }),
        makeInvite('inv-2'),
      ],
    });
  });

  it('updates expiresAt of the resent invite', async () => {
    const updatedInvite = makeInvite('inv-1', {
      expiresAt: '2026-04-07T00:00:00.000Z',
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce(updatedInvite);

    await useMembersStore.getState().resendInvite('token', 'ws-1', 'inv-1');

    const invite = useMembersStore.getState().pendingInvites.find((i) => i.id === 'inv-1');
    expect(invite?.expiresAt).toBe('2026-04-07T00:00:00.000Z');
  });

  it('does not change other invites', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(
      makeInvite('inv-1', { expiresAt: '2026-04-07T00:00:00.000Z' }),
    );

    await useMembersStore.getState().resendInvite('token', 'ws-1', 'inv-1');

    const other = useMembersStore.getState().pendingInvites.find((i) => i.id === 'inv-2');
    expect(other?.expiresAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('sets error and re-throws on failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Invite not found'));

    await expect(
      useMembersStore.getState().resendInvite('token', 'ws-1', 'inv-999'),
    ).rejects.toThrow('Invite not found');

    expect(useMembersStore.getState().error).toBe('Invite not found');
  });

  it('calls the correct resend endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(makeInvite('inv-1'));

    await useMembersStore.getState().resendInvite('tok', 'ws-5', 'inv-1');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/workspaces/ws-5/invitations/inv-1/resend',
      {},
      { token: 'tok' },
    );
  });
});

// ─── cancelInvite ──────────────────────────────────────────────────────────

describe('useMembersStore — cancelInvite', () => {
  beforeEach(() => {
    useMembersStore.setState({
      pendingInvites: [makeInvite('inv-a'), makeInvite('inv-b')],
    });
  });

  it('removes invite optimistically before API returns', async () => {
    let resolveApi!: () => void;
    vi.mocked(apiClient.delete).mockReturnValueOnce(
      new Promise((r) => {
        resolveApi = r as () => void;
      }),
    );

    const cancelPromise = useMembersStore.getState().cancelInvite('token', 'ws-1', 'inv-a');

    expect(useMembersStore.getState().pendingInvites.find((i) => i.id === 'inv-a')).toBeUndefined();

    resolveApi();
    await cancelPromise;
  });

  it('commits cancellation on API success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await useMembersStore.getState().cancelInvite('token', 'ws-1', 'inv-a');

    expect(useMembersStore.getState().pendingInvites).toHaveLength(1);
    expect(useMembersStore.getState().pendingInvites[0]!.id).toBe('inv-b');
  });

  it('restores invite on API failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Server error'));

    await expect(useMembersStore.getState().cancelInvite('token', 'ws-1', 'inv-a')).rejects.toThrow(
      'Server error',
    );

    expect(useMembersStore.getState().pendingInvites).toHaveLength(2);
    expect(useMembersStore.getState().pendingInvites.find((i) => i.id === 'inv-a')).toBeDefined();
  });

  it('sets error on failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Not found'));

    try {
      await useMembersStore.getState().cancelInvite('token', 'ws-1', 'inv-a');
    } catch {
      // expected
    }

    expect(useMembersStore.getState().error).toBe('Not found');
  });
});

// ─── clearError ────────────────────────────────────────────────────────────

describe('useMembersStore — clearError', () => {
  it('resets error to null', () => {
    useMembersStore.setState({ error: 'Something went wrong' });

    useMembersStore.getState().clearError();

    expect(useMembersStore.getState().error).toBeNull();
  });

  it('is a no-op when error is already null', () => {
    useMembersStore.getState().clearError();
    expect(useMembersStore.getState().error).toBeNull();
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

  it('preserves relative order of same-role members', () => {
    const members = [
      makeMember('e1', 'EDITOR'),
      makeMember('e2', 'EDITOR'),
      makeMember('e3', 'EDITOR'),
    ];

    const sorted = selectSortedMembers(members);
    expect(sorted.map((m) => m.id)).toEqual(['e1', 'e2', 'e3']);
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
  it('OWNER can change EDITOR', () => {
    expect(canChangeRole('OWNER', 'EDITOR')).toBe(true);
  });

  it('OWNER can change ADMIN', () => {
    expect(canChangeRole('OWNER', 'ADMIN')).toBe(true);
  });

  it('OWNER cannot change another OWNER', () => {
    // OWNER role means "change own role" which is restricted
    expect(canChangeRole('OWNER', 'OWNER')).toBe(false);
  });

  it('ADMIN can change EDITOR', () => {
    expect(canChangeRole('ADMIN', 'EDITOR')).toBe(true);
  });

  it('ADMIN can change VIEWER', () => {
    expect(canChangeRole('ADMIN', 'VIEWER')).toBe(true);
  });

  it('ADMIN cannot change OWNER', () => {
    expect(canChangeRole('ADMIN', 'OWNER')).toBe(false);
  });

  it('ADMIN cannot change another ADMIN', () => {
    expect(canChangeRole('ADMIN', 'ADMIN')).toBe(false);
  });

  it('EDITOR cannot change anyone', () => {
    expect(canChangeRole('EDITOR', 'VIEWER')).toBe(false);
    expect(canChangeRole('EDITOR', 'EDITOR')).toBe(false);
  });

  it('VIEWER cannot change anyone', () => {
    expect(canChangeRole('VIEWER', 'EDITOR')).toBe(false);
  });

  it('null cannot change anyone', () => {
    expect(canChangeRole(null, 'EDITOR')).toBe(false);
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
  });

  it('VIEWER cannot remove anyone', () => {
    expect(canRemoveMember('VIEWER', 'VIEWER', 'u-viewer1', 'u-viewer2')).toBe(false);
  });

  it('null role cannot remove anyone', () => {
    expect(canRemoveMember(null, 'VIEWER', 'u-null', 'u-viewer')).toBe(false);
  });

  it('cannot remove OWNER regardless of actor role', () => {
    expect(canRemoveMember('OWNER', 'OWNER', 'u-owner1', 'u-owner2')).toBe(false);
  });
});
