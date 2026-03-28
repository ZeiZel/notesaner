/**
 * Tests for deck-manager utilities.
 *
 * Coverage:
 * - createDeckFromNote — deck created from a note ID
 * - createDeckFromTag — deck created from a tag
 * - mergeDecks — combining two or more decks
 * - reassignCardsToDeck — pure card reassignment
 * - computeDeckStats — stat calculation across states and due dates
 * - computeAllDeckStats — multi-deck aggregation
 * - countTotalDueCards — global due count
 * - sortCardsForReview — ordering for optimal review
 * - Edge cases: empty inputs, single deck merge guard
 */

import { describe, it, expect } from 'vitest';
import {
  createDeckFromNote,
  createDeckFromTag,
  mergeDecks,
  reassignCardsToDeck,
  computeDeckStats,
  computeAllDeckStats,
  countTotalDueCards,
  sortCardsForReview,
} from '../deck-manager';
import type { Deck, Flashcard } from '../card-store';
import { DEFAULT_EF } from '../sm2-algorithm';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-001',
    name: 'Test Deck',
    description: 'A test deck',
    createdAt: '2025-01-01T00:00:00.000Z',
    lastReviewedAt: null,
    noteIds: ['note-001'],
    tag: '',
    ...overrides,
  };
}

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-001',
    deckId: 'deck-001',
    noteId: 'note-001',
    front: 'Question?',
    back: 'Answer.',
    sourceLine: 0,
    state: 'new',
    tags: [],
    interval: 0,
    easinessFactor: DEFAULT_EF,
    repetitionCount: 0,
    dueDate: null,
    lastReviewedAt: null,
    totalReviews: 0,
    successfulReviews: 0,
    ...overrides,
  };
}

// A fixed reference point in the past — all "due" cards will be due relative to this
const NOW = '2025-06-01T12:00:00.000Z';
const PAST = '2025-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// createDeckFromNote
// ---------------------------------------------------------------------------

describe('createDeckFromNote', () => {
  it('creates a deck with the note ID in noteIds', () => {
    const deck = createDeckFromNote('note-123', 'My Note');
    expect(deck.noteIds).toContain('note-123');
  });

  it('uses the note name as deck name', () => {
    const deck = createDeckFromNote('note-123', 'Physics Notes');
    expect(deck.name).toBe('Physics Notes');
  });

  it('creates a deck with an empty tag', () => {
    const deck = createDeckFromNote('note-123', 'My Note');
    expect(deck.tag).toBe('');
  });

  it('generates a unique ID', () => {
    const d1 = createDeckFromNote('note-1', 'A');
    const d2 = createDeckFromNote('note-2', 'B');
    expect(d1.id).not.toBe(d2.id);
  });

  it('sets lastReviewedAt to null', () => {
    const deck = createDeckFromNote('note-1', 'A');
    expect(deck.lastReviewedAt).toBeNull();
  });

  it('includes note name in description', () => {
    const deck = createDeckFromNote('note-1', 'Organic Chemistry');
    expect(deck.description).toContain('Organic Chemistry');
  });
});

// ---------------------------------------------------------------------------
// createDeckFromTag
// ---------------------------------------------------------------------------

describe('createDeckFromTag', () => {
  it('creates a deck with the tag stored in the tag field', () => {
    const deck = createDeckFromTag('physics');
    expect(deck.tag).toBe('physics');
  });

  it('defaults deck name to #tag when no name is provided', () => {
    const deck = createDeckFromTag('chemistry');
    expect(deck.name).toBe('#chemistry');
  });

  it('uses custom name when provided', () => {
    const deck = createDeckFromTag('physics', 'Physics Flashcards');
    expect(deck.name).toBe('Physics Flashcards');
  });

  it('sets noteIds to empty array', () => {
    const deck = createDeckFromTag('math');
    expect(deck.noteIds).toEqual([]);
  });

  it('includes tag in description', () => {
    const deck = createDeckFromTag('biology');
    expect(deck.description).toContain('biology');
  });
});

// ---------------------------------------------------------------------------
// mergeDecks
// ---------------------------------------------------------------------------

