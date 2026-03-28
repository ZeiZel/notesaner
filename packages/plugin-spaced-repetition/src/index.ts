export const PLUGIN_ID = 'spaced-repetition';

// ---------------------------------------------------------------------------
// SM-2 algorithm — pure functions, no side effects
// ---------------------------------------------------------------------------
export {
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
} from './sm2-algorithm';
export type { ReviewQuality, SM2Input, SM2Result } from './sm2-algorithm';

// ---------------------------------------------------------------------------
// Card parser — parse markdown for flashcard syntax
// ---------------------------------------------------------------------------
export {
  parseCardsFromMarkdown,
  extractClozeMarkers,
  revealAllCloze,
  hideClozeGroup,
  selectionToCard,
  serializeInlineCard,
  serializeBlockCard,
} from './card-parser';
export type { CardType, ClozeMarker, ParsedCard } from './card-parser';

// ---------------------------------------------------------------------------
// Card store — Zustand state management
// ---------------------------------------------------------------------------
export { useCardStore, createFlashcard, createDeck, generateId } from './card-store';
export type {
  CardState,
  Flashcard,
  Deck,
  SessionStats,
  CardStoreState,
  CardStoreActions,
  DeckStats,
} from './card-store';

// ---------------------------------------------------------------------------
// Deck manager — pure deck operations and statistics
// ---------------------------------------------------------------------------
export {
  createDeckFromNote,
  createDeckFromTag,
  mergeDecks,
  reassignCardsToDeck,
  computeDeckStats,
  computeAllDeckStats,
  countTotalDueCards,
  sortCardsForReview,
} from './deck-manager';

// ---------------------------------------------------------------------------
// React components
// ---------------------------------------------------------------------------
export { ReviewSession } from './ReviewSession';
export type { ReviewSessionProps } from './ReviewSession';

export { CardEditor } from './CardEditor';
export type { CardEditorProps } from './CardEditor';

export { DeckBrowser } from './DeckBrowser';
export type { DeckBrowserProps } from './DeckBrowser';

export { DueCardsIndicator } from './DueCardsIndicator';
export type { DueCardsIndicatorProps } from './DueCardsIndicator';

export { FlashcardStats, computeForecast, computeStreak } from './FlashcardStats';
export type { FlashcardStatsProps } from './FlashcardStats';
