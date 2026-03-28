/**
 * date-utils — Pure date helpers for the Daily Notes plugin.
 *
 * All functions are side-effect-free and safe to call during React render.
 * No external date libraries are used; only native Date and Intl APIs.
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a Date to YYYY-MM-DD using local time (not UTC).
 * This is the canonical daily note date string throughout the plugin.
 */
export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a date using a custom format string.
 *
 * Supported tokens (case-sensitive):
 *   YYYY  — 4-digit year        (e.g. 2026)
 *   YY    — 2-digit year        (e.g. 26)
 *   MM    — 2-digit month       (e.g. 03)
 *   DD    — 2-digit day         (e.g. 07)
 *   ww    — ISO week number, zero-padded (e.g. 12)
 *   W     — ISO week number, unpadded  (e.g. 12)
 *   ddd   — abbreviated weekday (e.g. Fri)
 *   dddd  — full weekday        (e.g. Friday)
 *
 * The replacement order matters: longer tokens are replaced first to prevent
 * partial matches (e.g., "YYYY" must be replaced before "YY").
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const week = getISOWeekNumber(date);

  const weekday = date.toLocaleString('en-US', { weekday: 'long' });
  const weekdayShort = date.toLocaleString('en-US', { weekday: 'short' });

  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('DD', String(day).padStart(2, '0'))
    .replace('ww', String(week).padStart(2, '0'))
    .replace('W', String(week))
    .replace('dddd', weekday)
    .replace('ddd', weekdayShort);
}

/**
 * Return a human-readable label for a date relative to today.
 *
 * "Today" / "Yesterday" / "Tomorrow" for the adjacent days,
 * otherwise falls back to a locale-formatted medium date.
 */
export function formatRelativeDate(date: Date, today: Date = new Date()): string {
  const todayStr = formatDateYMD(today);
  const dateStr = formatDateYMD(date);

  if (dateStr === todayStr) return 'Today';

  const yesterday = addDays(today, -1);
  if (dateStr === formatDateYMD(yesterday)) return 'Yesterday';

  const tomorrow = addDays(today, 1);
  if (dateStr === formatDateYMD(tomorrow)) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Return a human-readable week label: "Week 12, 2026".
 */
export function formatWeekLabel(date: Date): string {
  const week = getISOWeekNumber(date);
  const year = getISOWeekYear(date);
  return `Week ${week}, ${year}`;
}

/**
 * Return a human-readable month label: "March 2026".
 */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a YYYY-MM-DD string to a local Date at midnight.
 * Returns null for any invalid input.
 */
export function parseDateYMD(dateStr: string): Date | null {
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

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Add (or subtract) the given number of days to a date.
 * Returns a new Date; the input is not mutated.
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add (or subtract) the given number of weeks (7-day periods) to a date.
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Add (or subtract) the given number of months to a date.
 *
 * If the resulting month is shorter than the current day-of-month,
 * the date is clamped to the last valid day of the target month
 * (e.g., Jan 31 + 1 month = Feb 28/29).
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1); // avoid overflow when changing month
  d.setMonth(d.getMonth() + months);
  // Clamp to last day of target month
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d;
}

/** Return the date for the previous day. */
export function prevDay(date: Date): Date {
  return addDays(date, -1);
}

/** Return the date for the next day. */
export function nextDay(date: Date): Date {
  return addDays(date, 1);
}

/** Return the date one week earlier. */
export function prevWeek(date: Date): Date {
  return addWeeks(date, -1);
}

/** Return the date one week later. */
export function nextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

/** Return the date one month earlier (same day-of-month where possible). */
export function prevMonth(date: Date): Date {
  return addMonths(date, -1);
}

/** Return the date one month later (same day-of-month where possible). */
export function nextMonth(date: Date): Date {
  return addMonths(date, 1);
}

// ---------------------------------------------------------------------------
// ISO Week number (ISO 8601)
// ---------------------------------------------------------------------------

/**
 * Returns the ISO 8601 week number for the given date.
 *
 * Week 1 is the week that contains the first Thursday of the year.
 * Weeks start on Monday.
 */
export function getISOWeekNumber(date: Date): number {
  // Work in UTC to avoid DST edge cases
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1, Sun=7
  // Set to nearest Thursday: Mon→+3, Tue→+2, Wed→+1, Thu→0, Fri→-1, Sat→-2, Sun→-3
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Returns the ISO week year for a date.
 * This can differ from the calendar year at the start/end of the year.
 *
 * E.g., Jan 1 2021 (Friday) belongs to ISO week 53 of 2020.
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  return d.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Period boundaries
// ---------------------------------------------------------------------------

/**
 * Return the Monday (start) of the ISO week that contains `date`.
 */
export function getWeekStart(date: Date): Date {
  const dow = date.getDay() === 0 ? 6 : date.getDay() - 1; // Mon=0, Sun=6
  const monday = new Date(date);
  monday.setDate(date.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Return the Sunday (end) of the ISO week that contains `date`.
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  return addDays(start, 6);
}

/**
 * Return the first day of the month containing `date`.
 */
export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Return the last day of the month containing `date`.
 */
export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Return the Monday of the week identified by (isoYear, isoWeek).
 */
export function weekStartFromISOWeek(isoYear: number, isoWeek: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(isoYear, 0, 4);
  const jan4dow = jan4.getDay() === 0 ? 7 : jan4.getDay(); // Mon=1, Sun=7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (jan4dow - 1));
  week1Monday.setHours(0, 0, 0, 0);
  return addDays(week1Monday, (isoWeek - 1) * 7);
}

// ---------------------------------------------------------------------------
// Date comparison
// ---------------------------------------------------------------------------

/** True when both dates represent the same calendar day (ignoring time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when `date` is today (local time). */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// ---------------------------------------------------------------------------
// Mini-calendar grid
// ---------------------------------------------------------------------------

export interface CalendarGridDay {
  /** ISO YYYY-MM-DD string */
  dateStr: string;
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isoWeek: number;
}

/**
 * Build a 6-row × 7-column grid of CalendarGridDay objects for the
 * given year and (zero-based) month. The grid always starts on Monday.
 */
export function buildMonthGrid(year: number, month: number): CalendarGridDay[][] {
  const firstOfMonth = new Date(year, month, 1);
  const todayStr = formatDateYMD(new Date());

  const firstDow = firstOfMonth.getDay(); // 0 Sun … 6 Sat
  const offsetFromMonday = firstDow === 0 ? 6 : firstDow - 1;

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - offsetFromMonday);

  const rows: CalendarGridDay[][] = [];

  for (let row = 0; row < 6; row++) {
    const week: CalendarGridDay[] = [];
    for (let col = 0; col < 7; col++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + row * 7 + col);
      const dateStr = formatDateYMD(d);
      week.push({
        dateStr,
        date: d,
        dayOfMonth: d.getDate(),
        isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
        isToday: dateStr === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isoWeek: getISOWeekNumber(d),
      });
    }
    rows.push(week);
  }

  return rows;
}
