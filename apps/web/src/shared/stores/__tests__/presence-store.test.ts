/**
 * Unit tests for presence-store.
 *
 * Tests:
 *   - Basic CRUD operations on presence users
 *   - Selectors: usersOnNote, noteViewerCounts, onlineUserCount
 *   - Batch operations (setUsers)
 *   - Idle status management
 *   - Connection status
 *   - Clear/reset behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePresenceStore,
  selectPresenceUsers,
  selectUsersOnNote,
  selectNoteViewerCounts,
  selectOnlineUserCount,
  type WorkspacePresenceUser,
} from '../presence-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<WorkspacePresenceUser> = {}): WorkspacePresenceUser {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    avatarUrl: null,
    color: '#f38ba8',
    activeNoteId: null,
    cursorDescription: null,
    status: 'online',
    lastActiveAt: new Date().toISOString(),
    ...overrides,
  };
}

function resetStore(): void {
  usePresenceStore.getState().clear();
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

describe('presence-store CRUD', () => {
  it('sets a user', () => {
    const user = makeUser();
    usePresenceStore.getState().setUser(user);

    const state = usePresenceStore.getState();
    expect(state.users.size).toBe(1);
    expect(state.users.get('user-1')).toEqual(user);
  });

  it('updates an existing user', () => {
    usePresenceStore.getState().setUser(makeUser());
    usePresenceStore.getState().setUser(makeUser({ displayName: 'Alice Updated' }));

    const state = usePresenceStore.getState();
    expect(state.users.size).toBe(1);
    expect(state.users.get('user-1')?.displayName).toBe('Alice Updated');
  });

  it('removes a user', () => {
    usePresenceStore.getState().setUser(makeUser());
    usePresenceStore.getState().removeUser('user-1');

    expect(usePresenceStore.getState().users.size).toBe(0);
  });

  it('removing a non-existent user is a no-op', () => {
    usePresenceStore.getState().removeUser('non-existent');
    expect(usePresenceStore.getState().users.size).toBe(0);
  });

  it('batch sets users', () => {
    const users = [
      makeUser({ userId: 'user-1', displayName: 'Alice' }),
      makeUser({ userId: 'user-2', displayName: 'Bob' }),
      makeUser({ userId: 'user-3', displayName: 'Charlie' }),
    ];

    usePresenceStore.getState().setUsers(users);

    expect(usePresenceStore.getState().users.size).toBe(3);
  });

  it('batch set replaces all existing users', () => {
    usePresenceStore.getState().setUser(makeUser({ userId: 'old-user' }));
    usePresenceStore
      .getState()
      .setUsers([makeUser({ userId: 'new-user-1' }), makeUser({ userId: 'new-user-2' })]);

    const state = usePresenceStore.getState();
    expect(state.users.size).toBe(2);
    expect(state.users.has('old-user')).toBe(false);
    expect(state.users.has('new-user-1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Field updates
// ---------------------------------------------------------------------------

describe('presence-store field updates', () => {
  it('updates active note', () => {
    usePresenceStore.getState().setUser(makeUser());
    usePresenceStore.getState().setUserActiveNote('user-1', 'note-42');

    expect(usePresenceStore.getState().users.get('user-1')?.activeNoteId).toBe('note-42');
  });

  it('updates cursor description', () => {
    usePresenceStore.getState().setUser(makeUser());
    usePresenceStore.getState().setUserCursorDescription('user-1', 'Line 42, Col 8');

    expect(usePresenceStore.getState().users.get('user-1')?.cursorDescription).toBe(
      'Line 42, Col 8',
    );
  });

  it('updates status', () => {
    usePresenceStore.getState().setUser(makeUser({ status: 'online' }));
    usePresenceStore.getState().setUserStatus('user-1', 'away');

    expect(usePresenceStore.getState().users.get('user-1')?.status).toBe('away');
  });

  it('field update on non-existent user is a no-op', () => {
    const sizeBefore = usePresenceStore.getState().users.size;
    usePresenceStore.getState().setUserActiveNote('ghost', 'note-1');
    expect(usePresenceStore.getState().users.size).toBe(sizeBefore);
  });
});

// ---------------------------------------------------------------------------
// Idle status
// ---------------------------------------------------------------------------

describe('presence-store idle status', () => {
  it('starts as not idle', () => {
    expect(usePresenceStore.getState().isCurrentUserIdle).toBe(false);
  });

  it('can be set to idle', () => {
    usePresenceStore.getState().setCurrentUserIdle(true);
    expect(usePresenceStore.getState().isCurrentUserIdle).toBe(true);
  });

  it('can be set back to active', () => {
    usePresenceStore.getState().setCurrentUserIdle(true);
    usePresenceStore.getState().setCurrentUserIdle(false);
    expect(usePresenceStore.getState().isCurrentUserIdle).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

describe('presence-store connection status', () => {
  it('starts as not connected', () => {
    expect(usePresenceStore.getState().isConnected).toBe(false);
  });

  it('can be set to connected', () => {
    usePresenceStore.getState().setConnected(true);
    expect(usePresenceStore.getState().isConnected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

describe('presence-store clear', () => {
  it('clears all state', () => {
    usePresenceStore.getState().setUser(makeUser());
    usePresenceStore.getState().setConnected(true);
    usePresenceStore.getState().setCurrentUserIdle(true);
    usePresenceStore.getState().clear();

    const state = usePresenceStore.getState();
    expect(state.users.size).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.isCurrentUserIdle).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

describe('selectPresenceUsers', () => {
  it('returns empty array when no users', () => {
    const result = selectPresenceUsers(usePresenceStore.getState());
    expect(result).toEqual([]);
  });

  it('returns users sorted by displayName', () => {
    usePresenceStore
      .getState()
      .setUsers([
        makeUser({ userId: 'u3', displayName: 'Charlie' }),
        makeUser({ userId: 'u1', displayName: 'Alice' }),
        makeUser({ userId: 'u2', displayName: 'Bob' }),
      ]);

    const result = selectPresenceUsers(usePresenceStore.getState());
    expect(result.map((u) => u.displayName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});

describe('selectUsersOnNote', () => {
  it('returns users viewing a specific note', () => {
    usePresenceStore
      .getState()
      .setUsers([
        makeUser({ userId: 'u1', activeNoteId: 'note-1' }),
        makeUser({ userId: 'u2', activeNoteId: 'note-2' }),
        makeUser({ userId: 'u3', activeNoteId: 'note-1' }),
      ]);

    const result = selectUsersOnNote(usePresenceStore.getState(), 'note-1');
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.userId).sort()).toEqual(['u1', 'u3']);
  });

  it('returns empty array for notes with no viewers', () => {
    const result = selectUsersOnNote(usePresenceStore.getState(), 'non-existent');
    expect(result).toEqual([]);
  });
});

describe('selectNoteViewerCounts', () => {
  it('returns viewer counts per note', () => {
    usePresenceStore
      .getState()
      .setUsers([
        makeUser({ userId: 'u1', activeNoteId: 'note-1' }),
        makeUser({ userId: 'u2', activeNoteId: 'note-1' }),
        makeUser({ userId: 'u3', activeNoteId: 'note-2' }),
        makeUser({ userId: 'u4', activeNoteId: null }),
      ]);

    const counts = selectNoteViewerCounts(usePresenceStore.getState());
    expect(counts.get('note-1')).toBe(2);
    expect(counts.get('note-2')).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe('selectOnlineUserCount', () => {
  it('counts only online users', () => {
    usePresenceStore
      .getState()
      .setUsers([
        makeUser({ userId: 'u1', status: 'online' }),
        makeUser({ userId: 'u2', status: 'away' }),
        makeUser({ userId: 'u3', status: 'online' }),
        makeUser({ userId: 'u4', status: 'offline' }),
      ]);

    const count = selectOnlineUserCount(usePresenceStore.getState());
    expect(count).toBe(2);
  });
});
