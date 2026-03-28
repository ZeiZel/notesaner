/**
 * Zustand store for spaced repetition state.
 *
 * Responsibilities:
 * - Persist flashcard data, deck assignments, and scheduling metadata.
 * - Track review sessions: queue, current card, session statistics.
 * - Expose actions for card CRUD, review rating, and session management.
 *
 * The store uses `persist` middleware to survive page reloads. Scheduling
 * data (intervals, EF, due dates) is persisted; transient session state is
 * reset on load.
 *
 * Data flow:
 * - Host component creates cards from note parsing or user input.
 * - Store manages scheduling via SM-2 and tracks progress.
 * - ReviewSession component reads `reviewQueue` and `currentCard`.
 * - DeckBrowser and DueCardsIndicator read `decks` and `dueCards`.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { calculateNextReview, calculateDueDate, isCardDue, DEFAULT_EF } from './sm2-algorithm';
import type { ReviewQuality } from './sm2-algorithm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Card learning state following the Anki-style FSM. */
export type CardState = 'new' | 'learning' | 'review' | 'mastered';

/** An individual flashcard with all scheduling metadata. */
export interface Flashcard {
  /** Stable UUID for this card. */
  id: string;
  /** The deck this card belongs to. */
  deckId: string;
  /** Source note ID (for linking back to the note). */
  noteId: string;
  /** Front side of the card (question). */
  front: string;
  /** Back side of the card (answer). */
  back: string;
  /** Original markdown line number within the source note. */
  sourceLine: number;
  /** Card learning state. */
  state: CardState;
  /** Tags inherited from the note or added manually. */
  tags: string[];

  // SM-2 scheduling data
  /** Current interval in days. 0 for new/unreviewed cards. */
  interval: number;
  /** Current easiness factor. */
  easinessFactor: number;
  /** Number of successful repetitions in sequence. */
  repetitionCount: number;
  /** ISO timestamp of the next due date. null for new cards. */
  dueDate: string | null;
  /** ISO timestamp of the last review. null for new cards. */
  lastReviewedAt: string | null;
  /** Total number of reviews for this card. */
  totalReviews: number;
  /** Total number of successful reviews (quality >= 3). */
  successfulReviews: number;
}

/** A deck groups related flashcards, typically by note or tag. */
export interface Deck {
  /** Stable UUID for this deck. */
  id: string;
  /** Human-readable deck name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** ISO timestamp when the deck was created. */
  createdAt: string;
  /** ISO timestamp of the last review session. null if never reviewed. */
  lastReviewedAt: string | null;
  /** Note IDs associated with this deck. Empty for tag-based decks. */
  noteIds: string[];
  /** Tag used to group cards. Empty string for note-based decks. */
  tag: string;
}

/** Per-session statistics for a completed or in-progress review session. */
export interface SessionStats {
  /** Total cards in this session's queue. */
  total: number;
  /** Cards reviewed so far in this session. */
  reviewed: number;
  /** Count of Again/Hard responses (quality < 3). */
  failed: number;
  /** Count of Good/Easy/Perfect responses (quality >= 3). */
  passed: number;
  /** ISO timestamp when the session started. */
  startedAt: string;
  /** ISO timestamp when the session ended. null if still in progress. */
  endedAt: string | null;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface CardStoreState {
  /** All flashcards, indexed by card ID. */
  cards: Record<string, Flashcard>;
  /** All decks, indexed by deck ID. */
  decks: Record<string, Deck>;
  /** IDs of cards currently due for review, computed on demand. */
  dueCardIds: string[];
  /** Ordered IDs of cards in the current review queue. */
  reviewQueue: string[];
  /** ID of the card currently being reviewed. null between cards. */
  currentCardId: string | null;
  /** Whether the current card's back is revealed. */
  isRevealed: boolean;
  /** Statistics for the current or most recent session. */
  sessionStats: SessionStats | null;
  /** Whether a review session is currently active. */
  isSessionActive: boolean;
}

// ---------------------------------------------------------------------------
// Actions shape
// ---------------------------------------------------------------------------

export interface CardStoreActions {
  // Card CRUD
  /** Add a new card. If a card with the same id exists, it is replaced. */
  addCard(card: Flashcard): void;
  /** Update specific fields on an existing card. */
  updateCard(id: string, updates: Partial<Flashcard>): void;
  /** Remove a card by ID. */
  removeCard(id: string): void;
  /** Remove all cards belonging to a specific note. */
  removeCardsByNote(noteId: string): void;