describe('mergeDecks', () => {
  const deck1 = makeDeck({
    id: 'a',
    name: 'Deck A',
    noteIds: ['note-1', 'note-2'],
    lastReviewedAt: '2025-01-15T00:00:00.000Z',
  });
  const deck2 = makeDeck({
    id: 'b',
    name: 'Deck B',
    noteIds: ['note-2', 'note-3'],
    lastReviewedAt: '2025-01-10T00:00:00.000Z',
  });
  const deck3 = makeDeck({ id: 'c', name: 'Deck C', noteIds: ['note-4'], lastReviewedAt: null });

  it('creates a new deck with a different ID', () => {
    const merged = mergeDecks([deck1, deck2], 'Combined');
    expect(merged.id).not.toBe(deck1.id);
    expect(merged.id).not.toBe(deck2.id);
  });

  it('uses the provided name', () => {
    const merged = mergeDecks([deck1, deck2], 'My Combined Deck');
    expect(merged.name).toBe('My Combined Deck');
  });

  it('combines noteIds without duplicates', () => {
    const merged = mergeDecks([deck1, deck2], 'Combined');
    expect(new Set(merged.noteIds).size).toBe(merged.noteIds.length);
    expect(merged.noteIds).toContain('note-1');
    expect(merged.noteIds).toContain('note-2');
    expect(merged.noteIds).toContain('note-3');
  });

  it('uses the latest lastReviewedAt from the source decks', () => {
    const merged = mergeDecks([deck1, deck2], 'Combined');
    expect(merged.lastReviewedAt).toBe('2025-01-15T00:00:00.000Z');
  });

  it('sets lastReviewedAt to null when all source decks have null', () => {
    const unreviewed1 = makeDeck({ id: 'x', lastReviewedAt: null });
    const unreviewed2 = makeDeck({ id: 'y', lastReviewedAt: null });
    const merged = mergeDecks([unreviewed1, unreviewed2], 'Merged');
    expect(merged.lastReviewedAt).toBeNull();
  });

  it('throws an error when fewer than 2 decks are provided', () => {
    expect(() => mergeDecks([deck1], 'Fail')).toThrow();
    expect(() => mergeDecks([], 'Fail')).toThrow();
  });

  it('merges 3 or more decks', () => {
    const merged = mergeDecks([deck1, deck2, deck3], 'Three-way');
    expect(merged.noteIds).toHaveLength(4); // note-1..4, note-2 is deduped
  });

  it('clears the tag field on the merged deck', () => {
    const tagged = makeDeck({ id: 't', tag: 'physics' });
    const merged = mergeDecks([deck1, tagged], 'Merged');
    expect(merged.tag).toBe('');
  });

  it('includes all original deck names in description', () => {
    const merged = mergeDecks([deck1, deck2], 'Combined');
    expect(merged.description).toContain('Deck A');
    expect(merged.description).toContain('Deck B');
  });
});

// ---------------------------------------------------------------------------
// reassignCardsToDeck
// ---------------------------------------------------------------------------

