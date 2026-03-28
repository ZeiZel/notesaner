/**
 * focus-mode — Core logic for the Focus Mode plugin.
 *
 * Provides pure functions for:
 *   - Session statistics (words written, elapsed time, WPM)
 *   - Progress toward a word count goal
 *   - Streak tracking (consecutive days with at least one focus session)
 *   - Word counting for plain text and Markdown
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A snapshot of the current writing session. */
export interface WritingSessionStats {
  /** Words written since focus mode was entered (net new words). */
  wordsWritten: number;
  /** Elapsed time in milliseconds since the session started. */
  elapsedMs: number;
  /** Elapsed time formatted as "MM:SS" or "H:MM:SS". */
  elapsedFormatted: string;
  /** Words per minute over the session (0 when session is too short to measure). */
  wordsPerMinute: number;
  /** Progress toward the word count goal, between 0 and 1. */
  goalProgress: number;
  /** Whether the word count goal has been met. */
  goalReached: boolean;
}

/** A single streak entry stored in localStorage. */
export interface StreakEntry {
  /** ISO date string "YYYY-MM-DD". */
  date: string;
  /** Number of words written during this day's session(s). */
  wordsWritten: number;
}

// ---------------------------------------------------------------------------
// Word counting
// ---------------------------------------------------------------------------

/**
 * Count the words in a plain-text or Markdown string.
 *
 * Strips YAML front-matter, Markdown syntax, and common punctuation before
 * splitting on whitespace. Returns 0 for empty or whitespace-only inputs.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;

  let cleaned = text;

  // Remove YAML front-matter (--- ... ---)
  cleaned = cleaned.replace(/^---[\s\S]*?---\s*/m, '');

  // Remove fenced code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/~~~[\s\S]*?~~~/g, '');

  // Remove inline code
  cleaned = cleaned.replace(/`[^`]+`/g, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Remove Markdown image syntax
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // Remove Markdown link syntax — keep link text
  cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove wiki links — keep display text or target
  cleaned = cleaned.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target: string, alias?: string) => alias ?? target,
  );

  // Remove Markdown emphasis / strong markers
  cleaned = cleaned.replace(/[*_]{1,3}/g, '');

  // Remove heading hashes
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, '');

  // Remove blockquote markers
  cleaned = cleaned.replace(/^>\s*/gm, '');

  // Remove list markers (-, *, +, numbered)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove horizontal rules
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) return 0;

  return cleaned.split(' ').filter((w) => w.length > 0).length;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/**
 * Format a duration in milliseconds as "M:SS" or "H:MM:SS".
 * Minutes and hours are never zero-padded; seconds always are.
 */
export function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

// ---------------------------------------------------------------------------
// WPM calculation
// ---------------------------------------------------------------------------

/**
 * Calculate words per minute.
 *
 * Returns 0 when the session is less than 10 seconds old to avoid
 * misleadingly large numbers at the very start of a session.
 */
export function calculateWpm(wordsWritten: number, elapsedMs: number): number {
  const MIN_ELAPSED_MS = 10_000; // 10 seconds
  if (elapsedMs < MIN_ELAPSED_MS || wordsWritten <= 0) return 0;
  const minutes = elapsedMs / 60_000;
  return Math.round(wordsWritten / minutes);
}

// ---------------------------------------------------------------------------
// Goal progress
// ---------------------------------------------------------------------------

/**
 * Compute progress toward a word count goal.
 *
 * @returns A value between 0 and 1 (clamped). Returns 0 when goal is 0.
 */
export function computeGoalProgress(wordsWritten: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(1, wordsWritten / goal);
}

// ---------------------------------------------------------------------------
// Session stats aggregation
// ---------------------------------------------------------------------------

/**
 * Compute a complete SessionStats snapshot from raw session values.
 */
export function computeSessionStats(
  wordsWritten: number,
  sessionStartTime: number | null,
  wordCountGoal: number,
  now: number = Date.now(),
): WritingSessionStats {
  const elapsedMs = sessionStartTime !== null ? Math.max(0, now - sessionStartTime) : 0;
  const wordsPerMinute = calculateWpm(wordsWritten, elapsedMs);
  const goalProgress = computeGoalProgress(wordsWritten, wordCountGoal);
  const goalReached = wordCountGoal > 0 && wordsWritten >= wordCountGoal;

  return {
    wordsWritten,
    elapsedMs,
    elapsedFormatted: formatElapsedTime(elapsedMs),
    wordsPerMinute,
    goalProgress,
    goalReached,
  };
}

// ---------------------------------------------------------------------------
// Streak tracking
// ---------------------------------------------------------------------------

const STREAK_STORAGE_KEY = 'notesaner-focus-streak';

/**
 * Get today's ISO date string "YYYY-MM-DD" in the local timezone.
 */
export function getTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Load the streak history from localStorage.
 * Returns an empty array on parse failure or in SSR environments.
 */
export function loadStreakHistory(): StreakEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StreakEntry[];
  } catch {
    return [];
  }
}

/**
 * Persist the streak history to localStorage.
 * Silently ignores errors (e.g. private browsing quota).
 */
export function saveStreakHistory(history: StreakEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Non-critical — streak data is cosmetic
  }
}

/**
 * Record words written for today's session.
 * Creates a new entry for today if none exists, or adds to the existing tally.
 */
export function recordStreakEntry(wordsWritten: number, now: Date = new Date()): void {
  if (wordsWritten <= 0) return;

  const today = getTodayDateString(now);
  const history = loadStreakHistory();

  const existingIndex = history.findIndex((e) => e.date === today);
  if (existingIndex >= 0) {
    history[existingIndex] = {
      date: today,
      wordsWritten: history[existingIndex].wordsWritten + wordsWritten,
    };
  } else {
    history.push({ date: today, wordsWritten });
  }

  // Keep only the last 365 days to prevent unbounded growth.
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffStr = getTodayDateString(cutoff);
  const trimmed = history.filter((e) => e.date >= cutoffStr);

  saveStreakHistory(trimmed);
}

/**
 * Calculate the current writing streak (consecutive days with sessions).
 *
 * A "day" counts when at least 1 word was written in a focus session.
 * Today counts if a session has already been recorded. Returns 0 for no history.
 */
export function calculateCurrentStreak(now: Date = new Date()): number {
  const history = loadStreakHistory();
  if (history.length === 0) return 0;

  // Sort descending (newest first)
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  const today = getTodayDateString(now);
  let streak = 0;
  let expected = today;

  for (const entry of sorted) {
    if (entry.date === expected && entry.wordsWritten > 0) {
      streak++;
      // Move expected date one day back
      const d = new Date(expected + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      expected = getTodayDateString(d);
    } else if (entry.date < expected) {
      // Gap — streak is broken
      break;
    }
    // entry.date > expected means future dates in storage (shouldn't happen) — skip
  }

  return streak;
}
