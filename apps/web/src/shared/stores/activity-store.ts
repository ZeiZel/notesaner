import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activityApi, type ActivityLogDto, type ActivityType } from '@/shared/api/activity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityFilters {
  type: ActivityType | null;
  userId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

interface ActivityState {
  // State
  items: ActivityLogDto[];
  total: number;
  page: number;
  isLoading: boolean;
  hasMore: boolean;
  filters: ActivityFilters;

  // Per-note activity
  noteItems: ActivityLogDto[];
  noteTotal: number;
  notePage: number;
  noteHasMore: boolean;
  isNoteLoading: boolean;

  // Actions
  setFilters: (filters: Partial<ActivityFilters>) => void;
  resetFilters: () => void;

  // Async actions
  fetchWorkspaceActivity: (workspaceId: string, reset?: boolean) => Promise<void>;
  loadMore: (workspaceId: string) => Promise<void>;
  fetchNoteActivity: (noteId: string, reset?: boolean) => Promise<void>;
  loadMoreNoteActivity: (noteId: string) => Promise<void>;

  // Real-time
  prependActivity: (activity: ActivityLogDto) => void;

  // Reset
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: ActivityFilters = {
  type: null,
  userId: null,
  dateFrom: null,
  dateTo: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useActivityStore = create<ActivityState>()(
  devtools(
    (set, get) => ({
      // Initial state
      items: [],
      total: 0,
      page: 1,
      isLoading: false,
      hasMore: false,
      filters: { ...DEFAULT_FILTERS },

      noteItems: [],
      noteTotal: 0,
      notePage: 1,
      noteHasMore: false,
      isNoteLoading: false,

      // ---- Sync actions ----

      setFilters: (partial) =>
        set(
          (state) => ({
            filters: { ...state.filters, ...partial },
            // Reset pagination when filters change
            page: 1,
            items: [],
            hasMore: false,
          }),
          false,
          'activity/setFilters',
        ),

      resetFilters: () =>
        set(
          {
            filters: { ...DEFAULT_FILTERS },
            page: 1,
            items: [],
            hasMore: false,
          },
          false,
          'activity/resetFilters',
        ),

      prependActivity: (activity) =>
        set(
          (state) => ({
            items: [activity, ...state.items],
            total: state.total + 1,
          }),
          false,
          'activity/prependActivity',
        ),

      // ---- Async actions ----

      fetchWorkspaceActivity: async (workspaceId, reset = false) => {
        const { filters } = get();
        const page = reset ? 1 : get().page;

        set({ isLoading: true }, false, 'activity/fetchStart');

        try {
          const response = await activityApi.getWorkspaceActivity(workspaceId, {
            page,
            limit: PAGE_SIZE,
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.userId ? { userId: filters.userId } : {}),
            ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
            ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
          });

          set(
            {
              items: reset ? response.data : [...get().items, ...response.data],
              total: response.pagination.total,
              hasMore: response.pagination.hasMore,
              page: response.pagination.page,
              isLoading: false,
            },
            false,
            'activity/fetchSuccess',
          );
        } catch {
          set({ isLoading: false }, false, 'activity/fetchError');
        }
      },

      loadMore: async (workspaceId) => {
        const { hasMore, isLoading, page } = get();
        if (!hasMore || isLoading) return;

        set({ page: page + 1 }, false, 'activity/loadMorePage');
        await get().fetchWorkspaceActivity(workspaceId, false);
      },

      fetchNoteActivity: async (noteId, reset = false) => {
        const page = reset ? 1 : get().notePage;

        set({ isNoteLoading: true }, false, 'activity/noteFetchStart');

        try {
          const response = await activityApi.getNoteActivity(noteId, {
            page,
            limit: PAGE_SIZE,
          });

          set(
            {
              noteItems: reset ? response.data : [...get().noteItems, ...response.data],
              noteTotal: response.pagination.total,
              noteHasMore: response.pagination.hasMore,
              notePage: response.pagination.page,
              isNoteLoading: false,
            },
            false,
            'activity/noteFetchSuccess',
          );
        } catch {
          set({ isNoteLoading: false }, false, 'activity/noteFetchError');
        }
      },

      loadMoreNoteActivity: async (noteId) => {
        const { noteHasMore, isNoteLoading, notePage } = get();
        if (!noteHasMore || isNoteLoading) return;

        set({ notePage: notePage + 1 }, false, 'activity/noteLoadMorePage');
        await get().fetchNoteActivity(noteId, false);
      },

      reset: () =>
        set(
          {
            items: [],
            total: 0,
            page: 1,
            isLoading: false,
            hasMore: false,
            filters: { ...DEFAULT_FILTERS },
            noteItems: [],
            noteTotal: 0,
            notePage: 1,
            noteHasMore: false,
            isNoteLoading: false,
          },
          false,
          'activity/reset',
        ),
    }),
    { name: 'ActivityStore' },
  ),
);
