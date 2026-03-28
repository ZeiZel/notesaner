/**
 * Tests for note-name-generator.ts
 *
 * Covers:
 *   - generateDailyNoteName: default format, custom formats, folder handling
 *   - generateWeeklyNoteName: default YYYY-[W]ww, bracket escaping, ISO year
 *   - generateMonthlyNoteName: default YYYY-MM, custom formats
 *   - validateDailyFormat: valid and invalid format strings
 *   - dailyNoteNameFromDateStr: date string parsing
 *   - todayNoteName: returns today with given format
 *   - Edge cases: year/week boundaries, path separators
 */

import { describe, it, expect } from 'vitest';
import {
  generateDailyNoteName,
  generateWeeklyNoteName,
  generateMonthlyNoteName,
  validateDailyFormat,
  dailyNoteNameFromDateStr,
  todayNoteName,
  toDateString,
} from '../note-name-generator';
import { formatDateYMD } from '../date-utils';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// generateDailyNoteName
// ---------------------------------------------------------------------------

describe('generateDailyNoteName', () => {
  it('generates the default YYYY-MM-DD filename', () => {
    const result = generateDailyNoteName(d(2026, 3, 7));
    expect(result.name).toBe('2026-03-07');
    expect(result.filename).toBe('2026-03-07.md');
    expect(result.title).toBe('2026-03-07');
    expect(result.path).toBe('2026-03-07.md');
  });

  it('uses a custom format string', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY/MM/DD');
    expect(result.name).toBe('2026/03/07');
    expect(result.filename).toBe('2026/03/07.md');
    expect(result.path).toBe('2026/03/07.md');
  });

  it('prepends folder when provided', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY-MM-DD', 'Daily Notes');
    expect(result.path).toBe('Daily Notes/2026-03-07.md');
  });

  it('strips trailing slash from folder', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY-MM-DD', 'Daily Notes/');
    expect(result.path).toBe('Daily Notes/2026-03-07.md');
  });

  it('sets title to last path segment when format includes slashes', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY/MM/DD');
    expect(result.title).toBe('07');
  });

  it('handles folder with trailing slash correctly', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY-MM-DD', 'Notes/Daily/');
    expect(result.path).toBe('Notes/Daily/2026-03-07.md');
  });

  it('zero-pads single-digit months and days', () => {
    const result = generateDailyNoteName(d(2026, 1, 5));
    expect(result.name).toBe('2026-01-05');
  });

  it('generates correct name for leap day', () => {
    const result = generateDailyNoteName(d(2024, 2, 29));
    expect(result.name).toBe('2024-02-29');
  });

  it('generates correct name for Dec 31', () => {
    const result = generateDailyNoteName(d(2026, 12, 31));
    expect(result.name).toBe('2026-12-31');
  });

  it('supports dot-separated format', () => {
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY.MM.DD');
    expect(result.name).toBe('2026.03.07');
  });

  it('supports abbreviated weekday in format', () => {
    // March 7 2026 is Saturday
    const result = generateDailyNoteName(d(2026, 3, 7), 'YYYY-MM-DD ddd');
    expect(result.name).toContain('2026-03-07');
    expect(result.name).toContain('Sat');
  });
});

// ---------------------------------------------------------------------------
// generateWeeklyNoteName
// ---------------------------------------------------------------------------

describe('generateWeeklyNoteName', () => {
  it('generates the default YYYY-[W]ww format', () => {
    // March 7 2026 is in ISO week 10
    const result = generateWeeklyNoteName(d(2026, 3, 7));
    expect(result.name).toBe('2026-W10');
    expect(result.filename).toBe('2026-W10.md');
    expect(result.path).toBe('2026-W10.md');
  });

  it('zero-pads single-digit week numbers', () => {
    // Jan 10 2026 is in ISO week 2
    const result = generateWeeklyNoteName(d(2026, 1, 10));
    expect(result.name).toBe('2026-W02');
  });

  it('respects folder setting', () => {
    const result = generateWeeklyNoteName(d(2026, 3, 7), 'YYYY-[W]ww', 'Weekly Notes');
    expect(result.path).toBe('Weekly Notes/2026-W10.md');
  });

  it('handles ISO year boundary — week 1 of next year', () => {
    // Dec 31 2018 belongs to ISO week 1 of 2019
    const result = generateWeeklyNoteName(d(2018, 12, 31));
    expect(result.name).toBe('2019-W01');
  });

  it('handles ISO year boundary — week 53 of current year', () => {
    // Dec 28 2020 belongs to ISO week 53 of 2020
    const result = generateWeeklyNoteName(d(2020, 12, 28));
    expect(result.name).toBe('2020-W53');
  });

  it('supports a custom format without the W literal', () => {
    const result = generateWeeklyNoteName(d(2026, 3, 7), 'YYYY-ww');
    expect(result.name).toBe('2026-10');
  });

  it('preserves bracket-escaped literals other than W', () => {
    const result = generateWeeklyNoteName(d(2026, 3, 7), 'YYYY-[Week]-ww');
    expect(result.name).toBe('2026-Week-10');
  });

  it('handles week 1 in standard year', () => {
    // Jan 5 2026 is in ISO week 2 of 2026; Jan 2 is week 1
    const result = generateWeeklyNoteName(d(2026, 1, 2));
    expect(result.name).toBe('2026-W01');
  });
});

