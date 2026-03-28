/**
 * analytics-store.ts
 *
 * Zustand store for analytics dashboard state.
 *
 * Responsibilities:
 * - Maintain the selected date range filter
 * - Cache last-fetched analytics data per workspace (simple in-memory map)
 * - Track loading and error state
 *
 * Data fetching is handled via TanStack Query hooks (useAnalytics, etc.)
 * defined in this module. The Zustand store only manages UI state (dateRange
 * selection) and a lightweight summary cache to avoid re-fetching on tab
 * switches within the same session.
 *
 * Cache invalidation:
 * - Cache is keyed by workspaceId + dateRange
 * - Cache TTL is 5 minutes (staleTime in useQuery)
 * - Manual refresh available via the refetch() hook return value
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  analyticsApi,
  type DateRange,
  type AnalyticsSummary,
  type DailyStatPoint,
  type TopNoteItem,
} from '@/shared/api/analytics';

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export interface AnalyticsUiState {
  /** Currently selected date range for the dashboard. */
  selectedDateRange: DateRange;

  /** Optional note ID when viewing per-note analytics. */
  focusedNoteId: string | null;

  // ── Actions ──

  /** Set the active date range filter. */
  setDateRange: (range: DateRange) => void;

  /** Focus on a specific note's analytics. Pass null to clear focus. */
  setFocusedNoteId: (noteId: string | null) => void;

  /** Reset to default state. */
  reset: () => void;
}

const DEFAULT_DATE_RANGE: DateRange = '30d';

export const useAnalyticsStore = create<AnalyticsUiState>()(
  devtools(
    (set) => ({
      selectedDateRange: DEFAULT_DATE_RANGE,
      focusedNoteId: null,

      setDateRange: (range) => set({ selectedDateRange: range }, false, 'analytics/setDateRange'),

      setFocusedNoteId: (noteId) =>
        set({ focusedNoteId: noteId }, false, 'analytics/setFocusedNoteId'),

      reset: () =>
        set(
          { selectedDateRange: DEFAULT_DATE_RANGE, focusedNoteId: null },
          false,
          'analytics/reset',
        ),
    }),
    { name: 'AnalyticsStore' },
  ),
);

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

/** Stale time: 5 minutes — analytics data is not real-time critical. */
const ANALYTICS_STALE_TIME_MS = 5 * 60 * 1000;

/** Cache key factory — ensures correct invalidation scope. */
export const analyticsKeys = {
  all: (workspaceId: string) => ['analytics', workspaceId] as const,
  summary: (workspaceId: string, dateRange: DateRange, noteId?: string) =>
    ['analytics', workspaceId, 'summary', dateRange, noteId ?? null] as const,
  daily: (workspaceId: string, dateRange: DateRange, noteId?: string) =>
    ['analytics', workspaceId, 'daily', dateRange, noteId ?? null] as const,
  topNotes: (workspaceId: string, dateRange: DateRange) =>
    ['analytics', workspaceId, 'top-notes', dateRange] as const,
};

/**
 * Fetch the full analytics summary for a workspace.
 *
 * Reads dateRange and focusedNoteId from the analytics store so the
 * component tree only needs to pass workspaceId.
 */
export function useAnalyticsSummary(workspaceId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedDateRange = useAnalyticsStore((s) => s.selectedDateRange);
  const focusedNoteId = useAnalyticsStore((s) => s.focusedNoteId);

  return useQuery<AnalyticsSummary>({
    queryKey: analyticsKeys.summary(workspaceId, selectedDateRange, focusedNoteId ?? undefined),
    queryFn: () =>
      analyticsApi.getSummary(accessToken ?? '', workspaceId, {
        dateRange: selectedDateRange,
        noteId: focusedNoteId ?? undefined,
      }),
    enabled: !!accessToken && !!workspaceId,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}

/**
 * Fetch daily stat data points for chart rendering.
 */
export function useAnalyticsDailyStats(workspaceId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedDateRange = useAnalyticsStore((s) => s.selectedDateRange);
  const focusedNoteId = useAnalyticsStore((s) => s.focusedNoteId);

  return useQuery<DailyStatPoint[]>({
    queryKey: analyticsKeys.daily(workspaceId, selectedDateRange, focusedNoteId ?? undefined),
    queryFn: () =>
      analyticsApi.getDailyStats(accessToken ?? '', workspaceId, {
        dateRange: selectedDateRange,
        noteId: focusedNoteId ?? undefined,
      }),
    enabled: !!accessToken && !!workspaceId,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}

/**
 * Fetch top notes ranking.
 */
export function useAnalyticsTopNotes(workspaceId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedDateRange = useAnalyticsStore((s) => s.selectedDateRange);

  return useQuery<TopNoteItem[]>({
    queryKey: analyticsKeys.topNotes(workspaceId, selectedDateRange),
    queryFn: () =>
      analyticsApi.getTopNotes(accessToken ?? '', workspaceId, {
        dateRange: selectedDateRange,
      }),
    enabled: !!accessToken && !!workspaceId,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}
