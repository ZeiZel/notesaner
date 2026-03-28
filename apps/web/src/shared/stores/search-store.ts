/**
 * search-store.ts — Zustand store for saved searches and search state.
 *
 * Features:
 *   - Save search queries with custom names
 *   - Pin/unpin favorite searches
 *   - Share saved searches (generate shareable query strings)
 *   - Recent search history
 *   - Persisted to localStorage under 'notesaner-saved-searches'
 *
 * Search execution is NOT handled here — this store only manages the
 * user's saved/pinned/recent queries. The actual search API call is
 * triggered by the search UI component.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedSearch {
  /** Unique identifier */
  id: string;
  /** User-assigned name */
  name: string;
  /** The search query string (may contain operators) */
  query: string;
  /** Whether this search is pinned to the top of the list */
  pinned: boolean;
  /** ISO timestamp of when this search was created */
  createdAt: string;
  /** ISO timestamp of last use */
  lastUsedAt: string;
}

export interface SearchStoreState {
  // -- State --

  /** Saved searches ordered by most recently used */
  savedSearches: SavedSearch[];

  /** Recent search history (last N queries) */
  recentQueries: string[];

  /** Maximum number of recent queries to retain */
  maxRecentQueries: number;

  // -- Actions --

  /** Save a new search query with a name */
  saveSearch: (name: string, query: string) => SavedSearch;

  /** Remove a saved search by ID */
  removeSavedSearch: (id: string) => void;

  /** Update a saved search's name or query */
  updateSavedSearch: (id: string, patch: Partial<Pick<SavedSearch, 'name' | 'query'>>) => void;

  /** Toggle the pinned state of a saved search */
  togglePin: (id: string) => void;

  /** Record that a saved search was used (updates lastUsedAt) */
  markSearchUsed: (id: string) => void;

  /** Add a query to recent history */
  addRecentQuery: (query: string) => void;

  /** Clear all recent queries */
  clearRecentQueries: () => void;

  /** Remove a single recent query */
  removeRecentQuery: (query: string) => void;

  /** Duplicate a saved search */
  duplicateSavedSearch: (id: string) => SavedSearch | null;

  /** Reorder saved searches (move search to a new index) */
  reorderSavedSearch: (id: string, newIndex: number) => void;

  // -- Derived --

  /** Get all pinned searches, sorted by name */
  getPinnedSearches: () => SavedSearch[];

  /** Get all unpinned searches, sorted by lastUsedAt descending */
  getUnpinnedSearches: () => SavedSearch[];

  /** Generate a shareable URL-safe string for a saved search */
  getShareableQuery: (id: string) => string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECENT_QUERIES = 20;
const STORAGE_KEY = 'notesaner-saved-searches';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSearchStore = create<SearchStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // -- Initial state --
        savedSearches: [],
        recentQueries: [],
        maxRecentQueries: MAX_RECENT_QUERIES,

        // -- Actions --

        saveSearch: (name, query) => {
          const newSearch: SavedSearch = {
            id: generateId(),
            name,
            query,
            pinned: false,
            createdAt: nowIso(),
            lastUsedAt: nowIso(),
          };

          set(
            (state) => ({
              savedSearches: [newSearch, ...state.savedSearches],
            }),
            false,
            'search/saveSearch',
          );

          return newSearch;
        },

        removeSavedSearch: (id) =>
          set(
            (state) => ({
              savedSearches: state.savedSearches.filter((s) => s.id !== id),
            }),
            false,
            'search/removeSavedSearch',
          ),

        updateSavedSearch: (id, patch) =>
          set(
            (state) => ({
              savedSearches: state.savedSearches.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            }),
            false,
            'search/updateSavedSearch',
          ),

        togglePin: (id) =>
          set(
            (state) => ({
              savedSearches: state.savedSearches.map((s) =>
                s.id === id ? { ...s, pinned: !s.pinned } : s,
              ),
            }),
            false,
            'search/togglePin',
          ),

        markSearchUsed: (id) =>
          set(
            (state) => ({
              savedSearches: state.savedSearches.map((s) =>
                s.id === id ? { ...s, lastUsedAt: nowIso() } : s,
              ),
            }),
            false,
            'search/markSearchUsed',
          ),

        addRecentQuery: (query) =>
          set(
            (state) => {
              const trimmed = query.trim();
              if (!trimmed) return state;

              // Remove duplicate if exists, then prepend
              const filtered = state.recentQueries.filter((q) => q !== trimmed);
              const updated = [trimmed, ...filtered].slice(0, state.maxRecentQueries);

              return { recentQueries: updated };
            },
            false,
            'search/addRecentQuery',
          ),

        clearRecentQueries: () => set({ recentQueries: [] }, false, 'search/clearRecentQueries'),

        removeRecentQuery: (query) =>
          set(
            (state) => ({
              recentQueries: state.recentQueries.filter((q) => q !== query),
            }),
            false,
            'search/removeRecentQuery',
          ),

        duplicateSavedSearch: (id) => {
          const original = get().savedSearches.find((s) => s.id === id);
          if (!original) return null;

          const duplicate: SavedSearch = {
            id: generateId(),
            name: `${original.name} (copy)`,
            query: original.query,
            pinned: false,
            createdAt: nowIso(),
            lastUsedAt: nowIso(),
          };

          set(
            (state) => ({
              savedSearches: [duplicate, ...state.savedSearches],
            }),
            false,
            'search/duplicateSavedSearch',
          );

          return duplicate;
        },

        reorderSavedSearch: (id, newIndex) =>
          set(
            (state) => {
              const searches = [...state.savedSearches];
              const currentIndex = searches.findIndex((s) => s.id === id);
              if (currentIndex === -1) return state;

              const [item] = searches.splice(currentIndex, 1);
              const clampedIndex = Math.min(newIndex, searches.length);
              searches.splice(clampedIndex, 0, item);

              return { savedSearches: searches };
            },
            false,
            'search/reorderSavedSearch',
          ),

        // -- Derived --

        getPinnedSearches: () => {
          return get()
            .savedSearches.filter((s) => s.pinned)
            .sort((a, b) => a.name.localeCompare(b.name));
        },

        getUnpinnedSearches: () => {
          return get()
            .savedSearches.filter((s) => !s.pinned)
            .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
        },

        getShareableQuery: (id) => {
          const search = get().savedSearches.find((s) => s.id === id);
          if (!search) return null;
          // Encode query for URL sharing
          return encodeURIComponent(search.query);
        },
      }),
      {
        name: STORAGE_KEY,
        partialize: (state) => ({
          savedSearches: state.savedSearches,
          recentQueries: state.recentQueries,
        }),
      },
    ),
    { name: 'SearchStore' },
  ),
);
