// NOTE: Business store — core user favorites (bookmarked notes). Zustand kept because:
//   - Favorites are persisted to localStorage for instant sidebar rendering on page load,
//     and synced to the server preferences API for cross-device persistence.
//   - Favorite management (toggle, reorder, limit enforcement) is domain logic.
//   - Location in shared/stores is appropriate since favorites are cross-feature.
/**
 * favorites-store.ts
 *
 * Zustand store for managing the user's favorite (bookmarked) notes.
 *
 * Each favorite entry stores:
 *   - noteId: the unique note ID
 *   - title: display title
 *   - path: file path for context display
 *   - addedAt: ISO timestamp of when the note was favorited
 *
 * Design notes:
 *   - Favorites are ordered: array position = display order.
 *   - Drag-to-reorder supported via reorderFavorite().
 *   - Max 50 favorites per workspace (enforced client-side).
 *   - Persisted to localStorage for fast sidebar rendering.
 *   - Synced to server preferences API (favorites.noteIds key) for cross-device.
 *   - Server sync is fire-and-forget; localStorage is source of truth for UX.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { preferencesApi } from '@/shared/api/preferences';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_FAVORITES = 50;
const PREFERENCES_KEY = 'favorites.noteIds';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteEntry {
  /** The note ID. */
  noteId: string;
  /** Display title of the note. */
  title: string;
  /** Full file path (for folder context display). */
  path: string;
  /** ISO timestamp when the note was favorited. */
  addedAt: string;
}

interface FavoritesState {
  // State
  /** Ordered array of favorite entries. Array order = display order. */
  favorites: FavoriteEntry[];
  /** Whether the initial server sync has been completed. */
  isSynced: boolean;

  // Actions
  /** Toggle a note as favorite. Returns true if added, false if removed. */
  toggleFavorite: (noteId: string, title: string, path: string) => boolean;
  /** Add a note to favorites. No-op if already favorited or at max limit. */
  addFavorite: (noteId: string, title: string, path: string) => void;
  /** Remove a note from favorites by noteId. */
  removeFavorite: (noteId: string) => void;
  /** Check if a note is currently favorited. */
  isFavorite: (noteId: string) => boolean;
  /** Reorder a favorite from one index to another. */
  reorderFavorite: (fromIndex: number, toIndex: number) => void;
  /** Update the title of a favorited note (e.g. on rename). */
  updateFavoriteTitle: (noteId: string, title: string) => void;
  /** Update the path of a favorited note (e.g. on move). */
  updateFavoritePath: (noteId: string, path: string) => void;
  /** Sync favorites from the server preferences API. */
  syncFromServer: (token: string) => Promise<void>;
  /** Persist current favorites to the server preferences API (fire-and-forget). */
  syncToServer: (token: string) => void;
  /** Clear all favorites (e.g. on workspace switch). */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFavoritesStore = create<FavoritesState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        favorites: [],
        isSynced: false,

        toggleFavorite: (noteId, title, path) => {
          const state = get();
          const existing = state.favorites.find((f) => f.noteId === noteId);
          if (existing) {
            set(
              { favorites: state.favorites.filter((f) => f.noteId !== noteId) },
              false,
              'favorites/remove',
            );
            return false;
          }

          if (state.favorites.length >= MAX_FAVORITES) {
            return false;
          }

          const entry: FavoriteEntry = {
            noteId,
            title,
            path,
            addedAt: new Date().toISOString(),
          };
          set({ favorites: [...state.favorites, entry] }, false, 'favorites/add');
          return true;
        },

        addFavorite: (noteId, title, path) => {
          const state = get();
          if (state.favorites.some((f) => f.noteId === noteId)) return;
          if (state.favorites.length >= MAX_FAVORITES) return;

          const entry: FavoriteEntry = {
            noteId,
            title,
            path,
            addedAt: new Date().toISOString(),
          };
          set({ favorites: [...state.favorites, entry] }, false, 'favorites/add');
        },

        removeFavorite: (noteId) =>
          set(
            (state) => ({
              favorites: state.favorites.filter((f) => f.noteId !== noteId),
            }),
            false,
            'favorites/remove',
          ),

        isFavorite: (noteId) => {
          return get().favorites.some((f) => f.noteId === noteId);
        },

        reorderFavorite: (fromIndex, toIndex) =>
          set(
            (state) => {
              if (
                fromIndex < 0 ||
                fromIndex >= state.favorites.length ||
                toIndex < 0 ||
                toIndex >= state.favorites.length ||
                fromIndex === toIndex
              ) {
                return state;
              }

              const newFavorites = [...state.favorites];
              const [moved] = newFavorites.splice(fromIndex, 1);
              newFavorites.splice(toIndex, 0, moved);

              return { favorites: newFavorites };
            },
            false,
            'favorites/reorder',
          ),

        updateFavoriteTitle: (noteId, title) =>
          set(
            (state) => ({
              favorites: state.favorites.map((f) => (f.noteId === noteId ? { ...f, title } : f)),
            }),
            false,
            'favorites/updateTitle',
          ),

        updateFavoritePath: (noteId, path) =>
          set(
            (state) => ({
              favorites: state.favorites.map((f) => (f.noteId === noteId ? { ...f, path } : f)),
            }),
            false,
            'favorites/updatePath',
          ),

        syncFromServer: async (token) => {
          try {
            const response = await preferencesApi.getByKey(token, PREFERENCES_KEY);
            const serverNoteIds = response.value;

            if (Array.isArray(serverNoteIds) && serverNoteIds.length > 0) {
              // Merge server favorites with local favorites.
              // Server provides the ordered list of noteIds; local has metadata.
              // If local has entries not on server, keep them (optimistic).
              // If server has entries not locally, add them with minimal metadata.
              const localMap = new Map(get().favorites.map((f) => [f.noteId, f]));
              const merged: FavoriteEntry[] = [];

              for (const id of serverNoteIds) {
                if (typeof id !== 'string') continue;
                const local = localMap.get(id);
                if (local) {
                  merged.push(local);
                } else {
                  // Server has a favorite we don't have locally — add with placeholder
                  merged.push({
                    noteId: id,
                    title: id, // Will be updated when sidebar renders
                    path: '',
                    addedAt: new Date().toISOString(),
                  });
                }
              }

              set(
                { favorites: merged.slice(0, MAX_FAVORITES), isSynced: true },
                false,
                'favorites/syncFromServer',
              );
            } else {
              set({ isSynced: true }, false, 'favorites/syncFromServer');
            }
          } catch {
            // Server may return 404 if no favorites stored yet — that's OK
            set({ isSynced: true }, false, 'favorites/syncFromServer');
          }
        },

        syncToServer: (token) => {
          const noteIds = get().favorites.map((f) => f.noteId);
          // Fire-and-forget — don't block UI on server persistence
          preferencesApi.set(token, PREFERENCES_KEY, noteIds).catch((error) => {
            console.warn('[FavoritesStore] Failed to sync favorites to server:', error);
          });
        },

        clearAll: () => set({ favorites: [], isSynced: false }, false, 'favorites/clearAll'),
      }),
      {
        name: 'notesaner-favorites',
        partialize: (state) => ({
          favorites: state.favorites,
        }),
      },
    ),
    { name: 'FavoritesStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Select the count of favorites. */
export const selectFavoritesCount = (state: FavoritesState): number => state.favorites.length;

/** Check if the favorites list is at the maximum. */
export const selectIsFavoritesFull = (state: FavoritesState): boolean =>
  state.favorites.length >= MAX_FAVORITES;
