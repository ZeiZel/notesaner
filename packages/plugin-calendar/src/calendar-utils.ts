/**
 * calendar-utils — date helpers, week number calculation, and recurring note logic.
 *
 * All functions are pure and side-effect-free; they are safe to call during
 * React render without useEffect.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /**
   * For weekly: 0 (Sun) – 6 (Sat) specifying which day(s) the note recurs.
   * For monthly: 1-31 specifying the day-of-month.
   * For daily: not used.
   */
  dayOfWeek?: number;
  dayOfMonth?: number;
}

/** A note with resolved calendar date and optional recurrence. */
export interface CalendarNote {
  id: string;
  title: string;
  path: string;
  /** ISO date string (YYYY-MM-DD) extracted from frontmatter `date` field. */
  date: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Parsed recurrence rule from frontmatter, if present. */
  recurrence?: RecurrenceRule;
  /** True when this entry is a virtual occurrence generated from a rule. */
  isRecurringInstance?: boolean;
}

// ---------------------------------------------------------------------------
// ISO week number (ISO 8601 — week 1 contains the first Thursday)
// ---------------------------------------------------------------------------

/**
 * Returns the ISO 8601 week number for the given date.
 *
 * Algorithm: shift the day so Monday is 0, find the Thursday in the week,
 * then compute which week of the year that Thursday falls in.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Day of week: ISO Monday = 1, Sunday = 7
  const dayOfWeek = d.getUTCDay() || 7;
  // Move to nearest Thursday: Mon→+3, Tue→+2, Wed→+1, Thu→+0, Fri→-1, Sat→-2, Sun→-3
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Returns the ISO week year for a date (the year to which the ISO week belongs).
 * Can differ from the calendar year near the year boundary.
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  return d.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Calendar grid construction
// ---------------------------------------------------------------------------

export interface CalendarDay {
  /** ISO YYYY-MM-DD string */
  dateStr: string;
  date: Date;
  /** Day of month (1-31). */
  dayOfMonth: number;
  /** True when this day is in the displayed month (not a padding day). */
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

/**
 * Build a 6-row × 7-col grid of CalendarDay objects for the given year/month.
 * The grid always starts on Monday (ISO week convention).
 *
 * @param year  Full year, e.g. 2026
 * @param month Zero-based month index (0 = Jan, 11 = Dec)
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstOfMonth = new Date(year, month, 1);
  const todayStr = toDateString(new Date());

  // ISO: Monday is 1, Sunday is 0. Shift so grid starts Monday.
  const firstDow = firstOfMonth.getDay(); // 0 Sun … 6 Sat
  const offsetFromMonday = firstDow === 0 ? 6 : firstDow - 1; // Mon=0 … Sun=6

  // Start from the Monday that begins the first visible week
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - offsetFromMonday);

  const rows: CalendarDay[][] = [];

  for (let row = 0; row < 6; row++) {
    const week: CalendarDay[] = [];
    for (let col = 0; col < 7; col++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + row * 7 + col);
      const dateStr = toDateString(d);
      week.push({
        dateStr,
        date: d,
        dayOfMonth: d.getDate(),
        isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
        isToday: dateStr === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    rows.push(week);
  }

  return rows;
}

/**
 * Build an array of 7 CalendarDay objects for the week that contains `date`.
 * The week always starts on Monday.
 */
export function buildWeekDays(date: Date): CalendarDay[] {
  const todayStr = toDateString(new Date());
  const dow = date.getDay();
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - offsetFromMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toDateString(d);
    return {
      dateStr,
      date: d,
      dayOfMonth: d.getDate(),
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });
}

// ---------------------------------------------------------------------------
// Date string helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date to YYYY-MM-DD using local time (not UTC).
 * Avoids timezone offset issues when only the date portion matters.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD date string into a local Date at midnight.
 * Returns `null` if the input is not a valid date string.
 */
