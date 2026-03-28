/**
 * Tests for periodic-notes.ts
 *
 * Covers:
 *   - getWeeklyPeriod: period detection, label, dates, note name
 *   - getMonthlyPeriod: period detection, label, dates, note name
 *   - isWeeklyNoteForDate: path matching
 *   - isMonthlyNoteForDate: path matching
 *   - generateWeeklyNoteContent: structure validation
 *   - generateMonthlyNoteContent: structure validation
 *   - generateDailyNoteContent: structure validation
 *   - Edge cases: year/week boundaries, case-insensitive path matching
 */

import { describe, it, expect } from 'vitest';
import {
  getWeeklyPeriod,
  getMonthlyPeriod,
  isWeeklyNoteForDate,
  isMonthlyNoteForDate,
  generateWeeklyNoteContent,
  generateMonthlyNoteContent,
  generateDailyNoteContent,
} from '../periodic-notes';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// getWeeklyPeriod
// ---------------------------------------------------------------------------

describe('getWeeklyPeriod', () => {
  it('returns the correct period for a mid-week date', () => {
    // March 7 2026 (Saturday) is in ISO week 10
    const period = getWeeklyPeriod(d(2026, 3, 7));
    expect(period.type).toBe('weekly');
    expect(period.label).toBe('Week 10, 2026');
  });

  it('period start is the Monday of the week', () => {
    // Week of March 7 2026 starts on Monday March 2
    const period = getWeeklyPeriod(d(2026, 3, 7));
    expect(period.startDate).toBe('2026-03-02');
  });

  it('period end is the Sunday of the week', () => {
    const period = getWeeklyPeriod(d(2026, 3, 7));
    expect(period.endDate).toBe('2026-03-08');
  });

  it('generates the default note name YYYY-[W]ww', () => {
    const period = getWeeklyPeriod(d(2026, 3, 7));
    expect(period.note.name).toBe('2026-W10');
    expect(period.note.path).toBe('2026-W10.md');
  });

  it('applies folder to the note path', () => {
    const period = getWeeklyPeriod(d(2026, 3, 7), 'YYYY-[W]ww', 'Weekly Notes');
    expect(period.note.path).toBe('Weekly Notes/2026-W10.md');
  });

  it('handles ISO week year boundary (Dec 31 → week 1 of next year)', () => {
    const period = getWeeklyPeriod(d(2018, 12, 31));
    expect(period.label).toBe('Week 1, 2019');
    expect(period.note.name).toBe('2019-W01');
  });

  it('handles week 53 at year end', () => {
    const period = getWeeklyPeriod(d(2020, 12, 28));
    expect(period.label).toBe('Week 53, 2020');
    expect(period.note.name).toBe('2020-W53');
  });

  it('same week — different days of the week produce the same period', () => {
    const monday = getWeeklyPeriod(d(2026, 3, 2));
    const friday = getWeeklyPeriod(d(2026, 3, 6));
    expect(monday.label).toBe(friday.label);
    expect(monday.startDate).toBe(friday.startDate);
    expect(monday.note.name).toBe(friday.note.name);
  });

  it('spans year boundary when the week does', () => {
    // ISO week 1 of 2026 starts on Dec 29 2025
    const period = getWeeklyPeriod(d(2025, 12, 29));
    expect(period.startDate).toBe('2025-12-29');
    expect(period.endDate).toBe('2026-01-04');
  });
});

// ---------------------------------------------------------------------------
// getMonthlyPeriod
// ---------------------------------------------------------------------------

