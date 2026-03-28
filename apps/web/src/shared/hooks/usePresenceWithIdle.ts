'use client';

/**
 * usePresenceWithIdle -- connects idle detection to the presence store.
 *
 * Orchestrates:
 *   1. Idle detection (5 min timeout) via useIdleDetection
 *   2. Updates the presence store's current-user idle flag
 *   3. Broadcasts idle/active status changes via the presence hook
 *
 * This hook should be called once at the workspace shell level.
 *
 * Design decisions:
 *   - useIdleDetection uses valid useEffect (DOM event listeners).
 *   - Presence store mutations happen in callbacks, not effects.
 *   - The hook composes useIdleDetection + usePresenceStore, avoiding
 *     any additional useEffect.
 */

import { useCallback } from 'react';
import { useIdleDetection, DEFAULT_IDLE_TIMEOUT_MS } from './useIdleDetection';
import { usePresenceStore } from '@/shared/stores/presence-store';
import { updateLocalPresence } from './usePresence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePresenceWithIdleOptions {
  /** Current user ID. Null if not authenticated. */
  userId: string | null;
  /** Idle timeout in milliseconds. Defaults to 5 minutes. */
  idleTimeoutMs?: number;
  /** Whether to enable idle detection. Defaults to true. */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresenceWithIdle({
  userId,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  enabled = true,
}: UsePresenceWithIdleOptions): void {
  const setCurrentUserIdle = usePresenceStore((s) => s.setCurrentUserIdle);

  const handleIdle = useCallback(() => {
    setCurrentUserIdle(true);
    // Also update the presence broadcast store (mock awareness)
    if (userId) {
      updateLocalPresence(userId, {
        isOnline: false,
        lastActiveAt: new Date().toISOString(),
      });
    }
  }, [setCurrentUserIdle, userId]);

  const handleActive = useCallback(() => {
    setCurrentUserIdle(false);
    if (userId) {
      updateLocalPresence(userId, {
        isOnline: true,
        lastActiveAt: new Date().toISOString(),
      });
    }
  }, [setCurrentUserIdle, userId]);

  useIdleDetection({
    idleTimeoutMs,
    onIdle: handleIdle,
    onActive: handleActive,
    enabled: enabled && userId !== null,
  });
}
