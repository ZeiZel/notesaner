/**
 * useLayoutPersistence.ts
 *
 * Hook that manages layout persistence lifecycle:
 *   - Restores the user's saved layout on mount (login)
 *   - Starts auto-saving layout changes with debounce
 *   - Cleans up subscriptions on unmount (logout)
 *
 * Design notes:
 *   - useEffect is valid here: subscribing to external store changes
 *     (Zustand subscribe) and managing the auto-save lifecycle is a
 *     genuine side effect that cannot be expressed as derived state.
 *   - The restore call on mount is an async operation that interacts
 *     with the server — also a valid effect use case.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { startAutoSave, restoreLayout } from './layout-persistence';

/**
 * Activates layout persistence: auto-save and restore.
 *
 * Mount this once inside the workspace layout. It will:
 *   1. Restore the last server-saved layout on first mount
 *   2. Start auto-saving layout changes (debounced 2s)
 *   3. Stop auto-saving on unmount
 */
export function useLayoutPersistence(): void {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const didRestore = useRef(false);

  useEffect(() => {
    if (!token || !workspaceId) return;

    // Restore layout on first activation for this workspace
    if (!didRestore.current) {
      didRestore.current = true;
      restoreLayout(token, workspaceId).catch(() => {
        // Restoration failed — localStorage fallback is in place
      });
    }

    // Start auto-saving layout changes
    const cleanup = startAutoSave(token, workspaceId);

    return () => {
      cleanup();
    };
  }, [token, workspaceId]);

  // Reset restore flag when workspace changes
  useEffect(() => {
    didRestore.current = false;
  }, [workspaceId]);
}
