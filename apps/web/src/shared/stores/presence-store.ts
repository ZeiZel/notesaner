/**
 * presence-store.ts
 *
 * Zustand store for workspace-level presence state.
 *
 * Business logic:
 *   - Tracks which users are online in the workspace.
 *   - Tracks which notes each user is viewing.
 *   - Manages idle status (away after 5 min inactivity).
 *   - Provides selectors for per-note viewers, online users, and viewer counts.
 *
 * This is a business logic store (not transient UI state) because:
 *   - Presence data comes from an external system (Yjs awareness / WebSocket).
 *   - State is shared across multiple widgets (editor bar, file explorer, member list).
 *   - Idle detection is a cross-cutting concern.
 *
 * Design notes:
 *   - NOT persisted — presence is ephemeral and rebuilt on connect.
 *   - All mutations go through actions for traceability (devtools).
 *   - The store is the single source of truth; usePresence hook feeds data here.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface WorkspacePresenceUser {
  /** Unique user ID. */
  userId: string;
  /** Display name. */
  displayName: string;
  /** Avatar URL. Null if no avatar is set. */
  avatarUrl: string | null;
  /** Deterministic presence color. */
  color: string;
  /** ID of the note the user is currently viewing. Null if on workspace home. */
  activeNoteId: string | null;
  /** Current cursor position description (e.g. "Line 42, Col 8"). Null if unknown. */
  cursorDescription: string | null;
  /** Presence status: online, away, or offline. */
  status: PresenceStatus;
  /** ISO timestamp of last activity. */
  lastActiveAt: string;
}

// ---------------------------------------------------------------------------
// Store State & Actions
// ---------------------------------------------------------------------------

interface PresenceStoreState {
  /** All users currently in the workspace (excluding current user). */
  users: Map<string, WorkspacePresenceUser>;

  /** Current user's idle status. */
  isCurrentUserIdle: boolean;

  /** Whether the presence system is connected. */
  isConnected: boolean;

  // ---- Actions ----

  /** Set or update a user's presence. */
  setUser: (user: WorkspacePresenceUser) => void;

  /** Remove a user (disconnect/leave). */
  removeUser: (userId: string) => void;

  /** Batch update multiple users (e.g. on initial snapshot). */
  setUsers: (users: WorkspacePresenceUser[]) => void;

  /** Mark the current user as idle. */
  setCurrentUserIdle: (idle: boolean) => void;

  /** Update a user's active note. */
  setUserActiveNote: (userId: string, noteId: string | null) => void;

  /** Update a user's cursor description. */
  setUserCursorDescription: (userId: string, description: string | null) => void;

  /** Update a user's status. */
  setUserStatus: (userId: string, status: PresenceStatus) => void;

  /** Set connection status. */
  setConnected: (connected: boolean) => void;

  /** Clear all presence data (on disconnect or workspace switch). */
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePresenceStore = create<PresenceStoreState>()(
  devtools(
    (set) => ({
      users: new Map(),
      isCurrentUserIdle: false,
      isConnected: false,

      setUser: (user) =>
        set(
          (state) => {
            const next = new Map(state.users);
            next.set(user.userId, user);
            return { users: next };
          },
          false,
          'presence/setUser',
        ),

      removeUser: (userId) =>
        set(
          (state) => {
            const next = new Map(state.users);
            next.delete(userId);
            return { users: next };
          },
          false,
          'presence/removeUser',
        ),

      setUsers: (users) =>
        set(
          () => {
            const next = new Map<string, WorkspacePresenceUser>();
            for (const user of users) {
              next.set(user.userId, user);
            }
            return { users: next };
          },
          false,
          'presence/setUsers',
        ),

      setCurrentUserIdle: (idle) =>
        set({ isCurrentUserIdle: idle }, false, 'presence/setCurrentUserIdle'),

      setUserActiveNote: (userId, noteId) =>
        set(
          (state) => {
            const existing = state.users.get(userId);
            if (!existing) return state;
            const next = new Map(state.users);
            next.set(userId, { ...existing, activeNoteId: noteId });
            return { users: next };
          },
          false,
          'presence/setUserActiveNote',
        ),

      setUserCursorDescription: (userId, description) =>
        set(
          (state) => {
            const existing = state.users.get(userId);
            if (!existing) return state;
            const next = new Map(state.users);
            next.set(userId, { ...existing, cursorDescription: description });
            return { users: next };
          },
          false,
          'presence/setUserCursorDescription',
        ),

      setUserStatus: (userId, status) =>
        set(
          (state) => {
            const existing = state.users.get(userId);
            if (!existing) return state;
            const next = new Map(state.users);
            next.set(userId, { ...existing, status });
            return { users: next };
          },
          false,
          'presence/setUserStatus',
        ),

      setConnected: (connected) => set({ isConnected: connected }, false, 'presence/setConnected'),

      clear: () =>
        set(
          { users: new Map(), isConnected: false, isCurrentUserIdle: false },
          false,
          'presence/clear',
        ),
    }),
    { name: 'PresenceStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Returns all users as an array, sorted by displayName.
 */
export function selectPresenceUsers(state: PresenceStoreState): WorkspacePresenceUser[] {
  return Array.from(state.users.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

/**
 * Returns users currently viewing a specific note.
 */
export function selectUsersOnNote(
  state: PresenceStoreState,
  noteId: string,
): WorkspacePresenceUser[] {
  const result: WorkspacePresenceUser[] = [];
  for (const user of state.users.values()) {
    if (user.activeNoteId === noteId) {
      result.push(user);
    }
  }
  return result;
}

/**
 * Returns the number of users viewing each note.
 */
export function selectNoteViewerCounts(state: PresenceStoreState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const user of state.users.values()) {
    if (user.activeNoteId) {
      counts.set(user.activeNoteId, (counts.get(user.activeNoteId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Returns the count of online users (not away, not offline).
 */
export function selectOnlineUserCount(state: PresenceStoreState): number {
  let count = 0;
  for (const user of state.users.values()) {
    if (user.status === 'online') count++;
  }
  return count;
}
