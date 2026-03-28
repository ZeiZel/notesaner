/**
 * ReviewSession — The core review UI component.
 *
 * Renders the current card's front, handles reveal, and collects the user's
 * quality rating. Drives progress through the session queue.
 *
 * Props:
 * - deckId: null means "review all due cards across all decks"
 * - onSessionComplete: called when the queue is exhausted
 * - onExit: called when the user chooses to exit early
 */

import React, { useCallback } from 'react';
import { useCardStore } from './card-store';
import type { ReviewQuality } from './sm2-algorithm';
import { hideClozeGroup } from './card-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewSessionProps {
  /** Deck to review. null = all decks. */
  deckId: string | null;
  /** Called when all cards in the queue have been rated. */
  onSessionComplete?: (stats: { total: number; passed: number; failed: number }) => void;
  /** Called when the user exits the session before completion. */
  onExit?: () => void;
}

/** Button configuration for rating a card. */
interface RatingButton {
  label: string;
  quality: ReviewQuality;
  colorClass: string;
  shortcut: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATING_BUTTONS: RatingButton[] = [
  { label: 'Again', quality: 0, colorClass: 'sr-btn-again', shortcut: '1' },
  { label: 'Hard', quality: 2, colorClass: 'sr-btn-hard', shortcut: '2' },
  { label: 'Good', quality: 3, colorClass: 'sr-btn-good', shortcut: '3' },
  { label: 'Easy', quality: 4, colorClass: 'sr-btn-easy', shortcut: '4' },
  { label: 'Perfect', quality: 5, colorClass: 'sr-btn-perfect', shortcut: '5' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewSession({ deckId, onSessionComplete, onExit }: ReviewSessionProps) {
  const currentCard = useCardStore((s) => s.getCurrentCard());
  const isRevealed = useCardStore((s) => s.isRevealed);
  const sessionStats = useCardStore((s) => s.sessionStats);
  const isSessionActive = useCardStore((s) => s.isSessionActive);
  const reviewQueue = useCardStore((s) => s.reviewQueue);
  const revealCard = useCardStore((s) => s.revealCard);
  const rateCard = useCardStore((s) => s.rateCard);
  const startSession = useCardStore((s) => s.startSession);
  const endSession = useCardStore((s) => s.endSession);

  // Start or restart the session
  React.useEffect(() => {
    startSession(deckId);
  }, [deckId]);

  // Notify parent when session completes
  React.useEffect(() => {
    if (sessionStats?.endedAt && !isSessionActive) {
      onSessionComplete?.({
        total: sessionStats.total,
        passed: sessionStats.passed,
        failed: sessionStats.failed,
      });
    }
  }, [sessionStats, isSessionActive, onSessionComplete]);

  // Keyboard shortcut handler
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!currentCard) return;

      if (!isRevealed) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          revealCard();
        }
        return;
      }

