/**
 * Deck management utilities.
 *
 * These are pure functions that operate on Deck and Flashcard data.
 * They do NOT interact with the store directly; callers are responsible
 * for committing the results to the store.
 *
 * Responsibilities:
 * - Create decks from a note or a tag.
 * - Merge two or more decks.
 * - Compute aggregated deck statistics.
 */

import type { Deck, Flashcard, DeckStats } from './card-store';
import { generateId, createDeck } from './card-store';
import { isCardDue } from './sm2-algorithm';

// ---------------------------------------------------------------------------
// Deck creation
// ---------------------------------------------------------------------------

/**
 * Creates a deck scoped to a single note.
 *
 * @param noteId  - Stable ID of the source note.
 * @param noteName - Display name for the deck (usually the note title).
 * @returns A new Deck (not yet added to the store).
 */
export function createDeckFromNote(noteId: string, noteName: string): Deck {
  return createDeck({
    id: generateId(),
    name: noteName,
    description: `Flashcards from note: ${noteName}`,
    noteIds: [noteId],
    tag: '',
  });
}

/**
 * Creates a deck that groups cards by a shared tag.
 *
 * @param tag       - The tag used to filter cards into this deck.
 * @param deckName  - Human-readable deck name.
 * @returns A new Deck (not yet added to the store).
 */
export function createDeckFromTag(tag: string, deckName?: string): Deck {
  return createDeck({
    id: generateId(),
    name: deckName ?? `#${tag}`,
    description: `Flashcards tagged with #${tag}`,
    noteIds: [],
    tag,
  });
}

// ---------------------------------------------------------------------------
// Deck merging
// ---------------------------------------------------------------------------

/**
 * Merges two or more decks into a single new deck.
 *
 * The merged deck inherits the combined noteIds and an empty tag
 * (since merged decks typically transcend any single tag).
 *
 * Cards are NOT moved automatically — the caller must reassign card.deckId
 * to the merged deck's ID using `reassignCardsToDeck`.
 *
 * @param decks    - Two or more decks to merge (must have at least 2).
 * @param newName  - Name for the merged deck.
 * @returns A new merged Deck.
 * @throws Error if fewer than 2 decks are provided.
 */
export function mergeDecks(decks: Deck[], newName: string): Deck {
  if (decks.length < 2) {
    throw new Error('mergeDecks requires at least 2 decks');
  }

  const allNoteIds = Array.from(new Set(decks.flatMap((d) => d.noteIds)));

  const lastReviewedDates = decks
    .map((d) => d.lastReviewedAt)
    .filter((d): d is string => d !== null)
    .sort();

  const latestReview =
    lastReviewedDates.length > 0 ? lastReviewedDates[lastReviewedDates.length - 1] : null;

  return {
    id: generateId(),
    name: newName,
    description: `Merged deck from: ${decks.map((d) => d.name).join(', ')}`,
    createdAt: new Date().toISOString(),
    lastReviewedAt: latestReview,
    noteIds: allNoteIds,
    tag: '',
  };
}

/**
 * Returns new card objects with their deckId reassigned to the given deck.
 *
 * This is a pure function — it does not mutate the input cards.
 * Use the result to update the store.
 *
 * @param cards    - Cards to reassign.
 * @param newDeckId - Target deck ID.
 */
export function reassignCardsToDeck(cards: Flashcard[], newDeckId: string): Flashcard[] {
  return cards.map((card) => ({ ...card, deckId: newDeckId }));
}

// ---------------------------------------------------------------------------
// Deck statistics
// ---------------------------------------------------------------------------

/**
 * Computes a DeckStats object for the given deck and its cards.
 *
 * This is a standalone function (separate from the store's getDeckStats)
 * that can be used in contexts without store access (e.g., unit tests,
 * server-side rendering).
 *
 * @param cards - All cards belonging to the deck.
 * @param now   - Optional ISO timestamp for "now" (defaults to Date.now()).
 */
