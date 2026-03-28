/**
 * daily-notes-store — Zustand store for Daily Notes plugin state.
 *
 * Holds UI state (current date, auto-create toggle), user settings (name
 * format, folder, template, periodic note options), and transient flags
 * (loading, error). Business logic lives in date-utils and periodic-notes.
 */

import { create } from 'zustand';
import { formatDateYMD } from './date-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyNotesSettings {
  /**
   * Whether to automatically open/create today's daily note on startup.
   * Default: false (opt-in to avoid surprising the user).
   */
  autoCreate: boolean;

  /**
   * Format string for daily note filenames.
   * Supports YYYY, MM, DD tokens. Default: "YYYY-MM-DD".
   */
  nameFormat: string;

  /**
   * Folder in which daily notes are created (relative to workspace root).
   * Empty string means the workspace root. Default: "Daily Notes".
   */
  folder: string;

  /**
   * Optional ID of a template note to use as the body of new daily notes.
   * When undefined, the plugin uses a built-in default template.
   */
  templateId?: string;

  /** Whether to enable weekly periodic notes. Default: false. */
  weeklyEnabled: boolean;

  /**
   * Format string for weekly note filenames. Default: "YYYY-[W]ww".
   */
  weeklyFormat: string;

  /**
   * Folder for weekly notes. Falls back to `folder` when not set.
   */
  weeklyFolder: string;

  /** Whether to enable monthly periodic notes. Default: false. */
  monthlyEnabled: boolean;

  /**
   * Format string for monthly note filenames. Default: "YYYY-MM".
   */
  monthlyFormat: string;

  /**
   * Folder for monthly notes. Falls back to `folder` when not set.
   */
  monthlyFolder: string;
}

export interface DailyNotesState {
  // ------ navigation ------

  /** The calendar date currently displayed / navigated to. */
  currentDate: Date;

  /** Today's date (set once on plugin load, refreshed at midnight). */
  today: Date;

  // ------ settings ------
  settings: DailyNotesSettings;

  // ------ transient flags ------

  /** True when the plugin is creating or fetching a note. */
  isLoading: boolean;

  /** Non-null when the last operation failed. */
  error: string | null;

  // ------ actions ------

  setCurrentDate: (date: Date) => void;
  setToday: (date: Date) => void;
  updateSettings: (partial: Partial<DailyNotesSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  goToToday: () => void;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
}

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: DailyNotesSettings = {
  autoCreate: false,
  nameFormat: 'YYYY-MM-DD',
  folder: 'Daily Notes',
  templateId: undefined,
  weeklyEnabled: false,
  weeklyFormat: 'YYYY-[W]ww',
  weeklyFolder: '',
  monthlyEnabled: false,
  monthlyFormat: 'YYYY-MM',
  monthlyFolder: '',
};

// ---------------------------------------------------------------------------
// Date navigation helpers (kept local to avoid a cross-module import cycle)
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDailyNotesStore = create<DailyNotesState>()((set) => ({
  // State
  currentDate: new Date(),
  today: new Date(),
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  error: null,

  // Actions
  setCurrentDate: (date) => set({ currentDate: date }),

  setToday: (date) => set({ today: date }),

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  goToToday: () => set({ currentDate: new Date() }),

  goToPrevDay: () => set((state) => ({ currentDate: addDays(state.currentDate, -1) })),

  goToNextDay: () => set((state) => ({ currentDate: addDays(state.currentDate, 1) })),

  goToPrevWeek: () => set((state) => ({ currentDate: addDays(state.currentDate, -7) })),

  goToNextWeek: () => set((state) => ({ currentDate: addDays(state.currentDate, 7) })),

  goToPrevMonth: () => set((state) => ({ currentDate: addMonths(state.currentDate, -1) })),

  goToNextMonth: () => set((state) => ({ currentDate: addMonths(state.currentDate, 1) })),
}));

// ---------------------------------------------------------------------------
// Selectors (derived values — call outside the store to avoid re-subscribing)
// ---------------------------------------------------------------------------

/** True when `currentDate` represents today. */
export function selectIsToday(state: DailyNotesState): boolean {
  return formatDateYMD(state.currentDate) === formatDateYMD(state.today);
}

/** Current date as a YYYY-MM-DD string. */
export function selectCurrentDateStr(state: DailyNotesState): string {
  return formatDateYMD(state.currentDate);
}

/** Today as a YYYY-MM-DD string. */
export function selectTodayStr(state: DailyNotesState): string {
  return formatDateYMD(state.today);
}