export function parseDateString(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Format a Date as "YYYY-MM-DD" for use as a daily note filename. */
export function toDailyNoteFilename(date: Date): string {
  return `${toDateString(date)}.md`;
}

/** Format a Date as "YYYY-MM-DD" for use as a daily note title. */
export function toDailyNoteTitle(date: Date): string {
  return toDateString(date);
}

/**
 * Return a human-readable month label, e.g. "March 2026".
 */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Return a short day-of-week label, e.g. "Mon", starting from Monday.
 */
export function weekdayLabels(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

// ---------------------------------------------------------------------------
// Frontmatter date extraction
// ---------------------------------------------------------------------------

/**
 * Extract an ISO date string from a note's frontmatter.
 *
 * Checks `date`, `scheduled`, and `due` fields in that order.
 * Normalises Date objects and various string formats to YYYY-MM-DD.
 * Returns `null` when no valid date is found.
 */
export function extractDateFromFrontmatter(frontmatter: Record<string, unknown>): string | null {
  const candidates = [frontmatter['date'], frontmatter['scheduled'], frontmatter['due']];

  for (const value of candidates) {
    if (!value) continue;

    if (value instanceof Date) {
      return toDateString(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Already in YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      // ISO 8601 with time: 2026-03-27T10:00:00
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
    }

    if (typeof value === 'number') {
      // Unix timestamp (seconds)
      const d = new Date(value * 1000);
      if (!isNaN(d.getTime())) return toDateString(d);
    }
  }

  return null;
}

/**
 * Parse a recurrence rule from frontmatter.
 *
 * Supported frontmatter shapes:
 *   recur: daily
 *   recur: weekly
 *   recur: monthly
 *   recur:
 *     frequency: weekly
 *     dayOfWeek: 1   # 0 = Sun, 1 = Mon … 6 = Sat
 *   recur:
 *     frequency: monthly
 *     dayOfMonth: 15
 *
 * Returns `null` when no valid recurrence is declared.
 */
export function parseRecurrenceRule(frontmatter: Record<string, unknown>): RecurrenceRule | null {
  const recur = frontmatter['recur'];
  if (!recur) return null;

  if (typeof recur === 'string') {
    const freq = recur.toLowerCase().trim() as RecurrenceFrequency;
    if (freq === 'daily' || freq === 'weekly' || freq === 'monthly') {
      return { frequency: freq };
    }
    return null;
  }

  if (typeof recur === 'object' && recur !== null) {
    const r = recur as Record<string, unknown>;
    const freq = (r['frequency'] as string | undefined)?.toLowerCase().trim() as
      | RecurrenceFrequency
      | undefined;
    if (!freq || !['daily', 'weekly', 'monthly'].includes(freq)) return null;

    const rule: RecurrenceRule = { frequency: freq };

    if (freq === 'weekly' && typeof r['dayOfWeek'] === 'number') {
      rule.dayOfWeek = Math.max(0, Math.min(6, r['dayOfWeek']));
    }
    if (freq === 'monthly' && typeof r['dayOfMonth'] === 'number') {
      rule.dayOfMonth = Math.max(1, Math.min(31, r['dayOfMonth']));
    }

    return rule;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recurring note occurrence expansion
// ---------------------------------------------------------------------------

/**
 * Test whether a CalendarNote with a recurrence rule occurs on `dateStr`.
 *
 * @param note     The source recurring note.
 * @param dateStr  Target date as YYYY-MM-DD.
 */
export function occursOnDate(note: CalendarNote, dateStr: string): boolean {
  if (!note.recurrence) return note.date === dateStr;

  const targetDate = parseDateString(dateStr);
  if (!targetDate) return false;

  // Do not generate occurrences before the note's anchor date
  const anchorDate = parseDateString(note.date);
  if (anchorDate && targetDate < anchorDate) return false;

  const { frequency, dayOfWeek, dayOfMonth } = note.recurrence;

  switch (frequency) {
    case 'daily':
      return true;

    case 'weekly': {
      if (dayOfWeek === undefined) {
        // Default to same weekday as the anchor date
        const anchor = parseDateString(note.date);
        return anchor ? targetDate.getDay() === anchor.getDay() : false;
      }
      return targetDate.getDay() === dayOfWeek;
    }

    case 'monthly': {
      if (dayOfMonth === undefined) {
        const anchor = parseDateString(note.date);
        return anchor ? targetDate.getDate() === anchor.getDate() : false;
      }
      return targetDate.getDate() === dayOfMonth;
    }

    default:
      return false;
  }
}

/**
 * Expand recurring notes into virtual CalendarNote instances for a given
 * date range (inclusive).
 *
 * Non-recurring notes that fall within the range are returned as-is.
 * Recurring notes are expanded into one virtual instance per matching day.
 * The original note ID is preserved on every virtual instance.
 *
 * @param notes      Array of CalendarNote items (all recurring + non-recurring).
 * @param rangeStart ISO date string YYYY-MM-DD (inclusive start of range).
 * @param rangeEnd   ISO date string YYYY-MM-DD (inclusive end of range).
 */
export function expandRecurringNotes(
  notes: CalendarNote[],
  rangeStart: string,
  rangeEnd: string,
): CalendarNote[] {
  const result: CalendarNote[] = [];
  const startDate = parseDateString(rangeStart);
  const endDate = parseDateString(rangeEnd);

  if (!startDate || !endDate) return [];

  for (const note of notes) {
    if (!note.recurrence) {
      // Regular note — include when its date falls in range
      if (note.date >= rangeStart && note.date <= rangeEnd) {
        result.push(note);
      }
      continue;
    }

    // Expand recurring note across the range
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = toDateString(cursor);
      if (occursOnDate(note, dateStr)) {
        result.push({
          ...note,
          date: dateStr,
          isRecurringInstance: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tag color mapping
// ---------------------------------------------------------------------------

/**
 * Deterministic palette for tag-based note color coding.
 * Same tag always maps to the same color in a session.
 */
const TAG_COLOR_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

const tagColorCache = new Map<string, string>();

/**
 * Returns a stable color hex string for the given tag name.
 * Uses a simple djb2-style hash so the same tag always maps to the same slot.
 */
export function colorForTag(tag: string): string {
  const cached = tagColorCache.get(tag);
  if (cached) return cached;

  let hash = 5381;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 33) ^ tag.charCodeAt(i);
  }
  const color = TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
  tagColorCache.set(tag, color);
  return color;
}

/**
 * Pick the display color for a CalendarNote based on its first tag.
 * Returns a neutral slate color when the note has no tags.
 */
export function noteColor(note: CalendarNote): string {
  return note.tags.length > 0 ? colorForTag(note.tags[0]) : '#94a3b8';
}

// ---------------------------------------------------------------------------
// Note grouping helpers
// ---------------------------------------------------------------------------

/**
 * Group CalendarNote items by their `date` string.
 * Returns a Map where each key is a YYYY-MM-DD string.
 */
export function groupNotesByDate(notes: CalendarNote[]): Map<string, CalendarNote[]> {
  const map = new Map<string, CalendarNote[]>();
  for (const note of notes) {
    const existing = map.get(note.date);
    if (existing) {
      existing.push(note);
    } else {
      map.set(note.date, [note]);
    }
  }
  return map;
}

/**
 * Sort CalendarNote items chronologically (oldest first).
 * When dates are equal, sorts alphabetically by title.
 */
export function sortNotesByDate(notes: CalendarNote[]): CalendarNote[] {
  return [...notes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}
