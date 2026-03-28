/**
 * Tests for focus-mode.ts
 *
 * Covers:
 *   - countWords (various Markdown inputs)
 *   - formatElapsedTime
 *   - calculateWpm
 *   - computeGoalProgress
 *   - computeSessionStats
 *   - getTodayDateString
 *   - recordStreakEntry / calculateCurrentStreak
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  countWords,
  formatElapsedTime,
  calculateWpm,
  computeGoalProgress,
  computeSessionStats,
  getTodayDateString,
  loadStreakHistory,
  saveStreakHistory,
  recordStreakEntry,
  calculateCurrentStreak,
} from '../focus-mode';

// ---------------------------------------------------------------------------
// countWords
// ---------------------------------------------------------------------------

describe('countWords', () => {
  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts plain text words correctly', () => {
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('one two three four five')).toBe(5);
  });

  it('strips YAML front-matter before counting', () => {
    const text = `---
title: My Note
tags: [foo, bar]
---
Hello world`;
    expect(countWords(text)).toBe(2);
  });

  it('strips Markdown heading hashes', () => {
    expect(countWords('## Hello World')).toBe(2);
    expect(countWords('# One\n## Two Three')).toBe(3);
  });

  it('strips fenced code blocks', () => {
    const text = 'Before\n```js\nconst x = 1;\n```\nAfter';
    expect(countWords(text)).toBe(2);
  });

  it('strips inline code leaving surrounding words', () => {
    // 'Use `const x = 1` here' → inline code removed → 'Use  here' → 2 words
    expect(countWords('Use `const x = 1` here')).toBe(2);
  });

  it('keeps link text from markdown links', () => {
    expect(countWords('[Click here](https://example.com) to continue')).toBe(4);
  });

  it('strips markdown image syntax', () => {
    expect(countWords('Before ![alt text](image.png) after')).toBe(2);
  });

  it('keeps wiki link display text when alias is present', () => {
    // 'See [[My Note|the note]] for details' → 'See the note for details' = 5 words
    expect(countWords('See [[My Note|the note]] for details')).toBe(5);
  });

  it('keeps wiki link target text when no alias', () => {
    // 'See [[My Note]] for details' → 'See My Note for details' = 5 words
    expect(countWords('See [[My Note]] for details')).toBe(5);
  });

  it('strips emphasis markers', () => {
    expect(countWords('**bold** and *italic*')).toBe(3);
    expect(countWords('___underline___')).toBe(1);
  });

  it('strips blockquote markers', () => {
    expect(countWords('> Quoted text here')).toBe(3);
  });

  it('strips unordered list markers', () => {
    expect(countWords('- Item one\n- Item two')).toBe(4);
    expect(countWords('* Another item')).toBe(2);
  });

  it('strips ordered list markers', () => {
    expect(countWords('1. First item\n2. Second item')).toBe(4);
  });

  it('handles multi-paragraph text', () => {
    const text = 'First paragraph here.\n\nSecond paragraph there.';
    expect(countWords(text)).toBe(6);
  });

  it('handles HTML tags', () => {
    expect(countWords('<p>Hello world</p>')).toBe(2);
    expect(countWords('<strong>bold</strong> text')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// formatElapsedTime
// ---------------------------------------------------------------------------

describe('formatElapsedTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatElapsedTime(0)).toBe('0:00');
  });

  it('formats 30 seconds as 0:30', () => {
    expect(formatElapsedTime(30_000)).toBe('0:30');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatElapsedTime(90_000)).toBe('1:30');
  });

  it('formats 3600 seconds as 1:00:00', () => {
    expect(formatElapsedTime(3_600_000)).toBe('1:00:00');
  });

  it('formats 3661 seconds as 1:01:01', () => {
    expect(formatElapsedTime(3_661_000)).toBe('1:01:01');
  });

  it('pads seconds with leading zero', () => {
    expect(formatElapsedTime(65_000)).toBe('1:05');
  });

  it('does not pad minutes', () => {
    expect(formatElapsedTime(600_000)).toBe('10:00');
  });
});

// ---------------------------------------------------------------------------
// calculateWpm
// ---------------------------------------------------------------------------

describe('calculateWpm', () => {
  it('returns 0 when elapsed time is less than 10 seconds', () => {
    expect(calculateWpm(100, 5_000)).toBe(0);
  });

  it('returns 0 when wordsWritten is 0', () => {
    expect(calculateWpm(0, 60_000)).toBe(0);
  });

  it('calculates WPM correctly for 60 words in 1 minute', () => {
    expect(calculateWpm(60, 60_000)).toBe(60);
  });

  it('calculates WPM correctly for 300 words in 5 minutes', () => {
    expect(calculateWpm(300, 300_000)).toBe(60);
  });

  it('rounds WPM to nearest integer', () => {
    // 100 words in 90 seconds = 66.67 WPM → 67
    expect(calculateWpm(100, 90_000)).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// computeGoalProgress
// ---------------------------------------------------------------------------

describe('computeGoalProgress', () => {
  it('returns 0 when goal is 0', () => {
    expect(computeGoalProgress(100, 0)).toBe(0);
  });

  it('returns 0 when no words written', () => {
    expect(computeGoalProgress(0, 500)).toBe(0);
  });

  it('returns 0.5 at halfway point', () => {
    expect(computeGoalProgress(250, 500)).toBe(0.5);
  });

  it('returns 1.0 at exactly the goal', () => {
    expect(computeGoalProgress(500, 500)).toBe(1);
  });

  it('clamps to 1.0 when words exceed goal', () => {
    expect(computeGoalProgress(600, 500)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeSessionStats
// ---------------------------------------------------------------------------

describe('computeSessionStats', () => {
  it('returns zeroed stats when sessionStartTime is null', () => {
    const stats = computeSessionStats(0, null, 0);
    expect(stats.elapsedMs).toBe(0);
    expect(stats.elapsedFormatted).toBe('0:00');
    expect(stats.wordsPerMinute).toBe(0);
    expect(stats.goalProgress).toBe(0);
    expect(stats.goalReached).toBe(false);
  });

  it('calculates elapsedMs from sessionStartTime and now', () => {
    const startTime = 1_000_000;
    const now = startTime + 120_000; // 2 minutes later
    const stats = computeSessionStats(0, startTime, 0, now);
    expect(stats.elapsedMs).toBe(120_000);
    expect(stats.elapsedFormatted).toBe('2:00');
  });

  it('sets goalReached to true when wordsWritten >= goal', () => {
    const stats = computeSessionStats(500, 1_000_000, 500, 1_000_000 + 60_000);
    expect(stats.goalReached).toBe(true);
    expect(stats.goalProgress).toBe(1);
  });

  it('sets goalReached to false when goal is 0', () => {
    const stats = computeSessionStats(1000, 1_000_000, 0, 1_000_000 + 60_000);
    expect(stats.goalReached).toBe(false);
  });

  it('wordsWritten is passed through unchanged', () => {
    const stats = computeSessionStats(42, null, 0);
    expect(stats.wordsWritten).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Streak tracking
// ---------------------------------------------------------------------------

describe('getTodayDateString', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    const date = new Date(2026, 2, 15); // March 15, 2026
    expect(getTodayDateString(date)).toBe('2026-03-15');
  });

  it('zero-pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(getTodayDateString(date)).toBe('2026-01-05');
  });
});

describe('recordStreakEntry and calculateCurrentStreak', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns 0 when no history exists', () => {
    expect(calculateCurrentStreak()).toBe(0);
  });

  it('records a streak entry for today', () => {
    const today = new Date(2026, 2, 28);
    recordStreakEntry(100, today);
    const history = loadStreakHistory();
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe('2026-03-28');
    expect(history[0].wordsWritten).toBe(100);
  });

  it('accumulates words for the same day', () => {
    const today = new Date(2026, 2, 28);
    recordStreakEntry(100, today);
    recordStreakEntry(50, today);
    const history = loadStreakHistory();
    expect(history).toHaveLength(1);
    expect(history[0].wordsWritten).toBe(150);
  });

  it('does not record entry for 0 words', () => {
    const today = new Date(2026, 2, 28);
    recordStreakEntry(0, today);
    expect(loadStreakHistory()).toHaveLength(0);
  });

  it('calculates streak of 1 for today only', () => {
    const today = new Date(2026, 2, 28);
    saveStreakHistory([{ date: '2026-03-28', wordsWritten: 100 }]);
    expect(calculateCurrentStreak(today)).toBe(1);
  });

  it('calculates streak of 3 for three consecutive days', () => {
    saveStreakHistory([
      { date: '2026-03-26', wordsWritten: 100 },
      { date: '2026-03-27', wordsWritten: 200 },
      { date: '2026-03-28', wordsWritten: 150 },
    ]);
    const today = new Date(2026, 2, 28);
    expect(calculateCurrentStreak(today)).toBe(3);
  });

  it('breaks streak on gap', () => {
    saveStreakHistory([
      { date: '2026-03-25', wordsWritten: 100 },
      // March 26 missing — gap
      { date: '2026-03-27', wordsWritten: 200 },
      { date: '2026-03-28', wordsWritten: 150 },
    ]);
    const today = new Date(2026, 2, 28);
    expect(calculateCurrentStreak(today)).toBe(2);
  });

  it('returns 0 when today has no entry', () => {
    saveStreakHistory([
      { date: '2026-03-26', wordsWritten: 100 },
      { date: '2026-03-27', wordsWritten: 200 },
    ]);
    const today = new Date(2026, 2, 28);
    expect(calculateCurrentStreak(today)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// saveStreakHistory / loadStreakHistory
// ---------------------------------------------------------------------------

describe('saveStreakHistory / loadStreakHistory', () => {
  beforeEach(() => localStorage.clear());

  it('saves and reloads an array of entries', () => {
    const entries = [
      { date: '2026-03-27', wordsWritten: 300 },
      { date: '2026-03-28', wordsWritten: 500 },
    ];
    saveStreakHistory(entries);
    expect(loadStreakHistory()).toEqual(entries);
  });

  it('returns empty array when localStorage is clear', () => {
    expect(loadStreakHistory()).toEqual([]);
  });

  it('returns empty array when localStorage has corrupt data', () => {
    localStorage.setItem('notesaner-focus-streak', 'not-json');
    expect(loadStreakHistory()).toEqual([]);
  });
});