      const ratingKey = e.key;
      const button = RATING_BUTTONS.find((b) => b.shortcut === ratingKey);
      if (button) {
        e.preventDefault();
        rateCard(button.quality);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isRevealed, revealCard, rateCard]);

  const handleExit = useCallback(() => {
    endSession();
    onExit?.();
  }, [endSession, onExit]);

  const handleRate = useCallback(
    (quality: ReviewQuality) => {
      rateCard(quality);
    },
    [rateCard],
  );

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  // Session not yet started or no due cards
  if (!sessionStats) {
    return (
      <div className="sr-review-empty">
        <p>Loading review session...</p>
      </div>
    );
  }

  // Session complete
  if (sessionStats.endedAt || (!isSessionActive && sessionStats.reviewed > 0)) {
    return (
      <SessionComplete
        stats={sessionStats}
        onRestart={() => startSession(deckId)}
        onExit={handleExit}
      />
    );
  }

  // No cards due
  if (sessionStats.total === 0) {
    return (
      <div className="sr-review-empty">
        <div className="sr-review-empty-icon" aria-hidden="true">
          ✓
        </div>
        <h2 className="sr-review-empty-title">All caught up!</h2>
        <p className="sr-review-empty-text">No cards are due for review right now.</p>
        <button className="sr-btn sr-btn-secondary" onClick={handleExit}>
          Back to Decks
        </button>
      </div>
    );
  }

  // Active session — no current card (shouldn't happen but guard it)
  if (!currentCard) {
    return null;
  }

  // Determine display front: for cloze cards, hide the first cloze group
  const isCloze = currentCard.front.includes('{{');
  const firstClozeMatch = isCloze ? currentCard.front.match(/\{\{([a-zA-Z0-9]+)::/) : null;
  const displayFront =
    isCloze && firstClozeMatch
      ? hideClozeGroup(currentCard.front, firstClozeMatch[1])
      : currentCard.front;

  const progress =
    sessionStats.total > 0 ? Math.round((sessionStats.reviewed / sessionStats.total) * 100) : 0;

  const remaining = reviewQueue.length;

  return (
    <div className="sr-review-session" data-testid="review-session">
      {/* Header */}
      <div className="sr-review-header">
        <button
          className="sr-btn sr-btn-ghost sr-btn-exit"
          onClick={handleExit}
          aria-label="Exit review session"
        >
          ← Exit
        </button>
        <div className="sr-review-counters" aria-live="polite">
          <span className="sr-counter sr-counter-remaining">{remaining} remaining</span>
          <span className="sr-counter sr-counter-passed">{sessionStats.passed} passed</span>
          <span className="sr-counter sr-counter-failed">{sessionStats.failed} failed</span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="sr-progress-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Session progress"
      >
        <div className="sr-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card area */}
      <div className="sr-card-area">
        <div className={`sr-card ${isRevealed ? 'sr-card--revealed' : ''}`} data-testid="flashcard">
          {/* Front */}
          <div className="sr-card-front">
            <div className="sr-card-label">Question</div>
            <div className="sr-card-content" data-testid="card-front">
              {displayFront}
            </div>
            {currentCard.tags.length > 0 && (
              <div className="sr-card-tags" aria-label="Card tags">
                {currentCard.tags.map((tag) => (
                  <span key={tag} className="sr-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Back (revealed) */}
          {isRevealed && (
            <div className="sr-card-back" data-testid="card-back">
              <div className="sr-card-divider" aria-hidden="true" />
              <div className="sr-card-label">Answer</div>
              <div className="sr-card-content">{currentCard.back}</div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="sr-review-actions" data-testid="review-actions">
        {!isRevealed ? (
          <button className="sr-btn sr-btn-reveal" onClick={revealCard} data-testid="reveal-btn">
            Show Answer
            <span className="sr-shortcut-hint" aria-hidden="true">
              {' '}
              (Space)
            </span>
          </button>
        ) : (
          <div className="sr-rating-buttons" role="group" aria-label="Rate your recall">
            {RATING_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                className={`sr-btn ${btn.colorClass}`}
                onClick={() => handleRate(btn.quality)}
                data-testid={`rate-btn-${btn.label.toLowerCase()}`}
                aria-label={`${btn.label} (Press ${btn.shortcut})`}
              >
                {btn.label}
                <span className="sr-shortcut-hint" aria-hidden="true">
                  {' '}
                  ({btn.shortcut})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session complete screen
// ---------------------------------------------------------------------------

interface SessionCompleteProps {
  stats: {
    total: number;
    reviewed: number;
    passed: number;
    failed: number;
    startedAt: string;
    endedAt: string | null;
  };
  onRestart: () => void;
  onExit: () => void;
}

function SessionComplete({ stats, onRestart, onExit }: SessionCompleteProps) {
  const retentionRate = stats.reviewed > 0 ? Math.round((stats.passed / stats.reviewed) * 100) : 0;

  const durationMs = stats.endedAt
    ? new Date(stats.endedAt).getTime() - new Date(stats.startedAt).getTime()
    : 0;
  const durationMin = Math.round(durationMs / 1000 / 60);

  return (
    <div className="sr-session-complete" data-testid="session-complete">
      <div className="sr-session-complete-icon" aria-hidden="true">
        {retentionRate >= 80 ? '🎉' : retentionRate >= 60 ? '👍' : '📚'}
      </div>
      <h2 className="sr-session-complete-title">Session Complete!</h2>
      <dl className="sr-session-stats">
        <div className="sr-stat">
          <dt>Cards reviewed</dt>
          <dd>{stats.reviewed}</dd>
        </div>
        <div className="sr-stat sr-stat--success">
          <dt>Passed</dt>
          <dd>{stats.passed}</dd>
        </div>
        <div className="sr-stat sr-stat--failure">
          <dt>Failed</dt>
          <dd>{stats.failed}</dd>
        </div>
        <div className="sr-stat">
          <dt>Retention</dt>
          <dd>{retentionRate}%</dd>
        </div>
        {durationMin > 0 && (
          <div className="sr-stat">
            <dt>Duration</dt>
            <dd>{durationMin} min</dd>
          </div>
        )}
      </dl>
      <div className="sr-session-complete-actions">
        <button className="sr-btn sr-btn-primary" onClick={onRestart}>
          Review Again
        </button>
        <button className="sr-btn sr-btn-secondary" onClick={onExit}>
          Back to Decks
        </button>
      </div>
    </div>
  );
}
