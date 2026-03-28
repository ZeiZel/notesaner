import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FreshnessStatusFilter, ReviewQueueItem } from '@/shared/api/freshness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FreshnessQueueFilters {
  status: FreshnessStatusFilter;
  ownerId: string | undefined;
  folder: string | undefined;
}

interface FreshnessState {
  // Queue data
  items: ReviewQueueItem[];
  total: number;
  hasMore: boolean;
  cursor: string | undefined;

  // Thresholds (cached from last fetch)
  agingThresholdDays: number;
  staleThresholdDays: number;

  // UI state
  filters: FreshnessQueueFilters;
  isLoading: boolean;
  error: string | null;

  // Optimistic review tracking
  /** Set of noteIds that are currently being reviewed (pending API response) */
  pendingReviewIds: Set<string>;

  // Actions
  setItems: (
    items: ReviewQueueItem[],
    total: number,
    hasMore: boolean,
    cursor: string | undefined,
  ) => void;
  appendItems: (items: ReviewQueueItem[], hasMore: boolean, cursor: string | undefined) => void;
  setThresholds: (agingThresholdDays: number, staleThresholdDays: number) => void;
  setFilters: (filters: Partial<FreshnessQueueFilters>) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markReviewPending: (noteId: string) => void;
  markReviewComplete: (noteId: string) => void;
  removeItem: (noteId: string) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: FreshnessQueueFilters = {
  status: 'stale',
  ownerId: undefined,
  folder: undefined,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFreshnessStore = create<FreshnessState>()(
  devtools(
    (set, get) => ({
      // Initial state
      items: [],
      total: 0,
      hasMore: false,
      cursor: undefined,
      agingThresholdDays: 60,
      staleThresholdDays: 90,
      filters: { ...DEFAULT_FILTERS },
      isLoading: false,
      error: null,
      pendingReviewIds: new Set<string>(),

      // Actions

      setItems: (items, total, hasMore, cursor) =>
        set({ items, total, hasMore, cursor }, false, 'freshness/setItems'),

      appendItems: (newItems, hasMore, cursor) =>
        set(
          (state) => ({
            items: [...state.items, ...newItems],
            hasMore,
            cursor,
          }),
          false,
          'freshness/appendItems',
        ),

      setThresholds: (agingThresholdDays, staleThresholdDays) =>
        set({ agingThresholdDays, staleThresholdDays }, false, 'freshness/setThresholds'),

      setFilters: (partial) =>
        set(
          (state) => ({
            filters: { ...state.filters, ...partial },
            // Reset pagination when filters change
            cursor: undefined,
            items: [],
            hasMore: false,
          }),
          false,
          'freshness/setFilters',
        ),

      resetFilters: () =>
        set(
          {
            filters: { ...DEFAULT_FILTERS },
            cursor: undefined,
            items: [],
            hasMore: false,
          },
          false,
          'freshness/resetFilters',
        ),

      setLoading: (isLoading) => set({ isLoading }, false, 'freshness/setLoading'),

      setError: (error) => set({ error }, false, 'freshness/setError'),

      markReviewPending: (noteId) =>
        set(
          (state) => {
            const next = new Set(state.pendingReviewIds);
            next.add(noteId);
            return { pendingReviewIds: next };
          },
          false,
          'freshness/markPending',
        ),

      markReviewComplete: (noteId) =>
        set(
          (state) => {
            const next = new Set(state.pendingReviewIds);
            next.delete(noteId);
            return { pendingReviewIds: next };
          },
          false,
          'freshness/markComplete',
        ),

      removeItem: (noteId) =>
        set(
          (state) => ({
            items: state.items.filter((item) => item.noteId !== noteId),
            total: Math.max(0, state.total - 1),
          }),
          false,
          'freshness/removeItem',
        ),

      reset: () => {
        const { pendingReviewIds } = get();
        // Abort any pending review tracking
        pendingReviewIds.clear();
        set(
          {
            items: [],
            total: 0,
            hasMore: false,
            cursor: undefined,
            filters: { ...DEFAULT_FILTERS },
            isLoading: false,
            error: null,
            pendingReviewIds: new Set<string>(),
          },
          false,
          'freshness/reset',
        );
      },
    }),
    { name: 'FreshnessStore' },
  ),
);
