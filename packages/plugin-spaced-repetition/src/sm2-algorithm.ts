/**
 * SM-2 Spaced Repetition Algorithm.
 *
 * Implementation based on the original SM-2 algorithm by Piotr Wozniak (1987).
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Key concepts:
 * - Quality (0–5): How well the user recalled the card.
 *   0 = complete blackout, 5 = perfect response.
 * - Easiness Factor (EF): A multiplier that affects the interval growth.
 *   Starts at 2.5, minimum 1.3. Higher EF = less frequent reviews.
 * - Repetition count (n): How many successful recalls in a row (quality >= 3).
 * - Interval: Days until the next review.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A quality rating from 0 (blackout) to 5 (perfect). */
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

/** Input parameters for calculating the next review schedule. */
export interface SM2Input {
  /**
   * Quality of the current review response (0–5).
   * 0 = complete blackout / incorrect
   * 1 = incorrect, but correct answer recalled after seeing it
   * 2 = incorrect, but correct answer seemed easy to recall
   * 3 = correct, with serious difficulty
   * 4 = correct, after hesitation
   * 5 = perfect response
   */
  quality: ReviewQuality;
  /**
   * Previous interval in days. 0 for a new card (never reviewed).
   */
  previousInterval: number;
  /**
   * Previous easiness factor. Use DEFAULT_EF for a new card.
   */
  previousEF: number;
  /**
   * Number of successful repetitions in sequence.
   * A "successful" repetition is quality >= 3.
   * Reset to 0 on any failed review (quality < 3).
   */
  repetitionCount: number;
}

/** Result of an SM-2 calculation. */
export interface SM2Result {
  /** New interval in days before the next review. */
  interval: number;
  /** Updated easiness factor (clamped to [MIN_EF, MAX_EF]). */
  easinessFactor: number;
  /**
   * Updated repetition count.
   * 0 if the review failed (quality < 3), otherwise previousRepetitionCount + 1.
   */
  repetitionCount: number;
  /**
   * Whether the review was considered a success (quality >= MIN_PASSING_QUALITY).
   * Failed reviews reset the card's repetition sequence.
   */
  successful: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default easiness factor for new cards. */
export const DEFAULT_EF = 2.5;

/** Minimum allowed easiness factor. Prevents intervals from collapsing. */
export const MIN_EF = 1.3;

/** Maximum allowed easiness factor. Prevents runaway long intervals. */
export const MAX_EF = 5.0;

/** Minimum quality score considered a successful review. */
export const MIN_PASSING_QUALITY = 3;

/**
 * Interval (days) for the first successful review of a new card.
 * Matches the SM-2 specification.
 */
export const INITIAL_INTERVAL_1 = 1;

/**
 * Interval (days) for the second successful review.
 * Matches the SM-2 specification.
 */
export const INITIAL_INTERVAL_2 = 6;

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Calculates the next review schedule for a flashcard using the SM-2 algorithm.
 *
 * Pure function — has no side effects.
 *
 * @param input - Current card state and the quality of the latest review.
 * @returns Next interval, updated EF, repetition count, and success flag.
 */
export function calculateNextReview(input: SM2Input): SM2Result {
  const { quality, previousInterval, previousEF, repetitionCount } = input;

  const successful = quality >= MIN_PASSING_QUALITY;

  if (!successful) {
    // Failed review: reset repetition count and restart intervals from scratch.
    return {
      interval: INITIAL_INTERVAL_1,
      easinessFactor: clampEF(previousEF),
      repetitionCount: 0,
      successful: false,
    };
  }

  // Update EF using the SM-2 formula:
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEF = clampEF(previousEF + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const newRepetitionCount = repetitionCount + 1;

  let newInterval: number;

  if (newRepetitionCount === 1) {
    newInterval = INITIAL_INTERVAL_1;
  } else if (newRepetitionCount === 2) {
    newInterval = INITIAL_INTERVAL_2;
  } else {
    // For subsequent repetitions: interval = previous_interval * EF
    newInterval = Math.round(previousInterval * newEF);
  }

  return {
    interval: Math.max(1, newInterval),
    easinessFactor: newEF,
    repetitionCount: newRepetitionCount,
    successful: true,
  };
}

/**
 * Clamps an easiness factor to the valid range [MIN_EF, MAX_EF].
 */
export function clampEF(ef: number): number {
  return Math.max(MIN_EF, Math.min(MAX_EF, ef));
}

/**
 * Calculates the due date given a review date and an interval in days.
 *
 * @param reviewedAt - ISO timestamp when the review occurred.
 * @param intervalDays - Number of days until the next review.
 * @returns ISO timestamp for the next due date.
 */
export function calculateDueDate(reviewedAt: string, intervalDays: number): string {
  const date = new Date(reviewedAt);
  date.setDate(date.getDate() + intervalDays);
  return date.toISOString();
}

/**
 * Determines whether a card is due for review based on its next review date.
 *
 * @param dueDate - ISO timestamp for the card's next scheduled review.
 * @param now - Optional ISO timestamp for "current time" (defaults to Date.now()).
 * @returns true if the card is due or overdue.
 */
export function isCardDue(dueDate: string, now?: string): boolean {
  const dueMs = new Date(dueDate).getTime();
  const nowMs = now ? new Date(now).getTime() : Date.now();
  return dueMs <= nowMs;
}

/**
 * Returns a human-readable description of the review quality.
 */
export function qualityLabel(quality: ReviewQuality): string {
  switch (quality) {
    case 0:
      return 'Again';
    case 1:
      return 'Again';
    case 2:
      return 'Hard';
    case 3:
      return 'Hard';
    case 4:
      return 'Good';
    case 5:
      return 'Easy';
  }
}

/**
 * Maps a 1-5 button rating (as displayed in the UI) to an SM-2 quality score.
 *
 * UI ratings:
 *   1 = Again (SM-2: 0)
 *   2 = Hard   (SM-2: 2)
 *   3 = Good   (SM-2: 3)
 *   4 = Easy   (SM-2: 4)
 *   5 = Perfect (SM-2: 5)
 */
export function uiRatingToQuality(rating: 1 | 2 | 3 | 4 | 5): ReviewQuality {
  const map: Record<number, ReviewQuality> = {
    1: 0,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
  };
  return map[rating];
}
