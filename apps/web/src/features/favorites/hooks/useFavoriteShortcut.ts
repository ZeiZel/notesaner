'use client';

/**
 * useFavoriteShortcut — registers the Cmd+Shift+B keyboard shortcut
 * for toggling the active note as a favorite.
 *
 * Uses the keyboard manager singleton to register a handler for
 * the 'toggle-favorite' shortcut action. The handler reads the
 * active note from the note-state store and toggles it.
 *
 * Design:
 *   - useEffect is valid here: registering a side effect (keyboard handler)
 *     with an external system (keyboardManager). Returns cleanup function.
 */

import { useEffect } from 'react';
import { keyboardManager } from '@/shared/lib/keyboard-manager';
import { useFavoritesStore } from '@/shared/stores/favorites-store';
import { useNoteStateStore } from '@/shared/stores/note-state-store';
import { useAuthStore } from '@/shared/stores/auth-store';

export function useFavoriteShortcut(): void {
  useEffect(() => {
    const unregister = keyboardManager.register('toggle-favorite', 'global', () => {
      const { activeNote } = useNoteStateStore.getState();
      if (!activeNote) return;

      const { toggleFavorite, syncToServer } = useFavoritesStore.getState();
      toggleFavorite(activeNote.id, activeNote.title, activeNote.path);

      const { accessToken } = useAuthStore.getState();
      if (accessToken) {
        syncToServer(accessToken);
      }
    });

    return unregister;
  }, []);
}