describe('getMonthlyPeriod', () => {
  it('returns the correct period for a mid-month date', () => {
    const period = getMonthlyPeriod(d(2026, 3, 15));
    expect(period.type).toBe('monthly');
    expect(period.label).toContain('March');
    expect(period.label).toContain('2026');
  });

  it('period start is the first of the month', () => {
    const period = getMonthlyPeriod(d(2026, 3, 15));
    expect(period.startDate).toBe('2026-03-01');
  });

  it('period end is the last of the month', () => {
    const period = getMonthlyPeriod(d(2026, 3, 15));
    expect(period.endDate).toBe('2026-03-31');
  });

  it('generates the default note name YYYY-MM', () => {
    const period = getMonthlyPeriod(d(2026, 3, 15));
    expect(period.note.name).toBe('2026-03');
    expect(period.note.path).toBe('2026-03.md');
  });

  it('applies folder to the note path', () => {
    const period = getMonthlyPeriod(d(2026, 3, 15), 'YYYY-MM', 'Monthly Notes');
    expect(period.note.path).toBe('Monthly Notes/2026-03.md');
  });

  it('handles February in a regular year', () => {
    const period = getMonthlyPeriod(d(2026, 2, 14));
    expect(period.endDate).toBe('2026-02-28');
  });

  it('handles February in a leap year', () => {
    const period = getMonthlyPeriod(d(2024, 2, 14));
    expect(period.endDate).toBe('2024-02-29');
  });

  it('handles December correctly', () => {
    const period = getMonthlyPeriod(d(2026, 12, 15));
    expect(period.startDate).toBe('2026-12-01');
    expect(period.endDate).toBe('2026-12-31');
    expect(period.note.name).toBe('2026-12');
  });

  it('same month — different days produce the same period', () => {
    const first = getMonthlyPeriod(d(2026, 3, 1));
    const last = getMonthlyPeriod(d(2026, 3, 31));
    expect(first.note.name).toBe(last.note.name);
    expect(first.startDate).toBe(last.startDate);
    expect(first.endDate).toBe(last.endDate);
  });
});

// ---------------------------------------------------------------------------
// isWeeklyNoteForDate
// ---------------------------------------------------------------------------

