/**
 * calendar-store — Zustand store for Calendar plugin view state.
 *
 * Holds the active view mode, current date navigation, and note data.
 * Kept intentionally thin: business logic lives in calendar-utils.ts,
 * API calls are performed in CalendarView.tsx via TanStack Query or
 * direct plugin context calls.
 */

import { create } from 'zustand';
import { toDateString } from './calendar-utils';
import type { CalendarNote } from './calendar-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarViewMode = 'month' | 'week' | 'day' | 'timeline';

export interface CalendarState {
  // ------ view ------
  viewMode: CalendarViewMode;
  /** Currently focused date (used as the anchor for week/day/month views). */
  focusedDate: Date;

  // ------ data ------
  /** Notes loaded for the current visible range. */
  notes: CalendarNote[];
  /** Whether a data fetch is in progress. */
  isLoading: boolean;
  /** Last fetch error message, if any. */
  error: string | null;

  // ------ actions ------
  setViewMode: (mode: CalendarViewMode) => void;
  setFocusedDate: (date: Date) => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  navigateToday: () => void;
  setNotes: (notes: CalendarNote[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  viewMode: 'month',
  focusedDate: new Date(),
  notes: [],
  isLoading: false,
  error: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  setFocusedDate: (date) => set({ focusedDate: date }),

  navigatePrev: () => {
    const { viewMode, focusedDate } = get();
    switch (viewMode) {
      case 'month':
        set({ focusedDate: addMonths(focusedDate, -1) });
        break;
      case 'week':
        set({ focusedDate: addDays(focusedDate, -7) });
        break;
      case 'day':
        set({ focusedDate: addDays(focusedDate, -1) });
        break;
      case 'timeline':
        set({ focusedDate: addMonths(focusedDate, -1) });
        break;
    }
  },

  navigateNext: () => {
    const { viewMode, focusedDate } = get();
    switch (viewMode) {
      case 'month':
        set({ focusedDate: addMonths(focusedDate, 1) });
        break;
      case 'week':
        set({ focusedDate: addDays(focusedDate, 7) });
        break;
      case 'day':
        set({ focusedDate: addDays(focusedDate, 1) });
        break;
      case 'timeline':
        set({ focusedDate: addMonths(focusedDate, 1) });
        break;
    }
  },

  navigateToday: () => set({ focusedDate: new Date() }),

  setNotes: (notes) => set({ notes }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

// ---------------------------------------------------------------------------
// Derived selectors (called outside the store to avoid re-subscribing)
// ---------------------------------------------------------------------------

/**
 * Returns the visible date range [start, end] as YYYY-MM-DD strings for the
 * current view mode and focused date.
 */
export function getVisibleRange(
  viewMode: CalendarViewMode,
  focusedDate: Date,
): { start: string; end: string } {
  const year = focusedDate.getFullYear();
  const month = focusedDate.getMonth();

  switch (viewMode) {
    case 'month': {
      // Pad by one week on each side to include overflow grid cells
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
      const endDow = last.getDay() === 0 ? 0 : 7 - last.getDay();
      const start = new Date(first);
      start.setDate(start.getDate() - startDow);
      const end = new Date(last);
      end.setDate(end.getDate() + endDow);
      return { start: toDateString(start), end: toDateString(end) };
    }

    case 'week': {
      const dow = focusedDate.getDay() === 0 ? 6 : focusedDate.getDay() - 1;
      const monday = new Date(focusedDate);
      monday.setDate(focusedDate.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: toDateString(monday), end: toDateString(sunday) };
    }

    case 'day': {
      const ds = toDateString(focusedDate);
      return { start: ds, end: ds };
    }

    case 'timeline': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: toDateString(start), end: toDateString(end) };
    }
  }
}
