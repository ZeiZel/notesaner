/**
 * Tests for daily-notes-store.ts
 *
 * Covers:
 *   - Initial state values
 *   - Navigation actions (goTo*, prev*, next*)
 *   - Settings update
 *   - Derived selectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDailyNotesStore,
  DEFAULT_SETTINGS,
  selectIsToday,
  selectCurrentDateStr,
  selectTodayStr,
} from '../daily-notes-store';
import { formatDateYMD } from '../date-utils';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// Reset store between tests
beforeEach(() => {
  const store = useDailyNotesStore.getState();
  store.setCurrentDate(new Date());
  store.setToday(new Date());
  store.updateSettings({ ...DEFAULT_SETTINGS });
  store.setLoading(false);
  store.setError(null);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('useDailyNotesStore — initial state', () => {
  it('has default settings', () => {
    const { settings } = useDailyNotesStore.getState();
    expect(settings.autoCreate).toBe(false);
    expect(settings.nameFormat).toBe('YYYY-MM-DD');
    expect(settings.folder).toBe('Daily Notes');
    expect(settings.weeklyEnabled).toBe(false);
    expect(settings.monthlyEnabled).toBe(false);
  });

  it('isLoading defaults to false', () => {
    expect(useDailyNotesStore.getState().isLoading).toBe(false);
  });

  it('error defaults to null', () => {
    expect(useDailyNotesStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Settings update
// ---------------------------------------------------------------------------

describe('updateSettings', () => {
  it('merges partial updates', () => {
    useDailyNotesStore.getState().updateSettings({ autoCreate: true });
    expect(useDailyNotesStore.getState().settings.autoCreate).toBe(true);
    // Other settings should be unchanged
    expect(useDailyNotesStore.getState().settings.nameFormat).toBe('YYYY-MM-DD');
  });

  it('updates multiple settings at once', () => {
    useDailyNotesStore.getState().updateSettings({
      weeklyEnabled: true,
      monthlyEnabled: true,
      folder: 'Notes',
    });
    const { settings } = useDailyNotesStore.getState();
    expect(settings.weeklyEnabled).toBe(true);
    expect(settings.monthlyEnabled).toBe(true);
    expect(settings.folder).toBe('Notes');
  });
});

// ---------------------------------------------------------------------------
// setCurrentDate / setToday
// ---------------------------------------------------------------------------

describe('setCurrentDate', () => {
  it('updates the current date', () => {
    const target = d(2026, 3, 7);
    useDailyNotesStore.getState().setCurrentDate(target);
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-03-07');
  });
});

describe('setToday', () => {
  it('updates the today date', () => {
    const target = d(2026, 3, 7);
    useDailyNotesStore.getState().setToday(target);
    expect(formatDateYMD(useDailyNotesStore.getState().today)).toBe('2026-03-07');
  });
});

// ---------------------------------------------------------------------------
// Navigation actions
// ---------------------------------------------------------------------------

describe('goToToday', () => {
  it('resets currentDate to today', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2020, 1, 1));
    useDailyNotesStore.getState().goToToday();
    const todayStr = formatDateYMD(new Date());
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe(todayStr);
  });
});

describe('goToPrevDay / goToNextDay', () => {
  it('goToPrevDay moves back one day', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    useDailyNotesStore.getState().goToPrevDay();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-03-06');
  });

  it('goToNextDay moves forward one day', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    useDailyNotesStore.getState().goToNextDay();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-03-08');
  });

  it('goToPrevDay crosses month boundary', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 1));
    useDailyNotesStore.getState().goToPrevDay();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-02-28');
  });

  it('goToNextDay crosses year boundary', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 12, 31));
    useDailyNotesStore.getState().goToNextDay();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2027-01-01');
  });
});

describe('goToPrevWeek / goToNextWeek', () => {
  it('goToPrevWeek moves back 7 days', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 14));
    useDailyNotesStore.getState().goToPrevWeek();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-03-07');
  });

  it('goToNextWeek moves forward 7 days', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    useDailyNotesStore.getState().goToNextWeek();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-03-14');
  });
});

describe('goToPrevMonth / goToNextMonth', () => {
  it('goToPrevMonth moves back one month', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    useDailyNotesStore.getState().goToPrevMonth();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-02-07');
  });

  it('goToNextMonth moves forward one month', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    useDailyNotesStore.getState().goToNextMonth();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-04-07');
  });

  it('goToPrevMonth clamps to last day of shorter month', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 31));
    useDailyNotesStore.getState().goToPrevMonth();
    expect(formatDateYMD(useDailyNotesStore.getState().currentDate)).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// Loading / error state
// ---------------------------------------------------------------------------

describe('setLoading / setError', () => {
  it('setLoading updates isLoading', () => {
    useDailyNotesStore.getState().setLoading(true);
    expect(useDailyNotesStore.getState().isLoading).toBe(true);
    useDailyNotesStore.getState().setLoading(false);
    expect(useDailyNotesStore.getState().isLoading).toBe(false);
  });

  it('setError updates error string', () => {
    useDailyNotesStore.getState().setError('Something went wrong');
    expect(useDailyNotesStore.getState().error).toBe('Something went wrong');
  });

  it('setError with null clears the error', () => {
    useDailyNotesStore.getState().setError('oops');
    useDailyNotesStore.getState().setError(null);
    expect(useDailyNotesStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

describe('selectIsToday', () => {
  it('returns true when currentDate is today', () => {
    const state = useDailyNotesStore.getState();
    const today = new Date();
    state.setCurrentDate(today);
    state.setToday(today);
    expect(selectIsToday(useDailyNotesStore.getState())).toBe(true);
  });

  it('returns false when currentDate is not today', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2020, 1, 1));
    useDailyNotesStore.getState().setToday(new Date());
    expect(selectIsToday(useDailyNotesStore.getState())).toBe(false);
  });
});

describe('selectCurrentDateStr', () => {
  it('returns the current date as YYYY-MM-DD', () => {
    useDailyNotesStore.getState().setCurrentDate(d(2026, 3, 7));
    expect(selectCurrentDateStr(useDailyNotesStore.getState())).toBe('2026-03-07');
  });
});

describe('selectTodayStr', () => {
  it('returns today as YYYY-MM-DD', () => {
    useDailyNotesStore.getState().setToday(d(2026, 3, 7));
    expect(selectTodayStr(useDailyNotesStore.getState())).toBe('2026-03-07');
  });
});