describe('isWeeklyNoteForDate', () => {
  it('returns true when path matches the generated weekly note path', () => {
    // March 7 2026 is in week 10 → default path: "2026-W10.md"
    expect(isWeeklyNoteForDate('2026-W10.md', d(2026, 3, 7))).toBe(true);
  });

  it('returns true without .md extension', () => {
    expect(isWeeklyNoteForDate('2026-W10', d(2026, 3, 7))).toBe(true);
  });

  it('returns true with folder prefix', () => {
    expect(
      isWeeklyNoteForDate('Weekly Notes/2026-W10.md', d(2026, 3, 7), 'YYYY-[W]ww', 'Weekly Notes'),
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isWeeklyNoteForDate('2026-w10.md', d(2026, 3, 7))).toBe(true);
  });

  it('returns false for a different week', () => {
    expect(isWeeklyNoteForDate('2026-W09.md', d(2026, 3, 7))).toBe(false);
  });

  it('returns false for a completely different path', () => {
    expect(isWeeklyNoteForDate('Daily Notes/2026-03-07.md', d(2026, 3, 7))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isMonthlyNoteForDate
// ---------------------------------------------------------------------------

describe('isMonthlyNoteForDate', () => {
  it('returns true when path matches the generated monthly note path', () => {
    expect(isMonthlyNoteForDate('2026-03.md', d(2026, 3, 15))).toBe(true);
  });

  it('returns true without .md extension', () => {
    expect(isMonthlyNoteForDate('2026-03', d(2026, 3, 15))).toBe(true);
  });

  it('returns true with folder prefix', () => {
    expect(
      isMonthlyNoteForDate('Monthly Notes/2026-03.md', d(2026, 3, 15), 'YYYY-MM', 'Monthly Notes'),
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isMonthlyNoteForDate('2026-03.MD', d(2026, 3, 15))).toBe(true);
  });

  it('returns false for a different month', () => {
    expect(isMonthlyNoteForDate('2026-02.md', d(2026, 3, 15))).toBe(false);
  });

  it('returns false for a different year', () => {
    expect(isMonthlyNoteForDate('2025-03.md', d(2026, 3, 15))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateWeeklyNoteContent
// ---------------------------------------------------------------------------

describe('generateWeeklyNoteContent', () => {
  const period = getWeeklyPeriod(d(2026, 3, 7));

  it('starts with YAML frontmatter', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content.startsWith('---\n')).toBe(true);
  });

  it('includes type: weekly in frontmatter', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content).toContain('type: weekly');
  });

  it('includes start date in frontmatter', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content).toContain(`start: ${period.startDate}`);
  });

  it('includes end date in frontmatter', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content).toContain(`end: ${period.endDate}`);
  });

  it('includes the period label as a heading', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content).toContain(`# ${period.label}`);
  });

  it('includes Goals and Reflection sections', () => {
    const content = generateWeeklyNoteContent(period);
    expect(content).toContain('## Goals');
    expect(content).toContain('## Reflection');
  });

  it('contains valid Markdown frontmatter delimiters', () => {
    const content = generateWeeklyNoteContent(period);
    const lines = content.split('\n');
    expect(lines[0]).toBe('---');
    const closingIndex = lines.indexOf('---', 1);
    expect(closingIndex).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateMonthlyNoteContent
// ---------------------------------------------------------------------------

describe('generateMonthlyNoteContent', () => {
  const period = getMonthlyPeriod(d(2026, 3, 15));

  it('starts with YAML frontmatter', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content.startsWith('---\n')).toBe(true);
  });

  it('includes type: monthly in frontmatter', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content).toContain('type: monthly');
  });

  it('includes the period label in frontmatter', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content).toContain(`month: ${period.label}`);
  });

  it('includes start and end dates', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content).toContain(`start: ${period.startDate}`);
    expect(content).toContain(`end: ${period.endDate}`);
  });

  it('includes the period label as heading', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content).toContain(`# ${period.label}`);
  });

  it('includes Goals, Highlights, and Reflection sections', () => {
    const content = generateMonthlyNoteContent(period);
    expect(content).toContain('## Goals');
    expect(content).toContain('## Highlights');
    expect(content).toContain('## Reflection');
  });
});

// ---------------------------------------------------------------------------
// generateDailyNoteContent
// ---------------------------------------------------------------------------

describe('generateDailyNoteContent', () => {
  const dateStr = '2026-03-07';

  it('starts with YAML frontmatter', () => {
    const content = generateDailyNoteContent(dateStr);
    expect(content.startsWith('---\n')).toBe(true);
  });

  it('includes type: daily in frontmatter', () => {
    const content = generateDailyNoteContent(dateStr);
    expect(content).toContain('type: daily');
  });

  it('includes the date in frontmatter', () => {
    const content = generateDailyNoteContent(dateStr);
    expect(content).toContain(`date: ${dateStr}`);
  });

  it('includes a level-1 heading with the formatted date', () => {
    const content = generateDailyNoteContent(dateStr);
    const lines = content.split('\n');
    const heading = lines.find((l) => l.startsWith('# '));
    expect(heading).toBeDefined();
    expect(heading!.length).toBeGreaterThan(2);
  });

  it('includes Tasks and Notes sections', () => {
    const content = generateDailyNoteContent(dateStr);
    expect(content).toContain('## Tasks');
    expect(content).toContain('## Notes');
  });

  it('includes a task checklist item', () => {
    const content = generateDailyNoteContent(dateStr);
    expect(content).toContain('- [ ]');
  });

  it('generates valid content for Dec 31 (year boundary)', () => {
    const content = generateDailyNoteContent('2026-12-31');
    expect(content).toContain('date: 2026-12-31');
    expect(content).toContain('type: daily');
  });

  it('generates valid content for Feb 29 (leap year)', () => {
    const content = generateDailyNoteContent('2024-02-29');
    expect(content).toContain('date: 2024-02-29');
  });
});
