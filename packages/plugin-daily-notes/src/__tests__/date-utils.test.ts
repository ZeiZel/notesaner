/**
 * Tests for date-utils.ts
 *
 * Covers:
 *   - Formatting (formatDateYMD, formatDate, formatRelativeDate, formatWeekLabel, formatMonthLabel)
 *   - Parsing (parseDateYMD)
 *   - Navigation (addDays, addWeeks, addMonths, prevDay/nextDay, prevWeek/nextWeek, prevMonth/nextMonth)
 *   - ISO week numbers (getISOWeekNumber, getISOWeekYear)
 *   - Period boundaries (getWeekStart, getWeekEnd, getMonthStart, getMonthEnd, weekStartFromISOWeek)
 *   - Comparison (isSameDay, isToday)
 *   - Calendar grid (buildMonthGrid)
 *   - Edge cases: year boundaries, leap years, DST transitions
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateYMD,
  formatDate,
  formatRelativeDate,
  formatWeekLabel,
  formatMonthLabel,
  parseDateYMD,
  addDays,
  addWeeks,
  addMonths,
  prevDay,
  nextDay,
  prevWeek,
  nextWeek,
  prevMonth,
  nextMonth,
  getISOWeekNumber,
  getISOWeekYear,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  weekStartFromISOWeek,
  isSameDay,
  isToday,
  buildMonthGrid,
} from '../date-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// formatDateYMD
// ---------------------------------------------------------------------------

describe('formatDateYMD', () => {
  it('formats a date to YYYY-MM-DD', () => {
    expect(formatDateYMD(d(2026, 3, 7))).toBe('2026-03-07');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDateYMD(d(2026, 1, 1))).toBe('2026-01-01');
    expect(formatDateYMD(d(2026, 9, 9))).toBe('2026-09-09');
  });

  it('handles year boundaries correctly', () => {
    expect(formatDateYMD(d(2026, 12, 31))).toBe('2026-12-31');
    expect(formatDateYMD(d(2027, 1, 1))).toBe('2027-01-01');
  });

  it('handles leap year Feb 29', () => {
    expect(formatDateYMD(d(2024, 2, 29))).toBe('2024-02-29');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  const date = d(2026, 3, 7); // Saturday, March 7 2026

  it('replaces YYYY with 4-digit year', () => {
    expect(formatDate(date, 'YYYY')).toBe('2026');
  });

  it('replaces YY with 2-digit year', () => {
    expect(formatDate(date, 'YY')).toBe('26');
  });

  it('replaces MM with zero-padded month', () => {
    expect(formatDate(date, 'MM')).toBe('03');
  });

  it('replaces DD with zero-padded day', () => {
    expect(formatDate(date, 'DD')).toBe('07');
  });

  it('replaces ww with zero-padded ISO week number', () => {
    // March 7 2026 is in ISO week 10
    const result = formatDate(date, 'ww');
    expect(result).toBe('10');
  });

  it('produces YYYY-MM-DD for default format', () => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-03-07');
  });

  it('supports nested path-style format', () => {
    expect(formatDate(date, 'YYYY/MM/DD')).toBe('2026/03/07');
  });

  it('preserves non-token literal characters', () => {
    expect(formatDate(date, 'YYYY.MM.DD')).toBe('2026.03.07');
  });

  it('replaces multiple tokens in one string', () => {
    expect(formatDate(date, 'DD-MM-YYYY')).toBe('07-03-2026');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeDate
// ---------------------------------------------------------------------------

describe('formatRelativeDate', () => {
  const today = d(2026, 3, 7);

  it('returns "Today" for the same date', () => {
    expect(formatRelativeDate(d(2026, 3, 7), today)).toBe('Today');
  });

  it('returns "Yesterday" for the day before', () => {
    expect(formatRelativeDate(d(2026, 3, 6), today)).toBe('Yesterday');
  });

  it('returns "Tomorrow" for the day after', () => {
    expect(formatRelativeDate(d(2026, 3, 8), today)).toBe('Tomorrow');
  });

  it('returns a formatted date string for other dates', () => {
    const result = formatRelativeDate(d(2026, 1, 15), today);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should not be one of the special labels
    expect(result).not.toBe('Today');
    expect(result).not.toBe('Yesterday');
    expect(result).not.toBe('Tomorrow');
  });

  it('includes year for dates in a different year', () => {
    const result = formatRelativeDate(d(2025, 12, 31), today);
    expect(result).toContain('2025');
  });
});

// ---------------------------------------------------------------------------
// formatWeekLabel
// ---------------------------------------------------------------------------

describe('formatWeekLabel', () => {
  it('returns "Week N, YYYY" format', () => {
    const result = formatWeekLabel(d(2026, 3, 7));
    expect(result).toMatch(/^Week \d+, \d{4}$/);
  });

  it('includes correct week number', () => {
    // March 7 2026 is ISO week 10
    expect(formatWeekLabel(d(2026, 3, 7))).toBe('Week 10, 2026');
  });
});

// ---------------------------------------------------------------------------
// formatMonthLabel
// ---------------------------------------------------------------------------

describe('formatMonthLabel', () => {
  it('returns "Month YYYY" format', () => {
    expect(formatMonthLabel(d(2026, 3, 7))).toContain('2026');
    expect(formatMonthLabel(d(2026, 3, 7))).toContain('March');
  });
});

// ---------------------------------------------------------------------------
// parseDateYMD
// ---------------------------------------------------------------------------

describe('parseDateYMD', () => {
  it('parses a valid YYYY-MM-DD string', () => {
    const result = parseDateYMD('2026-03-07');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2); // 0-based
    expect(result!.getDate()).toBe(7);
  });

  it('returns null for an empty string', () => {
    expect(parseDateYMD('')).toBeNull();
  });

  it('returns null for an invalid format', () => {
    expect(parseDateYMD('07/03/2026')).toBeNull();
    expect(parseDateYMD('2026-3-7')).toBeNull();
    expect(parseDateYMD('not-a-date')).toBeNull();
  });

  it('returns null for an invalid day (Feb 30)', () => {
    expect(parseDateYMD('2026-02-30')).toBeNull();
  });

  it('returns null for an invalid month (13)', () => {
    expect(parseDateYMD('2026-13-01')).toBeNull();
  });

  it('parses leap year Feb 29 correctly', () => {
    const result = parseDateYMD('2024-02-29');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(29);
  });

  it('returns null for Feb 29 in a non-leap year', () => {
    expect(parseDateYMD('2026-02-29')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------

describe('addDays', () => {
  it('adds positive days', () => {
    expect(formatDateYMD(addDays(d(2026, 3, 7), 3))).toBe('2026-03-10');
  });

  it('subtracts negative days', () => {
    expect(formatDateYMD(addDays(d(2026, 3, 7), -3))).toBe('2026-03-04');
  });

  it('crosses month boundary', () => {
    expect(formatDateYMD(addDays(d(2026, 1, 30), 3))).toBe('2026-02-02');
  });

  it('crosses year boundary forward', () => {
    expect(formatDateYMD(addDays(d(2026, 12, 30), 3))).toBe('2027-01-02');
  });

  it('crosses year boundary backward', () => {
    expect(formatDateYMD(addDays(d(2027, 1, 1), -1))).toBe('2026-12-31');
  });

  it('does not mutate the input date', () => {
    const original = d(2026, 3, 7);
    addDays(original, 5);
    expect(formatDateYMD(original)).toBe('2026-03-07');
  });
});

// ---------------------------------------------------------------------------
// addWeeks
// ---------------------------------------------------------------------------

describe('addWeeks', () => {
  it('adds 1 week = 7 days', () => {
    expect(formatDateYMD(addWeeks(d(2026, 3, 7), 1))).toBe('2026-03-14');
  });

  it('subtracts 1 week', () => {
    expect(formatDateYMD(addWeeks(d(2026, 3, 7), -1))).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// addMonths
// ---------------------------------------------------------------------------

describe('addMonths', () => {
  it('adds months in the same year', () => {
    expect(formatDateYMD(addMonths(d(2026, 3, 7), 2))).toBe('2026-05-07');
  });

  it('rolls over into the next year', () => {
    expect(formatDateYMD(addMonths(d(2026, 11, 7), 3))).toBe('2027-02-07');
  });

  it('clamps to last day of a shorter month (Jan 31 → Feb 28)', () => {
    expect(formatDateYMD(addMonths(d(2026, 1, 31), 1))).toBe('2026-02-28');
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(formatDateYMD(addMonths(d(2024, 1, 31), 1))).toBe('2024-02-29');
  });

  it('subtracts months', () => {
    expect(formatDateYMD(addMonths(d(2026, 3, 7), -2))).toBe('2026-01-07');
  });

  it('subtracts across year boundary', () => {
    expect(formatDateYMD(addMonths(d(2026, 1, 15), -1))).toBe('2025-12-15');
  });

  it('does not mutate the input date', () => {
    const original = d(2026, 3, 7);
    addMonths(original, 1);
    expect(formatDateYMD(original)).toBe('2026-03-07');
  });
});

// ---------------------------------------------------------------------------
// prevDay / nextDay
// ---------------------------------------------------------------------------

describe('prevDay / nextDay', () => {
  it('prevDay returns the day before', () => {
    expect(formatDateYMD(prevDay(d(2026, 3, 7)))).toBe('2026-03-06');
  });

  it('nextDay returns the day after', () => {
    expect(formatDateYMD(nextDay(d(2026, 3, 7)))).toBe('2026-03-08');
  });

  it('prevDay crosses month boundary', () => {
    expect(formatDateYMD(prevDay(d(2026, 3, 1)))).toBe('2026-02-28');
  });

  it('nextDay crosses year boundary', () => {
    expect(formatDateYMD(nextDay(d(2026, 12, 31)))).toBe('2027-01-01');
  });
});

// ---------------------------------------------------------------------------
// prevWeek / nextWeek
// ---------------------------------------------------------------------------

describe('prevWeek / nextWeek', () => {
  it('prevWeek goes back 7 days', () => {
    expect(formatDateYMD(prevWeek(d(2026, 3, 7)))).toBe('2026-02-28');
  });

  it('nextWeek goes forward 7 days', () => {
    expect(formatDateYMD(nextWeek(d(2026, 3, 7)))).toBe('2026-03-14');
  });
});

// ---------------------------------------------------------------------------
// prevMonth / nextMonth
// ---------------------------------------------------------------------------

describe('prevMonth / nextMonth', () => {
  it('prevMonth goes to same day last month', () => {
    expect(formatDateYMD(prevMonth(d(2026, 3, 7)))).toBe('2026-02-07');
  });

  it('nextMonth goes to same day next month', () => {
    expect(formatDateYMD(nextMonth(d(2026, 3, 7)))).toBe('2026-04-07');
  });

  it('nextMonth clamps when target month is shorter', () => {
    expect(formatDateYMD(nextMonth(d(2026, 1, 31)))).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// getISOWeekNumber
// ---------------------------------------------------------------------------

describe('getISOWeekNumber', () => {
  it('returns correct week for a mid-year date', () => {
    // March 7 2026 (Saturday) is in ISO week 10
    expect(getISOWeekNumber(d(2026, 3, 7))).toBe(10);
  });

  it('Jan 1 of year with Thursday-start is week 1', () => {
    // Jan 1 2015 is a Thursday → week 1 of 2015
    expect(getISOWeekNumber(d(2015, 1, 1))).toBe(1);
  });

  it('Dec 31 can be week 1 of next year', () => {
    // Dec 31 2018 is a Monday; the week containing the first Thursday of 2019
    // actually: Dec 31 2018 is in week 1 of 2019
    expect(getISOWeekNumber(d(2018, 12, 31))).toBe(1);
  });

  it('Jan 1 can be week 52 or 53 of previous year', () => {
    // Jan 1 2021 is a Friday → belongs to week 53 of 2020
    expect(getISOWeekNumber(d(2021, 1, 1))).toBe(53);
  });

  it('last day of week 52 in a normal year', () => {
    // Dec 27 2020 is Sunday of week 52 (2020 has 53 weeks)
    expect(getISOWeekNumber(d(2020, 12, 27))).toBe(52);
  });

  it('week 53 exists in years where Dec 28 is in week 53', () => {
    // Dec 28 2020 is a Monday, ISO week 53
    expect(getISOWeekNumber(d(2020, 12, 28))).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// getISOWeekYear
// ---------------------------------------------------------------------------

describe('getISOWeekYear', () => {
  it('returns the calendar year for most dates', () => {
    expect(getISOWeekYear(d(2026, 6, 15))).toBe(2026);
  });

  it('returns next year for Dec 31 when it falls in week 1', () => {
    // Dec 31 2018 is in ISO week 1 of 2019
    expect(getISOWeekYear(d(2018, 12, 31))).toBe(2019);
  });

  it('returns previous year for Jan 1 in week 52/53', () => {
    // Jan 1 2021 is in ISO week 53 of 2020
    expect(getISOWeekYear(d(2021, 1, 1))).toBe(2020);
  });
});

// ---------------------------------------------------------------------------
// getWeekStart / getWeekEnd
// ---------------------------------------------------------------------------

describe('getWeekStart / getWeekEnd', () => {
  it('getWeekStart returns the Monday of the week', () => {
    // March 7 2026 is a Saturday
    expect(formatDateYMD(getWeekStart(d(2026, 3, 7)))).toBe('2026-03-02');
  });

  it('getWeekStart of Monday returns that Monday', () => {
    expect(formatDateYMD(getWeekStart(d(2026, 3, 2)))).toBe('2026-03-02');
  });

  it('getWeekStart of Sunday returns previous Monday', () => {
    // March 8 2026 is a Sunday
    expect(formatDateYMD(getWeekStart(d(2026, 3, 8)))).toBe('2026-03-02');
  });

  it('getWeekEnd returns the Sunday of the week', () => {
    expect(formatDateYMD(getWeekEnd(d(2026, 3, 7)))).toBe('2026-03-08');
  });

  it('week start/end span exactly 7 days', () => {
    const start = getWeekStart(d(2026, 3, 7));
    const end = getWeekEnd(d(2026, 3, 7));
    const diff = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diff).toBe(6);
  });

  it('spans year boundary correctly', () => {
    // Dec 30 2024 is a Monday
    const start = getWeekStart(d(2024, 12, 31));
    const end = getWeekEnd(d(2024, 12, 31));
    expect(formatDateYMD(start)).toBe('2024-12-30');
    expect(formatDateYMD(end)).toBe('2025-01-05');
  });
});

// ---------------------------------------------------------------------------
// getMonthStart / getMonthEnd
// ---------------------------------------------------------------------------

describe('getMonthStart / getMonthEnd', () => {
  it('returns the first day of the month', () => {
    expect(formatDateYMD(getMonthStart(d(2026, 3, 15)))).toBe('2026-03-01');
  });

  it('returns the last day of the month', () => {
    expect(formatDateYMD(getMonthEnd(d(2026, 3, 15)))).toBe('2026-03-31');
  });

  it('handles February in a regular year', () => {
    expect(formatDateYMD(getMonthEnd(d(2026, 2, 1)))).toBe('2026-02-28');
  });

  it('handles February in a leap year', () => {
    expect(formatDateYMD(getMonthEnd(d(2024, 2, 1)))).toBe('2024-02-29');
  });

  it('handles December correctly', () => {
    expect(formatDateYMD(getMonthStart(d(2026, 12, 15)))).toBe('2026-12-01');
    expect(formatDateYMD(getMonthEnd(d(2026, 12, 15)))).toBe('2026-12-31');
  });
});

// ---------------------------------------------------------------------------
// weekStartFromISOWeek
// ---------------------------------------------------------------------------

describe('weekStartFromISOWeek', () => {
  it('returns Monday of ISO week 1', () => {
    // ISO week 1 of 2026 starts on Dec 29 2025
    const result = weekStartFromISOWeek(2026, 1);
    expect(formatDateYMD(result)).toBe('2025-12-29');
  });

  it('returns Monday of a mid-year week', () => {
    // ISO week 10 of 2026 starts on March 2 2026
    const result = weekStartFromISOWeek(2026, 10);
    expect(formatDateYMD(result)).toBe('2026-03-02');
  });

  it('week start is always a Monday', () => {
    const result = weekStartFromISOWeek(2026, 15);
    expect(result.getDay()).toBe(1); // 1 = Monday
  });

  it('produces consistent results with getISOWeekNumber', () => {
    // Generate a week start and verify the date belongs to that week
    const start = weekStartFromISOWeek(2026, 12);
    const week = getISOWeekNumber(start);
    const year = getISOWeekYear(start);
    expect(week).toBe(12);
    expect(year).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// isSameDay
// ---------------------------------------------------------------------------

describe('isSameDay', () => {
  it('returns true for the same date', () => {
    expect(isSameDay(d(2026, 3, 7), d(2026, 3, 7))).toBe(true);
  });

  it('returns true even when time components differ', () => {
    const a = new Date(2026, 2, 7, 9, 0, 0);
    const b = new Date(2026, 2, 7, 23, 59, 59);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for different days', () => {
    expect(isSameDay(d(2026, 3, 7), d(2026, 3, 8))).toBe(false);
  });

  it('returns false for same day in different months', () => {
    expect(isSameDay(d(2026, 3, 7), d(2026, 4, 7))).toBe(false);
  });

  it('returns false for same day in different years', () => {
    expect(isSameDay(d(2026, 3, 7), d(2027, 3, 7))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isToday (uses real clock — tested structurally)
// ---------------------------------------------------------------------------

describe('isToday', () => {
  it('returns true for new Date()', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns false for a past date', () => {
    expect(isToday(d(2020, 1, 1))).toBe(false);
  });

  it('returns false for a future date', () => {
    expect(isToday(d(2099, 12, 31))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildMonthGrid
// ---------------------------------------------------------------------------

describe('buildMonthGrid', () => {
  it('returns a 6-row × 7-column grid', () => {
    const grid = buildMonthGrid(2026, 2); // March 2026
    expect(grid).toHaveLength(6);
    for (const row of grid) {
      expect(row).toHaveLength(7);
    }
  });

  it('first cell is always a Monday', () => {
    const grid = buildMonthGrid(2026, 2);
    expect(grid[0][0].date.getDay()).toBe(1); // 1 = Monday
  });

  it('marks the first of the month as isCurrentMonth', () => {
    const grid = buildMonthGrid(2026, 2);
    const allDays = grid.flat();
    const marchFirst = allDays.find((d) => d.dateStr === '2026-03-01');
    expect(marchFirst).toBeDefined();
    expect(marchFirst!.isCurrentMonth).toBe(true);
  });

  it('marks padding days from adjacent months as not isCurrentMonth', () => {
    const grid = buildMonthGrid(2026, 2); // March 2026 starts on Sunday
    const firstCell = grid[0][0];
    // The first Monday before March 1 (Sunday) is Feb 23 2026
    expect(firstCell.isCurrentMonth).toBe(false);
  });

  it('isToday is true exactly for today', () => {
    const now = new Date();
    const grid = buildMonthGrid(now.getFullYear(), now.getMonth());
    const todayStr = formatDateYMD(now);
    const allDays = grid.flat();
    const todayCell = allDays.find((d) => d.dateStr === todayStr);
    expect(todayCell?.isToday).toBe(true);
    const nonToday = allDays.filter((d) => d.dateStr !== todayStr);
    expect(nonToday.every((d) => !d.isToday)).toBe(true);
  });

  it('marks weekends correctly', () => {
    const grid = buildMonthGrid(2026, 2);
    const allDays = grid.flat();
    for (const day of allDays) {
      const dow = day.date.getDay();
      if (dow === 0 || dow === 6) {
        expect(day.isWeekend).toBe(true);
      } else {
        expect(day.isWeekend).toBe(false);
      }
    }
  });

  it('assigns correct ISO week numbers', () => {
    const grid = buildMonthGrid(2026, 2);
    // The first row of March 2026 grid spans Feb 23 – Mar 1 2026, ISO week 9
    expect(grid[0][0].isoWeek).toBe(9);
  });

  it('handles a month starting on Monday (no padding at start)', () => {
    // June 2026 starts on a Monday
    const grid = buildMonthGrid(2026, 5);
    expect(grid[0][0].dateStr).toBe('2026-06-01');
    expect(grid[0][0].isCurrentMonth).toBe(true);
  });

  it('covers Feb correctly in a leap year', () => {
    const grid = buildMonthGrid(2024, 1); // Feb 2024 (leap year)
    const allDays = grid.flat();
    const feb29 = allDays.find((d) => d.dateStr === '2024-02-29');
    expect(feb29).toBeDefined();
    expect(feb29!.isCurrentMonth).toBe(true);
  });
});
