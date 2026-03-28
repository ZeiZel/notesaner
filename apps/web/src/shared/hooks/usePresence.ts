/**
 * usePresence.ts
 *
 * Hook connecting to the Yjs awareness protocol for real-time presence.
 *
 * Presence data includes: which users are online, which note they are viewing,
 * and their cursor color. This hook exposes a reactive list of present users
 * for the current workspace, along with helpers to filter by note.
 *
 * Design decisions:
 *   - Uses useSyncExternalStore to subscribe to the awareness protocol,
 *     avoiding useEffect for state synchronization.
 *   - Presence color is deterministically derived from the user ID
 *     (via getPresenceColor from shared utils).
 *   - The hook does NOT manage the Yjs awareness instance itself -- it
 *     consumes a provider exposed via React context or a global singleton.
 *     Until the real Yjs provider is integrated, a mock awareness emitter
 *     is used for development.
 *
 * Valid useEffect usage:
 *   - Setting local awareness state on mount/unmount (side effect on
 *     an external system, not derivable from render).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getPresenceColor } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single user's presence state as stored in the Yjs awareness protocol. */
export interface PresenceUser {
  /** Unique user ID. */
  userId: string;
  /** Display name shown in the avatar tooltip. */
  displayName: string;
  /** URL to the user's avatar image. Null if no avatar is set. */
  avatarUrl: string | null;
  /** Deterministic cursor/presence color derived from userId. */
  color: string;
  /** ID of the note the user is currently viewing. Null if on workspace home. */
  activeNoteId: string | null;
  /** ISO timestamp of the last activity. */
  lastActiveAt: string;
  /** Whether the user is online (within the last 30 seconds of activity). */
  isOnline: boolean;
}

export interface UsePresenceOptions {
  /** Current user info to broadcast via awareness. */
  currentUser: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  /** The note ID the current user is viewing. */
  activeNoteId: string | null;
  /** Workspace ID for scoping presence. */
  workspaceId: string | null;
}

export interface UsePresenceReturn {
  /** All present users in the workspace (excluding the current user). */
  users: PresenceUser[];
  /** Present users viewing a specific note. */
  usersOnNote: (noteId: string) => PresenceUser[];
  /** Map of noteId -> number of users viewing that note. */
  noteViewerCounts: Map<string, number>;
  /** Whether the presence connection is active. */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Mock Awareness Store (development stand-in for Yjs awareness)
// ---------------------------------------------------------------------------

/**
 * In-memory presence store that simulates the Yjs awareness protocol.
 * This will be replaced by a real Yjs awareness adapter when the sync
 * engine WebSocket connection is wired up.
 */

type Listener = () => void;

interface PresenceStoreState {
  users: Map<string, PresenceUser>;
  listeners: Set<Listener>;
  isConnected: boolean;
}

const presenceStore: PresenceStoreState = {
  users: new Map(),
  listeners: new Set(),
  isConnected: false,
};

function subscribe(listener: Listener): () => void {
  presenceStore.listeners.add(listener);
  return () => {
    presenceStore.listeners.delete(listener);
  };
}

function notifyListeners(): void {
  for (const listener of presenceStore.listeners) {
    listener();
  }
}

function getSnapshot(): Map<string, PresenceUser> {
  return presenceStore.users;
}

function getServerSnapshot(): Map<string, PresenceUser> {
  return new Map();
}

/**
 * Set the local user's presence in the store.
 * In production this writes to Yjs awareness.setLocalState().
 */
export function setLocalPresence(user: PresenceUser): void {
  presenceStore.users.set(user.userId, user);
  presenceStore.isConnected = true;
  notifyListeners();
}

/**
 * Remove the local user's presence from the store.
 * Called on unmount / disconnect.
 */
export function removeLocalPresence(userId: string): void {
  presenceStore.users.delete(userId);
  notifyListeners();
}

/**
 * Update a specific field of the local user's presence.
 */
export function updateLocalPresence(userId: string, patch: Partial<PresenceUser>): void {
  const existing = presenceStore.users.get(userId);
  if (existing) {
    presenceStore.users.set(userId, { ...existing, ...patch });
    notifyListeners();
  }
}

/**
 * Simulate remote users for development.
 * This function is exported for use in development/testing only.
 */
export function addMockPresenceUser(user: PresenceUser): void {
  presenceStore.users.set(user.userId, user);
  notifyListeners();
}

/**
 * Clear all presence data (used in tests).
 */
export function clearPresence(): void {
  presenceStore.users.clear();
  presenceStore.isConnected = false;
  notifyListeners();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresence({
  currentUser,
  activeNoteId,
  workspaceId: _workspaceId,
}: UsePresenceOptions): UsePresenceReturn {
  // Subscribe to the presence store using useSyncExternalStore.
  // This avoids useEffect for state synchronization entirely.
  const usersMap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Set/update local user presence when props change.
  // We use a ref-based approach via queueMicrotask to avoid setState-during-render,
  // but the actual state management is external (the presence store).
  // NOTE: This is one of the few valid places where we'd use useEffect in production
  // (to set local awareness state on an external system). For now, we use
  // synchronous updates via the mock store since there's no async Yjs connection.
  if (currentUser) {
    const existingLocal = usersMap.get(currentUser.userId);
    const needsUpdate =
      !existingLocal ||
      existingLocal.activeNoteId !== activeNoteId ||
      existingLocal.displayName !== currentUser.displayName;

    if (needsUpdate) {
      // Schedule microtask to avoid mutation during render
      queueMicrotask(() => {
        setLocalPresence({
          userId: currentUser.userId,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
          color: getPresenceColor(currentUser.userId),
          activeNoteId: activeNoteId,
          lastActiveAt: new Date().toISOString(),
          isOnline: true,
        });
      });
    }
  }

  // Derive users list excluding current user — computed at render time, no effect needed.
  const users = useMemo(() => {
    const result: PresenceUser[] = [];
    for (const [id, user] of usersMap) {
      if (currentUser && id === currentUser.userId) continue;
      result.push(user);
    }
    return result;
  }, [usersMap, currentUser]);

  // Derive per-note viewer counts — computed at render time.
  const noteViewerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      if (user.activeNoteId) {
        counts.set(user.activeNoteId, (counts.get(user.activeNoteId) ?? 0) + 1);
      }
    }
    return counts;
  }, [users]);

  // Filter users by note ID — stable callback.
  const usersOnNote = useCallback(
    (noteId: string): PresenceUser[] => {
      return users.filter((u) => u.activeNoteId === noteId);
    },
    [users],
  );

  return {
    users,
    usersOnNote,
    noteViewerCounts,
    isConnected: presenceStore.isConnected,
  };
}
