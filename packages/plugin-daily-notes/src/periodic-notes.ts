/**
 * periodic-notes — Weekly and monthly note creation logic.
 *
 * Determines which periodic note (weekly / monthly) corresponds to a given
 * date, generates the note path, and provides helpers for detecting whether
 * an existing note matches a given period.
 */

import {
  getISOWeekNumber,
  getISOWeekYear,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  formatDateYMD,
} from './date-utils';
import {
  generateWeeklyNoteName,
  generateMonthlyNoteName,
  type GeneratedNoteName,
} from './note-name-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodicNoteType = 'daily' | 'weekly' | 'monthly';

export interface PeriodicNotePeriod {
  type: PeriodicNoteType;
  /** Human-readable label (e.g. "Week 12, 2026" or "March 2026"). */
  label: string;
  /** Inclusive start date of the period as YYYY-MM-DD. */
  startDate: string;
  /** Inclusive end date of the period as YYYY-MM-DD. */
  endDate: string;
  /** Generated note name/path details. */
  note: GeneratedNoteName;
}

// ---------------------------------------------------------------------------
// Weekly period
// ---------------------------------------------------------------------------

/**
 * Detect which ISO week period a given date falls in.
 *
 * @param date         Any date within the target week.
 * @param format       Weekly note filename format (default "YYYY-[W]ww").
 * @param folder       Optional parent folder.
 */
export function getWeeklyPeriod(
  date: Date,
  format = 'YYYY-[W]ww',
  folder = '',
): PeriodicNotePeriod {
  const week = getISOWeekNumber(date);
  const year = getISOWeekYear(date);
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  const note = generateWeeklyNoteName(date, format, folder);

  return {
    type: 'weekly',
    label: `Week ${week}, ${year}`,
    startDate: formatDateYMD(start),
    endDate: formatDateYMD(end),
    note,
  };
}

// ---------------------------------------------------------------------------
// Monthly period
// ---------------------------------------------------------------------------

/**
 * Detect which calendar month period a given date falls in.
 *
 * @param date    Any date within the target month.
 * @param format  Monthly note filename format (default "YYYY-MM").
 * @param folder  Optional parent folder.
 */
export function getMonthlyPeriod(date: Date, format = 'YYYY-MM', folder = ''): PeriodicNotePeriod {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  const label = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const note = generateMonthlyNoteName(date, format, folder);

  return {
    type: 'monthly',
    label,
    startDate: formatDateYMD(start),
    endDate: formatDateYMD(end),
    note,
  };
}

// ---------------------------------------------------------------------------
// Note matching helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the note at `notePath` corresponds to the weekly period
 * that contains `date`.
 *
 * Comparison is path-based: the generated note path must match the
 * provided note path (case-insensitive, with or without .md extension).
 */
export function isWeeklyNoteForDate(
  notePath: string,
  date: Date,
  format = 'YYYY-[W]ww',
  folder = '',
): boolean {
  const period = getWeeklyPeriod(date, format, folder);
  return normalizePath(notePath) === normalizePath(period.note.path);
}

/**
 * Check whether the note at `notePath` corresponds to the monthly period
 * that contains `date`.
 */
export function isMonthlyNoteForDate(
  notePath: string,
  date: Date,
  format = 'YYYY-MM',
  folder = '',
): boolean {
  const period = getMonthlyPeriod(date, format, folder);
  return normalizePath(notePath) === normalizePath(period.note.path);
}

// ---------------------------------------------------------------------------
// Template content generation
// ---------------------------------------------------------------------------

/**
 * Generate the default content for a weekly note.
 *
 * The content includes a YAML frontmatter block with relevant metadata
 * and a Markdown body with placeholders.
 */
export function generateWeeklyNoteContent(period: PeriodicNotePeriod): string {
  return [
    '---',
    `type: weekly`,
    `week: ${period.label}`,
    `start: ${period.startDate}`,
    `end: ${period.endDate}`,
    '---',
    '',
    `# ${period.label}`,
    '',
    '## Goals',
    '',
    '- ',
    '',
    '## Reflection',
    '',
    '',
    '## Notes',
    '',
    '',
  ].join('\n');
}

/**
 * Generate the default content for a monthly note.
 *
 * The content includes a YAML frontmatter block with relevant metadata
 * and a Markdown body with placeholders.
 */
export function generateMonthlyNoteContent(period: PeriodicNotePeriod): string {
  return [
    '---',
    `type: monthly`,
    `month: ${period.label}`,
    `start: ${period.startDate}`,
    `end: ${period.endDate}`,
    '---',
    '',
    `# ${period.label}`,
    '',
    '## Goals',
    '',
    '- ',
    '',
    '## Highlights',
    '',
    '',
    '## Reflection',
    '',
    '',
  ].join('\n');
}

/**
 * Generate the default content for a daily note.
 * Used when no custom template is configured.
 */
export function generateDailyNoteContent(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return [
    '---',
    `date: ${dateStr}`,
    `type: daily`,
    '---',
    '',
    `# ${formatted}`,
    '',
    '## Tasks',
    '',
    '- [ ] ',
    '',
    '## Notes',
    '',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function normalizePath(p: string): string {
  return p.toLowerCase().replace(/\.md$/i, '').replace(/\\/g, '/').replace(/^\/+/, '');
}