  // Deck CRUD
  /** Add or replace a deck. */
  addDeck(deck: Deck): void;
  /** Update specific fields on an existing deck. */
  updateDeck(id: string, updates: Partial<Deck>): void;
  /** Remove a deck and all its cards. */
  removeDeck(id: string): void;

  // Review session
  /**
   * Start a review session for a given deck (or all decks if deckId is null).
   * Builds the review queue from due cards.
   */
  startSession(deckId: string | null): void;
  /** Reveal the back of the current card. */
  revealCard(): void;
  /**
   * Rate the current card and advance to the next.
   * Applies SM-2 scheduling and updates card state.
   */
  rateCard(quality: ReviewQuality): void;
  /** End the current session (e.g. user bails out early). */
  endSession(): void;

  // Computed helpers
  /** Recompute the dueCardIds list from current cards and their due dates. */
  refreshDueCards(): void;
  /** Returns a computed stats summary for a deck. */
  getDeckStats(deckId: string): DeckStats;
  /** Returns all cards belonging to a deck. */
  getCardsForDeck(deckId: string): Flashcard[];
  /** Returns the current card object, or null. */
  getCurrentCard(): Flashcard | null;
}

/** Computed statistics for a deck (not stored, always derived). */
export interface DeckStats {
  total: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  masteredCount: number;
  dueCount: number;
  retentionRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines the new CardState based on repetition count and EF.
 */
function deriveCardState(repetitionCount: number, interval: number): CardState {
  if (repetitionCount === 0) return 'new';
  if (interval < 7) return 'learning';
  if (interval >= 21) return 'mastered';
  return 'review';
}

function createEmptySessionStats(queueSize: number): SessionStats {
  return {
    total: queueSize,
    reviewed: 0,
    failed: 0,
    passed: 0,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCardStore = create<CardStoreState & CardStoreActions>()(
  devtools(
    persist(
      (set, get) => ({
        // ---------------------------------------------------------------------------
        // Initial state
        // ---------------------------------------------------------------------------
        cards: {},
        decks: {},
        dueCardIds: [],
        reviewQueue: [],
        currentCardId: null,
        isRevealed: false,
        sessionStats: null,
        isSessionActive: false,

        // ---------------------------------------------------------------------------
        // Card CRUD
        // ---------------------------------------------------------------------------

        addCard(card) {
          set((state) => ({ cards: { ...state.cards, [card.id]: card } }), false, 'addCard');
        },

        updateCard(id, updates) {
          set(
            (state) => {
              const existing = state.cards[id];
              if (!existing) return state;
              return {
                cards: {
                  ...state.cards,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateCard',
          );
        },

        removeCard(id) {
          set(
            (state) => {
              const { [id]: _removed, ...rest } = state.cards;
              return { cards: rest };
            },
            false,
            'removeCard',
          );
        },

        removeCardsByNote(noteId) {
          set(
            (state) => {
              const cards = Object.fromEntries(
                Object.entries(state.cards).filter(([, c]) => c.noteId !== noteId),
              );
              return { cards };
            },
            false,
            'removeCardsByNote',
          );
        },

        // ---------------------------------------------------------------------------
        // Deck CRUD
        // ---------------------------------------------------------------------------

        addDeck(deck) {
          set((state) => ({ decks: { ...state.decks, [deck.id]: deck } }), false, 'addDeck');
        },

        updateDeck(id, updates) {
          set(
            (state) => {
              const existing = state.decks[id];
              if (!existing) return state;
              return {
                decks: {
                  ...state.decks,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateDeck',
          );
        },

        removeDeck(id) {
          set(
            (state) => {
              const { [id]: _removed, ...decks } = state.decks;
              // Remove all cards belonging to this deck
              const cards = Object.fromEntries(
                Object.entries(state.cards).filter(([, c]) => c.deckId !== id),
              );
              return { decks, cards };
            },
            false,
            'removeDeck',
          );
        },

        // ---------------------------------------------------------------------------
        // Review session
        // ---------------------------------------------------------------------------

        startSession(deckId) {
          const { cards } = get();
          const now = new Date().toISOString();

          // Collect due cards, filtered by deck if specified
          const dueIds = Object.values(cards)
            .filter((card) => {
              if (deckId !== null && card.deckId !== deckId) return false;
              if (card.dueDate === null) return true; // new cards are always due
              return isCardDue(card.dueDate, now);
            })
            .map((card) => card.id);

          if (dueIds.length === 0) {
            set(
              {
                reviewQueue: [],
                currentCardId: null,
                isRevealed: false,
                sessionStats: createEmptySessionStats(0),
                isSessionActive: false,
              },
              false,
              'startSession/empty',
            );
            return;
          }

          // Shuffle the queue (new cards first, then due review cards)
          const newCards = dueIds.filter((id) => cards[id].state === 'new');
          const reviewCards = dueIds.filter((id) => cards[id].state !== 'new');
          const queue = [...newCards, ...reviewCards];

          set(
            {
              reviewQueue: queue,
              currentCardId: queue[0],
              isRevealed: false,
              sessionStats: createEmptySessionStats(queue.length),
              isSessionActive: true,
            },
            false,
            'startSession',
          );
        },

        revealCard() {
          set({ isRevealed: true }, false, 'revealCard');
        },

        rateCard(quality) {
          const { currentCardId, reviewQueue, cards, sessionStats } = get();
          if (!currentCardId) return;

          const card = cards[currentCardId];
          if (!card) return;

          const now = new Date().toISOString();
          const result = calculateNextReview({
            quality,
            previousInterval: card.interval,
            previousEF: card.easinessFactor,
            repetitionCount: card.repetitionCount,
          });

          const newDueDate = calculateDueDate(now, result.interval);
          const newState = deriveCardState(result.repetitionCount, result.interval);

          const updatedCard: Flashcard = {
            ...card,
            interval: result.interval,
            easinessFactor: result.easinessFactor,
            repetitionCount: result.repetitionCount,
            dueDate: newDueDate,
            lastReviewedAt: now,
            state: newState,
            totalReviews: card.totalReviews + 1,
            successfulReviews: card.successfulReviews + (result.successful ? 1 : 0),
          };

          // Advance queue
          const remainingQueue = reviewQueue.slice(1);

          // Re-queue failed cards at the end of the session (like Anki)
          if (!result.successful && remainingQueue.length > 0) {
            remainingQueue.push(currentCardId);
          }

          const nextCardId = remainingQueue.length > 0 ? remainingQueue[0] : null;

          const updatedStats: SessionStats | null = sessionStats
            ? {
                ...sessionStats,
                reviewed: sessionStats.reviewed + 1,
                passed: sessionStats.passed + (result.successful ? 1 : 0),
                failed: sessionStats.failed + (result.successful ? 0 : 1),
                endedAt: nextCardId === null ? now : null,
              }
            : null;

          set(
            {
              cards: { ...cards, [currentCardId]: updatedCard },
              reviewQueue: remainingQueue,
              currentCardId: nextCardId,
              isRevealed: false,
              sessionStats: updatedStats,
              isSessionActive: nextCardId !== null,
            },
            false,
            'rateCard',
          );

          // Refresh due cards list
          get().refreshDueCards();
        },

        endSession() {
          const now = new Date().toISOString();
          set(
            (state) => ({
              reviewQueue: [],
              currentCardId: null,
              isRevealed: false,
              isSessionActive: false,
              sessionStats: state.sessionStats ? { ...state.sessionStats, endedAt: now } : null,
            }),
            false,
            'endSession',
          );
        },

        // ---------------------------------------------------------------------------
        // Computed helpers
        // ---------------------------------------------------------------------------

        refreshDueCards() {
          const { cards } = get();
          const now = new Date().toISOString();
          const dueCardIds = Object.values(cards)
            .filter((card) => {
              if (card.dueDate === null) return true; // new cards always due
              return isCardDue(card.dueDate, now);
            })
            .map((card) => card.id);

          set({ dueCardIds }, false, 'refreshDueCards');
        },

        getDeckStats(deckId) {
          const { cards, dueCardIds } = get();
          const deckCards = Object.values(cards).filter((c) => c.deckId === deckId);
          const dueSet = new Set(dueCardIds);

          const stats: DeckStats = {
            total: deckCards.length,
            newCount: deckCards.filter((c) => c.state === 'new').length,
            learningCount: deckCards.filter((c) => c.state === 'learning').length,
            reviewCount: deckCards.filter((c) => c.state === 'review').length,
            masteredCount: deckCards.filter((c) => c.state === 'mastered').length,
            dueCount: deckCards.filter((c) => dueSet.has(c.id)).length,
            retentionRate: 0,
          };

          const reviewed = deckCards.filter((c) => c.totalReviews > 0);
          if (reviewed.length > 0) {
            const totalSuccessful = reviewed.reduce((sum, c) => sum + c.successfulReviews, 0);
            const totalAttempts = reviewed.reduce((sum, c) => sum + c.totalReviews, 0);
            stats.retentionRate =
              totalAttempts > 0 ? Math.round((totalSuccessful / totalAttempts) * 100) : 0;
          }

          return stats;
        },

        getCardsForDeck(deckId) {
          const { cards } = get();
          return Object.values(cards).filter((c) => c.deckId === deckId);
        },

        getCurrentCard() {
          const { currentCardId, cards } = get();
          if (!currentCardId) return null;
          return cards[currentCardId] ?? null;
        },
      }),
      {
        name: 'spaced-repetition-store',
        // Persist all state except transient session state
        partialize: (state) => ({
          cards: state.cards,
          decks: state.decks,
        }),
      },
    ),
    { name: 'spaced-repetition-store' },
  ),
);

// ---------------------------------------------------------------------------
// Factory helpers (not in store, used by callers)
// ---------------------------------------------------------------------------

let _idCounter = 0;

/** Generates a simple unique ID. In production, use crypto.randomUUID(). */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sr-${Date.now()}-${++_idCounter}`;
}

/**
 * Creates a new Flashcard with default scheduling values.
 */
export function createFlashcard(
  opts: Pick<Flashcard, 'deckId' | 'noteId' | 'front' | 'back' | 'tags'> &
    Partial<Pick<Flashcard, 'id' | 'sourceLine'>>,
): Flashcard {
  return {
    id: opts.id ?? generateId(),
    deckId: opts.deckId,
    noteId: opts.noteId,
    front: opts.front,
    back: opts.back,
    sourceLine: opts.sourceLine ?? 0,
    state: 'new',
    tags: opts.tags,
    interval: 0,
    easinessFactor: DEFAULT_EF,
    repetitionCount: 0,
    dueDate: null,
    lastReviewedAt: null,
    totalReviews: 0,
    successfulReviews: 0,
  };
}

/**
 * Creates a new Deck.
 */
export function createDeck(
  opts: Pick<Deck, 'name'> & Partial<Pick<Deck, 'id' | 'description' | 'noteIds' | 'tag'>>,
): Deck {
  return {
    id: opts.id ?? generateId(),
    name: opts.name,
    description: opts.description,
    createdAt: new Date().toISOString(),
    lastReviewedAt: null,
    noteIds: opts.noteIds ?? [],
    tag: opts.tag ?? '',
  };
}