// ---------------------------------------------------------------------------
// generateMonthlyNoteName
// ---------------------------------------------------------------------------

describe('generateMonthlyNoteName', () => {
  it('generates the default YYYY-MM format', () => {
    const result = generateMonthlyNoteName(d(2026, 3, 15));
    expect(result.name).toBe('2026-03');
    expect(result.filename).toBe('2026-03.md');
    expect(result.path).toBe('2026-03.md');
  });

  it('zero-pads single-digit month', () => {
    const result = generateMonthlyNoteName(d(2026, 1, 15));
    expect(result.name).toBe('2026-01');
  });

  it('respects folder setting', () => {
    const result = generateMonthlyNoteName(d(2026, 3, 15), 'YYYY-MM', 'Monthly Notes');
    expect(result.path).toBe('Monthly Notes/2026-03.md');
  });

  it('supports a custom format', () => {
    const result = generateMonthlyNoteName(d(2026, 3, 15), 'YYYY/MM');
    expect(result.name).toBe('2026/03');
  });

  it('generates the same name regardless of which day of the month', () => {
    const result1 = generateMonthlyNoteName(d(2026, 3, 1));
    const result2 = generateMonthlyNoteName(d(2026, 3, 31));
    expect(result1.name).toBe(result2.name);
  });
});

// ---------------------------------------------------------------------------
// validateDailyFormat
// ---------------------------------------------------------------------------

describe('validateDailyFormat', () => {
  it('returns null for the default YYYY-MM-DD format', () => {
    expect(validateDailyFormat('YYYY-MM-DD')).toBeNull();
  });

  it('returns null for YYYY/MM/DD', () => {
    expect(validateDailyFormat('YYYY/MM/DD')).toBeNull();
  });

  it('returns null for a format with just year and day', () => {
    expect(validateDailyFormat('YYYY-DD')).toBeNull();
  });

  it('returns an error for an empty string', () => {
    expect(validateDailyFormat('')).not.toBeNull();
  });

  it('returns an error when no year token is present', () => {
    expect(validateDailyFormat('MM-DD')).not.toBeNull();
  });

  it('returns an error when only year is present (no day or week)', () => {
    expect(validateDailyFormat('YYYY')).not.toBeNull();
  });

  it('returns null for a format with YYYY and ww', () => {
    expect(validateDailyFormat('YYYY-[W]ww')).toBeNull();
  });

  it('returns null for a format with YY and DD', () => {
    expect(validateDailyFormat('YY-MM-DD')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dailyNoteNameFromDateStr
// ---------------------------------------------------------------------------

describe('dailyNoteNameFromDateStr', () => {
  it('returns a result for a valid YYYY-MM-DD string', () => {
    const result = dailyNoteNameFromDateStr('2026-03-07');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('2026-03-07');
  });

  it('applies a custom format', () => {
    const result = dailyNoteNameFromDateStr('2026-03-07', 'YYYY/MM/DD', 'Daily');
    expect(result).not.toBeNull();
    expect(result!.path).toBe('Daily/2026/03/07.md');
  });

  it('returns null for an invalid date string', () => {
    expect(dailyNoteNameFromDateStr('not-a-date')).toBeNull();
    expect(dailyNoteNameFromDateStr('')).toBeNull();
    expect(dailyNoteNameFromDateStr('2026/03/07')).toBeNull();
  });

  it('returns null for too few parts', () => {
    expect(dailyNoteNameFromDateStr('2026-03')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// todayNoteName
// ---------------------------------------------------------------------------

describe('todayNoteName', () => {
  it('returns a note name for today', () => {
    const today = formatDateYMD(new Date());
    const result = todayNoteName();
    expect(result.name).toBe(today);
  });

  it('applies custom format and folder', () => {
    const result = todayNoteName('YYYY-MM-DD', 'Daily');
    expect(result.path.startsWith('Daily/')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toDateString (re-export of formatDateYMD)
// ---------------------------------------------------------------------------

describe('toDateString', () => {
  it('is a re-export of formatDateYMD', () => {
    const date = d(2026, 3, 7);
    expect(toDateString(date)).toBe('2026-03-07');
  });
});