export function computeDeckStats(cards: Flashcard[], now?: string): DeckStats {
  const currentNow = now ?? new Date().toISOString();

  const dueCount = cards.filter((c) => {
    if (c.dueDate === null) return true; // new cards always due
    return isCardDue(c.dueDate, currentNow);
  }).length;

  const reviewed = cards.filter((c) => c.totalReviews > 0);
  let retentionRate = 0;

  if (reviewed.length > 0) {
    const totalSuccessful = reviewed.reduce((sum, c) => sum + c.successfulReviews, 0);
    const totalAttempts = reviewed.reduce((sum, c) => sum + c.totalReviews, 0);
    retentionRate = totalAttempts > 0 ? Math.round((totalSuccessful / totalAttempts) * 100) : 0;
  }

  return {
    total: cards.length,
    newCount: cards.filter((c) => c.state === 'new').length,
    learningCount: cards.filter((c) => c.state === 'learning').length,
    reviewCount: cards.filter((c) => c.state === 'review').length,
    masteredCount: cards.filter((c) => c.state === 'mastered').length,
    dueCount,
    retentionRate,
  };
}

/**
 * Returns a summary of all decks with their computed stats.
 *
 * @param decks  - All decks.
 * @param cards  - All cards (across all decks).
 * @param now    - Optional ISO timestamp for due-date checks.
 */
export function computeAllDeckStats(
  decks: Deck[],
  cards: Flashcard[],
  now?: string,
): Array<{ deck: Deck; stats: DeckStats }> {
  const cardsByDeck = new Map<string, Flashcard[]>();
  for (const card of cards) {
    const existing = cardsByDeck.get(card.deckId) ?? [];
    existing.push(card);
    cardsByDeck.set(card.deckId, existing);
  }

  return decks.map((deck) => ({
    deck,
    stats: computeDeckStats(cardsByDeck.get(deck.id) ?? [], now),
  }));
}

/**
 * Returns the total number of due cards across all decks.
 *
 * @param cards - All cards.
 * @param now   - Optional ISO timestamp for due-date checks.
 */
export function countTotalDueCards(cards: Flashcard[], now?: string): number {
  const currentNow = now ?? new Date().toISOString();
  return cards.filter((c) => {
    if (c.dueDate === null) return true;
    return isCardDue(c.dueDate, currentNow);
  }).length;
}

/**
 * Sorts cards within a deck for optimal review ordering:
 * 1. New cards first
 * 2. Learning cards second
 * 3. Review cards (by overdue amount — most overdue first)
 * 4. Mastered cards last (by overdue amount — most overdue first)
 *
 * @param cards - Cards to sort.
 * @param now   - Optional ISO timestamp for overdue calculation.
 */
export function sortCardsForReview(cards: Flashcard[], now?: string): Flashcard[] {
  const currentNow = now ? new Date(now).getTime() : Date.now();

  return [...cards].sort((a, b) => {
    const aPriority = getReviewPriority(a, currentNow);
    const bPriority = getReviewPriority(b, currentNow);
    if (aPriority !== bPriority) return aPriority - bPriority;
    // Within the same tier, sort most-overdue first
    const aOverdue = a.dueDate
      ? currentNow - new Date(a.dueDate).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bOverdue = b.dueDate
      ? currentNow - new Date(b.dueDate).getTime()
      : Number.MAX_SAFE_INTEGER;
    return bOverdue - aOverdue; // descending: most overdue first
  });
}

/**
 * Returns a numeric priority tier for a card.
 * Lower number = higher priority (sorted first).
 *
 * Tier 1 (0): new cards
 * Tier 2 (1): learning cards
 * Tier 3 (2): review cards
 * Tier 4 (3): mastered cards
 */
function getReviewPriority(card: Flashcard, _nowMs: number): number {
  switch (card.state) {
    case 'new':
      return 0;
    case 'learning':
      return 1;
    case 'review':
      return 2;
    case 'mastered':
      return 3;
  }
}
