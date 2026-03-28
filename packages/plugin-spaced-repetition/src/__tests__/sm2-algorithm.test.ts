/**
 * Comprehensive tests for the SM-2 spaced repetition algorithm.
 *
 * Coverage:
 * - All quality levels (0–5) with varying card states
 * - Interval progression across multiple repetitions
 * - EF (easiness factor) bounds and clamping
 * - Failed-review reset behavior
 * - calculateDueDate and isCardDue utilities
 * - uiRatingToQuality mapping
 * - qualityLabel mapping
 * - Edge cases: extreme inputs, boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNextReview,
  calculateDueDate,
  isCardDue,
  clampEF,
  qualityLabel,
  uiRatingToQuality,
  DEFAULT_EF,
  MIN_EF,
  MAX_EF,
  MIN_PASSING_QUALITY,
  INITIAL_INTERVAL_1,
  INITIAL_INTERVAL_2,
} from '../sm2-algorithm';
import type { SM2Input } from '../sm2-algorithm';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function newCard(): SM2Input {
  return {
    quality: 4,
    previousInterval: 0,
    previousEF: DEFAULT_EF,
    repetitionCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('DEFAULT_EF is 2.5', () => {
    expect(DEFAULT_EF).toBe(2.5);
  });

  it('MIN_EF is 1.3', () => {
    expect(MIN_EF).toBe(1.3);
  });

  it('MAX_EF is 5.0', () => {
    expect(MAX_EF).toBe(5.0);
  });

  it('MIN_PASSING_QUALITY is 3', () => {
    expect(MIN_PASSING_QUALITY).toBe(3);
  });

  it('INITIAL_INTERVAL_1 is 1', () => {
    expect(INITIAL_INTERVAL_1).toBe(1);
  });

  it('INITIAL_INTERVAL_2 is 6', () => {
    expect(INITIAL_INTERVAL_2).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// calculateNextReview — Failed reviews (quality < 3)
// ---------------------------------------------------------------------------

describe('calculateNextReview — failed reviews', () => {
  it('quality 0 (blackout) resets repetition count to 0', () => {
    const result = calculateNextReview({ ...newCard(), quality: 0 });
    expect(result.repetitionCount).toBe(0);
    expect(result.successful).toBe(false);
  });

  it('quality 1 resets repetition count to 0', () => {
    const result = calculateNextReview({ ...newCard(), quality: 1 });
    expect(result.repetitionCount).toBe(0);
    expect(result.successful).toBe(false);
  });

  it('quality 2 resets repetition count to 0', () => {
    const result = calculateNextReview({ ...newCard(), quality: 2 });
    expect(result.repetitionCount).toBe(0);
    expect(result.successful).toBe(false);
  });

  it('failed review resets interval to 1', () => {
    const input: SM2Input = {
      quality: 0,
      previousInterval: 30,
      previousEF: 2.5,
      repetitionCount: 5,
    };
    const result = calculateNextReview(input);
    expect(result.interval).toBe(1);
  });

  it('failed review preserves the current EF (does not decrease it)', () => {
    const input: SM2Input = {
      quality: 0,
      previousInterval: 10,
      previousEF: 2.0,
      repetitionCount: 3,
    };
    const result = calculateNextReview(input);
    // EF is kept as-is (clamped to valid range) — failed reviews don't reduce EF
    expect(result.easinessFactor).toBeCloseTo(2.0, 1);
  });

  it('failed review after a long sequence resets everything properly', () => {
    const input: SM2Input = {
      quality: 1,
      previousInterval: 365,
      previousEF: 3.5,
      repetitionCount: 20,
    };
    const result = calculateNextReview(input);
    expect(result.repetitionCount).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.successful).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateNextReview — Successful reviews (quality >= 3)
// ---------------------------------------------------------------------------

describe('calculateNextReview — successful reviews', () => {
  it('quality 3 is considered successful', () => {
    const result = calculateNextReview({ ...newCard(), quality: 3 });
    expect(result.successful).toBe(true);
    expect(result.repetitionCount).toBe(1);
  });

  it('quality 4 is successful', () => {
    const result = calculateNextReview({ ...newCard(), quality: 4 });
    expect(result.successful).toBe(true);
  });

  it('quality 5 is successful', () => {
    const result = calculateNextReview({ ...newCard(), quality: 5 });
    expect(result.successful).toBe(true);
  });

  it('first successful review sets interval to 1', () => {
    const result = calculateNextReview({ ...newCard(), quality: 4, repetitionCount: 0 });
    expect(result.interval).toBe(1);
    expect(result.repetitionCount).toBe(1);
  });

  it('second successful review sets interval to 6', () => {
    const result = calculateNextReview({
      quality: 4,
      previousInterval: 1,
      previousEF: DEFAULT_EF,
      repetitionCount: 1,
    });
    expect(result.interval).toBe(6);
    expect(result.repetitionCount).toBe(2);
  });

  it('third review interval = previousInterval * EF', () => {
    const input: SM2Input = {
      quality: 4,
      previousInterval: 6,
      previousEF: DEFAULT_EF,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    const expected = Math.round(6 * result.easinessFactor);
    expect(result.interval).toBe(expected);
    expect(result.repetitionCount).toBe(3);
  });

  it('interval grows with each subsequent successful review', () => {
    let state: SM2Input = {
      quality: 4,
      previousInterval: 0,
      previousEF: DEFAULT_EF,
      repetitionCount: 0,
    };
    const intervals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const result = calculateNextReview(state);
      intervals.push(result.interval);
      state = {
        quality: 4,
        previousInterval: result.interval,
        previousEF: result.easinessFactor,
        repetitionCount: result.repetitionCount,
      };
    }

    // Each interval should be >= the previous (monotonically non-decreasing)
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it('interval is always at least 1', () => {
    // Edge case: very low EF, short previous interval
    const result = calculateNextReview({
      quality: 3,
      previousInterval: 1,
      previousEF: MIN_EF,
      repetitionCount: 2,
    });
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// calculateNextReview — EF updates
// ---------------------------------------------------------------------------

describe('calculateNextReview — easiness factor', () => {
  it('perfect recall (quality 5) increases EF', () => {
    const input: SM2Input = {
      quality: 5,
      previousInterval: 6,
      previousEF: 2.5,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    expect(result.easinessFactor).toBeGreaterThan(2.5);
  });

  it('good recall (quality 4) keeps EF approximately the same', () => {
    const input: SM2Input = {
      quality: 4,
      previousInterval: 6,
      previousEF: 2.5,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    // Quality 4 produces EF change of approximately 0 by SM-2 formula
    expect(result.easinessFactor).toBeCloseTo(2.5, 1);
  });

  it('hard recall (quality 3) decreases EF', () => {
    const input: SM2Input = {
      quality: 3,
      previousInterval: 6,
      previousEF: 2.5,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    expect(result.easinessFactor).toBeLessThan(2.5);
  });

  it('EF never falls below MIN_EF (1.3)', () => {
    // Many hard reviews on a card that starts at low EF
    let ef = 1.4;
    for (let i = 0; i < 10; i++) {
      const result = calculateNextReview({
        quality: 3,
        previousInterval: 6,
        previousEF: ef,
        repetitionCount: 3,
      });
      ef = result.easinessFactor;
      expect(ef).toBeGreaterThanOrEqual(MIN_EF);
    }
  });

  it('EF never exceeds MAX_EF (5.0)', () => {
    // Many perfect reviews on a card already at high EF
    let ef = 4.9;
    for (let i = 0; i < 5; i++) {
      const result = calculateNextReview({
        quality: 5,
        previousInterval: 6,
        previousEF: ef,
        repetitionCount: 3,
      });
      ef = result.easinessFactor;
      expect(ef).toBeLessThanOrEqual(MAX_EF);
    }
  });

  it('quality 5 EF formula: EF + 0.1', () => {
    // For q=5: delta = 0.1 - (5-5) * (0.08 + (5-5)*0.02) = 0.1
    const input: SM2Input = {
      quality: 5,
      previousInterval: 6,
      previousEF: 2.0,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    expect(result.easinessFactor).toBeCloseTo(2.1, 5);
  });

  it('quality 3 EF formula: EF - 0.14', () => {
    // For q=3: delta = 0.1 - (5-3) * (0.08 + (5-3)*0.02) = 0.1 - 2*(0.08+0.04) = 0.1 - 0.24 = -0.14
    const input: SM2Input = {
      quality: 3,
      previousInterval: 6,
      previousEF: 2.5,
      repetitionCount: 2,
    };
    const result = calculateNextReview(input);
    expect(result.easinessFactor).toBeCloseTo(2.36, 2);
  });
});

// ---------------------------------------------------------------------------
// clampEF
// ---------------------------------------------------------------------------

describe('clampEF', () => {
  it('returns MIN_EF for values below minimum', () => {
    expect(clampEF(0)).toBe(MIN_EF);
    expect(clampEF(1.0)).toBe(MIN_EF);
    expect(clampEF(-5)).toBe(MIN_EF);
  });

  it('returns MAX_EF for values above maximum', () => {
    expect(clampEF(6)).toBe(MAX_EF);
    expect(clampEF(100)).toBe(MAX_EF);
  });

  it('returns the value unchanged when within range', () => {
    expect(clampEF(2.5)).toBe(2.5);
    expect(clampEF(MIN_EF)).toBe(MIN_EF);
    expect(clampEF(MAX_EF)).toBe(MAX_EF);
  });
});

// ---------------------------------------------------------------------------
// calculateDueDate
// ---------------------------------------------------------------------------

describe('calculateDueDate', () => {
  it('adds the correct number of days to the review date', () => {
    const reviewedAt = '2025-01-01T00:00:00.000Z';
    const dueDate = calculateDueDate(reviewedAt, 1);
    expect(dueDate.startsWith('2025-01-02')).toBe(true);
  });

  it('handles a 30-day interval', () => {
    const reviewedAt = '2025-01-01T00:00:00.000Z';
    const dueDate = calculateDueDate(reviewedAt, 30);
    expect(dueDate.startsWith('2025-01-31')).toBe(true);
  });

  it('handles end-of-month correctly (January 31 + 1 day = February 1)', () => {
    const reviewedAt = '2025-01-31T00:00:00.000Z';
    const dueDate = calculateDueDate(reviewedAt, 1);
    expect(dueDate.startsWith('2025-02-01')).toBe(true);
  });

  it('returns an ISO string', () => {
    const dueDate = calculateDueDate('2025-06-01T12:00:00.000Z', 7);
    expect(() => new Date(dueDate)).not.toThrow();
    expect(typeof dueDate).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// isCardDue
// ---------------------------------------------------------------------------

describe('isCardDue', () => {
  it('returns true when due date is in the past', () => {
    const past = '2020-01-01T00:00:00.000Z';
    const now = '2025-06-01T00:00:00.000Z';
    expect(isCardDue(past, now)).toBe(true);
  });

  it('returns false when due date is in the future', () => {
    const future = '2099-01-01T00:00:00.000Z';
    const now = '2025-06-01T00:00:00.000Z';
    expect(isCardDue(future, now)).toBe(false);
  });

  it('returns true when due date equals now (due exactly now)', () => {
    const now = '2025-06-01T12:00:00.000Z';
    expect(isCardDue(now, now)).toBe(true);
  });

  it('uses Date.now() when no reference time is provided', () => {
    const veryPast = '2000-01-01T00:00:00.000Z';
    expect(isCardDue(veryPast)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// qualityLabel
// ---------------------------------------------------------------------------

describe('qualityLabel', () => {
  it('returns "Again" for quality 0', () => {
    expect(qualityLabel(0)).toBe('Again');
  });

  it('returns "Again" for quality 1', () => {
    expect(qualityLabel(1)).toBe('Again');
  });

  it('returns "Hard" for quality 2', () => {
    expect(qualityLabel(2)).toBe('Hard');
  });

  it('returns "Hard" for quality 3', () => {
    expect(qualityLabel(3)).toBe('Hard');
  });

  it('returns "Good" for quality 4', () => {
    expect(qualityLabel(4)).toBe('Good');
  });

  it('returns "Easy" for quality 5', () => {
    expect(qualityLabel(5)).toBe('Easy');
  });
});

// ---------------------------------------------------------------------------
// uiRatingToQuality
// ---------------------------------------------------------------------------

describe('uiRatingToQuality', () => {
  it('maps UI rating 1 to SM-2 quality 0', () => {
    expect(uiRatingToQuality(1)).toBe(0);
  });

  it('maps UI rating 2 to SM-2 quality 2', () => {
    expect(uiRatingToQuality(2)).toBe(2);
  });

  it('maps UI rating 3 to SM-2 quality 3', () => {
    expect(uiRatingToQuality(3)).toBe(3);
  });

  it('maps UI rating 4 to SM-2 quality 4', () => {
    expect(uiRatingToQuality(4)).toBe(4);
  });

  it('maps UI rating 5 to SM-2 quality 5', () => {
    expect(uiRatingToQuality(5)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Full SM-2 progression simulation
// ---------------------------------------------------------------------------

describe('SM-2 full progression simulation', () => {
  it('simulates a typical learning sequence with consistent quality-4 reviews', () => {
    const reviews: Array<{ interval: number; ef: number; rep: number }> = [];

    let state: SM2Input = {
      quality: 4,
      previousInterval: 0,
      previousEF: DEFAULT_EF,
      repetitionCount: 0,
    };

    // Run 6 quality-4 reviews
    for (let i = 0; i < 6; i++) {
      const result = calculateNextReview(state);
      reviews.push({
        interval: result.interval,
        ef: result.easinessFactor,
        rep: result.repetitionCount,
      });
      state = {
        quality: 4,
        previousInterval: result.interval,
        previousEF: result.easinessFactor,
        repetitionCount: result.repetitionCount,
      };
    }

    // Rep 1: interval = 1
    expect(reviews[0].interval).toBe(1);
    // Rep 2: interval = 6
    expect(reviews[1].interval).toBe(6);
    // Rep 3: interval should be roughly 15 (6 * 2.5)
    expect(reviews[2].interval).toBeGreaterThan(6);
    // Subsequent intervals grow further
    expect(reviews[5].interval).toBeGreaterThan(reviews[4].interval);

    // Repetition counts should increment
    reviews.forEach((r, i) => expect(r.rep).toBe(i + 1));
  });

  it('recovery after failure: intervals restart from 1 then grow again', () => {
    // First, build up a sequence to rep 3 with interval ~15
    const state: SM2Input = {
      quality: 4,
      previousInterval: 6,
      previousEF: DEFAULT_EF,
      repetitionCount: 2,
    };
    const rep3 = calculateNextReview(state);
    expect(rep3.interval).toBeGreaterThan(6);

    // Now fail
    const failResult = calculateNextReview({
      quality: 0,
      previousInterval: rep3.interval,
      previousEF: rep3.easinessFactor,
      repetitionCount: rep3.repetitionCount,
    });
    expect(failResult.interval).toBe(1);
    expect(failResult.repetitionCount).toBe(0);

    // Recover with quality 4
    const recover1 = calculateNextReview({
      quality: 4,
      previousInterval: failResult.interval,
      previousEF: failResult.easinessFactor,
      repetitionCount: failResult.repetitionCount,
    });
    expect(recover1.interval).toBe(1);
    expect(recover1.repetitionCount).toBe(1);
  });
});
