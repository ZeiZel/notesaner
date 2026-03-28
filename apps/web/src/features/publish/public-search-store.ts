import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PublicSearchResult } from '@/shared/api/public-search';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicSearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface PublicSearchState {
  // ─── State ──────────────────────────────────────────────────────────────
  query: string;
  results: PublicSearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  status: PublicSearchStatus;
  errorMessage: string | null;

  // ─── Actions ────────────────────────────────────────────────────────────
  setQuery: (query: string) => void;
  setPage: (page: number) => void;
  setSearching: () => void;
  setResults: (results: PublicSearchResult[], total: number, hasMore: boolean) => void;
  setError: (message: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  query: '',
  results: [],
  total: 0,
  page: 0,
  limit: 10,
  hasMore: false,
  status: 'idle' as PublicSearchStatus,
  errorMessage: null,
};

/**
 * Zustand store for public vault search state.
 *
 * Holds the current search query, results, pagination cursor, and async status.
 * Components read from this store and dispatch actions; the actual API call
 * is made in PublicSearchBar using a debounced effect.
 *
 * Not persisted — public vault pages are server-side rendered and state is
 * ephemeral per browser session.
 */
export const usePublicSearchStore = create<PublicSearchState>()(
  devtools(
    (set) => ({
      ...INITIAL_STATE,

      setQuery: (query) =>
        set(
          {
            query,
            page: 0,
            results: [],
            total: 0,
            hasMore: false,
            status: 'idle',
            errorMessage: null,
          },
          false,
          'publicSearch/setQuery',
        ),

      setPage: (page) => set({ page }, false, 'publicSearch/setPage'),

      setSearching: () =>
        set({ status: 'loading', errorMessage: null }, false, 'publicSearch/setSearching'),

      setResults: (results, total, hasMore) =>
        set(
          { results, total, hasMore, status: 'success', errorMessage: null },
          false,
          'publicSearch/setResults',
        ),

      setError: (message) =>
        set(
          { status: 'error', errorMessage: message, results: [], total: 0, hasMore: false },
          false,
          'publicSearch/setError',
        ),

      reset: () => set(INITIAL_STATE, false, 'publicSearch/reset'),
    }),
    { name: 'PublicSearchStore' },
  ),
);
