/**
 * DueCardsIndicator — Sidebar badge showing the total count of due cards.
 *
 * Renders a compact button with a badge count. Clicking it triggers the
 * host's review callback. Typically placed in the workspace sidebar or
 * status bar.
 *
 * The component subscribes to `dueCardIds` from the card store. The host
 * must call `refreshDueCards()` when notes change to keep the count fresh.
 */

import { useEffect, useCallback } from 'react';
import { useCardStore } from './card-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DueCardsIndicatorProps {
  /** Called when the user clicks the indicator to start a review. */
  onStartReview: () => void;
  /**
   * Optional label override.
   * Defaults to "N due" or "Review" when count is 0.
   */
  label?: string;
  /** Additional CSS class. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DueCardsIndicator({
  onStartReview,
  label,
  className = '',
}: DueCardsIndicatorProps) {
  const dueCardIds = useCardStore((s) => s.dueCardIds);
  const refreshDueCards = useCardStore((s) => s.refreshDueCards);

  // Refresh on mount and every minute
  useEffect(() => {
    refreshDueCards();
    const interval = setInterval(refreshDueCards, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshDueCards]);

  const count = dueCardIds.length;
  const hasDue = count > 0;

  const handleClick = useCallback(() => {
    onStartReview();
  }, [onStartReview]);

  const displayLabel = label ?? (hasDue ? `${count} due` : 'Review');

  return (
    <button
      className={`sr-due-indicator ${hasDue ? 'sr-due-indicator--active' : ''} ${className}`}
      onClick={handleClick}
      aria-label={hasDue ? `${count} flashcards due for review` : 'No flashcards due'}
      title={hasDue ? `${count} flashcards due for review` : 'No flashcards due'}
      data-testid="due-cards-indicator"
    >
      <span className="sr-due-indicator-icon" aria-hidden="true">
        📇
      </span>
      <span className="sr-due-indicator-label">{displayLabel}</span>
      {hasDue && (
        <span
          className="sr-due-badge sr-due-badge--pill"
          aria-hidden="true"
          data-testid="due-badge-count"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