describe('reassignCardsToDeck', () => {
  it('reassigns all cards to the new deck ID', () => {
    const cards = [
      makeCard({ id: 'c1', deckId: 'old-deck' }),
      makeCard({ id: 'c2', deckId: 'old-deck' }),
    ];
    const reassigned = reassignCardsToDeck(cards, 'new-deck');
    expect(reassigned.every((c) => c.deckId === 'new-deck')).toBe(true);
  });

  it('does not mutate the original cards', () => {
    const cards = [makeCard({ deckId: 'original' })];
    reassignCardsToDeck(cards, 'new');
    expect(cards[0].deckId).toBe('original');
  });

  it('preserves all other card fields', () => {
    const card = makeCard({ id: 'c1', front: 'Q', back: 'A', tags: ['tag1'] });
    const [reassigned] = reassignCardsToDeck([card], 'new-deck');
    expect(reassigned.front).toBe('Q');
    expect(reassigned.back).toBe('A');
    expect(reassigned.tags).toEqual(['tag1']);
  });

  it('returns empty array for empty input', () => {
    expect(reassignCardsToDeck([], 'deck-x')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeDeckStats
// ---------------------------------------------------------------------------

describe('computeDeckStats', () => {
  it('returns zero stats for an empty card array', () => {
    const stats = computeDeckStats([]);
    expect(stats.total).toBe(0);
    expect(stats.newCount).toBe(0);
    expect(stats.dueCount).toBe(0);
    expect(stats.retentionRate).toBe(0);
  });

  it('counts new cards correctly', () => {
    const cards = [
      makeCard({ state: 'new', dueDate: null }),
      makeCard({ id: 'c2', state: 'new', dueDate: null }),
    ];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.newCount).toBe(2);
    expect(stats.total).toBe(2);
  });

  it('new cards (dueDate null) are always counted as due', () => {
    const cards = [makeCard({ state: 'new', dueDate: null })];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.dueCount).toBe(1);
  });

  it('counts overdue cards as due', () => {
    const cards = [makeCard({ state: 'review', dueDate: PAST })];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.dueCount).toBe(1);
  });

  it('does not count future-due cards as due', () => {
    const cards = [makeCard({ state: 'review', dueDate: FUTURE })];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.dueCount).toBe(0);
  });

  it('counts all card states separately', () => {
    const cards = [
      makeCard({ id: 'a', state: 'new' }),
      makeCard({ id: 'b', state: 'learning' }),
      makeCard({ id: 'c', state: 'review' }),
      makeCard({ id: 'd', state: 'mastered' }),
    ];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.newCount).toBe(1);
    expect(stats.learningCount).toBe(1);
    expect(stats.reviewCount).toBe(1);
    expect(stats.masteredCount).toBe(1);
    expect(stats.total).toBe(4);
  });

  it('calculates retention rate correctly', () => {
    const cards = [
      makeCard({ id: 'a', totalReviews: 10, successfulReviews: 8 }),
      makeCard({ id: 'b', totalReviews: 10, successfulReviews: 6 }),
    ];
    const stats = computeDeckStats(cards, NOW);
    // (8 + 6) / (10 + 10) = 14/20 = 70%
    expect(stats.retentionRate).toBe(70);
  });

  it('retention rate is 0 when no cards have been reviewed', () => {
    const cards = [makeCard({ totalReviews: 0, successfulReviews: 0 })];
    const stats = computeDeckStats(cards, NOW);
    expect(stats.retentionRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAllDeckStats
// ---------------------------------------------------------------------------

describe('computeAllDeckStats', () => {
  it('returns a stats entry for each deck', () => {
    const decks = [makeDeck({ id: 'd1', name: 'Deck 1' }), makeDeck({ id: 'd2', name: 'Deck 2' })];
    const cards = [makeCard({ id: 'c1', deckId: 'd1' }), makeCard({ id: 'c2', deckId: 'd2' })];
    const result = computeAllDeckStats(decks, cards, NOW);
    expect(result).toHaveLength(2);
    expect(result[0].deck.id).toBe('d1');
    expect(result[1].deck.id).toBe('d2');
  });

  it('shows zero stats for a deck with no cards', () => {
    const decks = [makeDeck({ id: 'd1' })];
    const result = computeAllDeckStats(decks, [], NOW);
    expect(result[0].stats.total).toBe(0);
  });

  it('returns empty array when no decks provided', () => {
    const result = computeAllDeckStats([], [], NOW);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// countTotalDueCards
// ---------------------------------------------------------------------------

describe('countTotalDueCards', () => {
  it('counts new cards (null dueDate) as due', () => {
    const cards = [makeCard({ dueDate: null })];
    expect(countTotalDueCards(cards, NOW)).toBe(1);
  });

  it('counts past-due cards', () => {
    const cards = [makeCard({ dueDate: PAST })];
    expect(countTotalDueCards(cards, NOW)).toBe(1);
  });

  it('does not count future-due cards', () => {
    const cards = [makeCard({ dueDate: FUTURE })];
    expect(countTotalDueCards(cards, NOW)).toBe(0);
  });

  it('returns 0 for empty card array', () => {
    expect(countTotalDueCards([], NOW)).toBe(0);
  });

  it('counts correctly across mixed due/not-due cards', () => {
    const cards = [
      makeCard({ id: 'a', dueDate: null }), // due (new)
      makeCard({ id: 'b', dueDate: PAST }), // due (overdue)
      makeCard({ id: 'c', dueDate: FUTURE }), // not due
    ];
    expect(countTotalDueCards(cards, NOW)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sortCardsForReview
// ---------------------------------------------------------------------------

describe('sortCardsForReview', () => {
  it('does not mutate the input array', () => {
    const cards = [
      makeCard({ id: 'a', state: 'new' }),
      makeCard({ id: 'b', state: 'mastered', dueDate: PAST }),
    ];
    const original = [...cards];
    sortCardsForReview(cards, NOW);
    expect(cards).toEqual(original);
  });

  it('sorts new cards before mastered cards', () => {
    const cards = [
      makeCard({ id: 'mastered', state: 'mastered', dueDate: PAST }),
      makeCard({ id: 'new', state: 'new', dueDate: null }),
    ];
    const sorted = sortCardsForReview(cards, NOW);
    expect(sorted[0].id).toBe('new');
  });

  it('sorts learning cards before review cards', () => {
    const cards = [
      makeCard({ id: 'review', state: 'review', dueDate: PAST }),
      makeCard({ id: 'learning', state: 'learning', dueDate: PAST }),
    ];
    const sorted = sortCardsForReview(cards, NOW);
    expect(sorted[0].id).toBe('learning');
  });

  it('returns empty array for empty input', () => {
    expect(sortCardsForReview([], NOW)).toEqual([]);
  });
});
