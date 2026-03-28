/**
 * note-name-generator — Generate note filenames and titles from date and format.
 *
 * Supports:
 *   - Daily notes: configurable format string (e.g. "YYYY-MM-DD", "YYYY/MM/DD")
 *   - Weekly notes: ISO week notation (e.g. "YYYY-[W]ww")
 *   - Monthly notes: year-month notation (e.g. "YYYY-MM")
 *
 * Format tokens mirror those in date-utils.formatDate so the same
 * user-facing format string works in both places.
 */

import { formatDate, formatDateYMD, getISOWeekNumber, getISOWeekYear } from './date-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The full specification for a generated note name. */
export interface GeneratedNoteName {
  /** The base filename without extension (may include path segments from format). */
  name: string;
  /** Filename including ".md" extension. */
  filename: string;
  /** Display title (same as name, stripped of path separators). */
  title: string;
  /** Full path string (folder + name + ".md"). Leading "/" removed. */
  path: string;
}

// ---------------------------------------------------------------------------
// Daily note
// ---------------------------------------------------------------------------

/**
 * Generate the note name for a daily note.
 *
 * @param date    The date for which to generate the note name.
 * @param format  Format string (e.g. "YYYY-MM-DD"). Defaults to "YYYY-MM-DD".
 * @param folder  Optional parent folder path (e.g. "Daily Notes"). No trailing slash.
 */
export function generateDailyNoteName(
  date: Date,
  format = 'YYYY-MM-DD',
  folder = '',
): GeneratedNoteName {
  const name = formatDate(date, format);
  return buildResult(name, folder);
}

// ---------------------------------------------------------------------------
// Weekly note
// ---------------------------------------------------------------------------

/**
 * Generate the note name for a weekly note (ISO 8601 week).
 *
 * The default format is "YYYY-[W]ww" which produces names like "2026-W12".
 * The literal "[W]" in the format string is preserved as the letter "W"
 * (brackets prevent the "W" token from being interpreted as ISO week number).
 *
 * @param date    Any date within the target week.
 * @param format  Format string. Defaults to "YYYY-[W]ww".
 * @param folder  Optional parent folder path. No trailing slash.
 */
export function generateWeeklyNoteName(
  date: Date,
  format = 'YYYY-[W]ww',
  folder = '',
): GeneratedNoteName {
  // Strip bracket-protected literals before delegating to formatDate.
  // "[W]" → "W", "[Y]" → "Y", etc.
  const week = getISOWeekNumber(date);
  const year = getISOWeekYear(date);

  // Build a synthetic date at the week-year start so formatDate reads the
  // correct ISO year (which can differ from the calendar year near boundaries).
  const syntheticDate = new Date(year, date.getMonth(), date.getDate());

  // Replace format tokens for the ISO week year context.
  //
  // Strategy:
  //   1. Escape bracket-protected literals: [W] → \x00W\x00 (null-byte guards)
  //   2. Replace numeric tokens (YYYY, YY, MM, DD, ww) — these never appear
  //      as literal characters inside brackets in practice.
  //   3. Replace the bare 'W' token only outside guard pairs using a regex
  //      that matches 'W' not preceded or followed by null-bytes.
  //   4. Restore guarded literals by removing null-byte pairs.

  const weekStr = String(week).padStart(2, '0');
  const weekStrUnpadded = String(week);

  const expanded = format
    .replace(/\[([^\]]+)\]/g, '\x00$1\x00') // step 1: protect bracket literals
    .replace('YYYY', String(year)) // step 2: numeric tokens
    .replace('YY', String(year).slice(-2))
    .replace('ww', weekStr)
    .replace('MM', String(syntheticDate.getMonth() + 1).padStart(2, '0'))
    .replace('DD', String(syntheticDate.getDate()).padStart(2, '0'))
    // step 3: replace bare 'W' token only when NOT inside null-byte guards
    // We split on null-byte pairs and only replace in the "outside" segments.
    .split('\x00')
    .map((segment, idx) => {
      // Even indices are outside guards; odd indices are protected literals
      return idx % 2 === 0 ? segment.replace('W', weekStrUnpadded) : segment;
    })
    .join(''); // step 4: guards are gone since we split on \x00

  return buildResult(expanded, folder);
}

// ---------------------------------------------------------------------------
// Monthly note
// ---------------------------------------------------------------------------

/**
 * Generate the note name for a monthly note.
 *
 * @param date    Any date within the target month.
 * @param format  Format string. Defaults to "YYYY-MM".
 * @param folder  Optional parent folder path. No trailing slash.
 */
export function generateMonthlyNoteName(
  date: Date,
  format = 'YYYY-MM',
  folder = '',
): GeneratedNoteName {
  const name = formatDate(date, format);
  return buildResult(name, folder);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildResult(name: string, folder: string): GeneratedNoteName {
  const filename = `${name}.md`;
  // Title is the last path segment of the name (in case format includes slashes)
  const segments = name.split('/');
  const title = segments[segments.length - 1];

  let path: string;
  if (folder) {
    path = `${folder.replace(/\/+$/, '')}/${filename}`;
  } else {
    path = filename;
  }

  return { name, filename, title, path };
}

// ---------------------------------------------------------------------------
// Format validation
// ---------------------------------------------------------------------------

/**
 * Validate a daily note format string.
 *
 * A format is considered valid when it contains at least the year (YYYY or YY)
 * and day (DD) tokens, or the year and week number (ww / W).
 * Returns a descriptive error message, or null when valid.
 */
export function validateDailyFormat(format: string): string | null {
  if (!format || format.trim().length === 0) {
    return 'Format string must not be empty.';
  }

  const hasYear = format.includes('YYYY') || format.includes('YY');
  const hasDay = format.includes('DD');
  const hasWeek = format.includes('ww') || format.includes('[W]');

  if (!hasYear) {
    return 'Format must include a year token (YYYY or YY).';
  }

  if (!hasDay && !hasWeek) {
    return 'Format must include a day token (DD) or week token ([W]ww / ww).';
  }

  // Warn about tokens that would produce the same name for multiple notes
  // in the same year (only month, no day).
  if (!hasDay && !hasWeek && format.includes('MM')) {
    return 'A monthly-only format would create duplicate notes. Add DD or ww.';
  }

  return null;
}

/**
 * Test-friendly helper: generate a note name from a YYYY-MM-DD string.
 * Wraps generateDailyNoteName for convenience in tests.
 */
export function dailyNoteNameFromDateStr(
  dateStr: string,
  format = 'YYYY-MM-DD',
  folder = '',
): GeneratedNoteName | null {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const date = new Date(year, month, day);
  return generateDailyNoteName(date, format, folder);
}

/**
 * Return the expected note name for today with the given settings.
 * Convenience wrapper used in plugin startup logic.
 */
export function todayNoteName(format = 'YYYY-MM-DD', folder = ''): GeneratedNoteName {
  return generateDailyNoteName(new Date(), format, folder);
}

// Re-export formatDateYMD so callers can get a canonical date string
// without an extra import.
export { formatDateYMD as toDateString };
