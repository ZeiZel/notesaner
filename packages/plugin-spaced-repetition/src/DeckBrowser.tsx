/**
 * DeckBrowser — Lists all decks with statistics and review entry points.
 *
 * Shows for each deck:
 * - Name and description
 * - Card counts: new / learning / review / mastered
 * - Due count with visual indicator
 * - Last reviewed date
 * - "Start Review" button (disabled when no cards are due)
 * - Context menu: edit, delete
 */

import React, { useCallback, useMemo } from 'react';
import { useCardStore } from './card-store';
import type { Deck, DeckStats } from './card-store';
import { computeAllDeckStats } from './deck-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeckBrowserProps {
  /** Called when the user clicks "Start Review" on a deck. */
  onStartReview: (deckId: string) => void;
  /** Called when the user clicks "Start Review All". */
  onStartReviewAll?: () => void;
  /** Called when the user clicks "New Deck". */
  onCreateDeck?: () => void;
  /** Called when the user wants to edit a deck. */
  onEditDeck?: (deck: Deck) => void;
  /** Called when the user wants to delete a deck. */
  onDeleteDeck?: (deckId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeckBrowser({
  onStartReview,
  onStartReviewAll,
  onCreateDeck,
  onEditDeck,
  onDeleteDeck,
}: DeckBrowserProps) {
  const decks = useCardStore((s) => Object.values(s.decks));
  const cards = useCardStore((s) => Object.values(s.cards));
  const dueCardIds = useCardStore((s) => s.dueCardIds);
  const refreshDueCards = useCardStore((s) => s.refreshDueCards);

  // Refresh due cards on mount
  React.useEffect(() => {
    refreshDueCards();
  }, [refreshDueCards]);

  const deckStats = useMemo(() => computeAllDeckStats(decks, cards), [decks, cards]);

  const totalDue = dueCardIds.length;

  const handleDeleteDeck = useCallback(
    (deckId: string) => {
      onDeleteDeck?.(deckId);
    },
    [onDeleteDeck],
  );

  if (decks.length === 0) {
    return (
      <div className="sr-deck-browser sr-deck-browser--empty" data-testid="deck-browser">
        <div className="sr-empty-state">
          <div className="sr-empty-icon" aria-hidden="true">
            📚
          </div>
          <h2 className="sr-empty-title">No decks yet</h2>
          <p className="sr-empty-text">
            Create your first deck to start learning with spaced repetition.
          </p>
          {onCreateDeck && (
            <button
              className="sr-btn sr-btn-primary"
              onClick={onCreateDeck}
              data-testid="create-first-deck-btn"
            >
              Create Deck
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sr-deck-browser" data-testid="deck-browser">
      {/* Browser header */}
      <div className="sr-browser-header">
        <div className="sr-browser-title-row">
          <h1 className="sr-browser-title">My Decks</h1>
          {totalDue > 0 && (
            <span className="sr-due-badge sr-due-badge--large" aria-label={`${totalDue} cards due`}>
              {totalDue} due
            </span>
          )}
        </div>
        <div className="sr-browser-actions">
          {totalDue > 0 && onStartReviewAll && (
            <button
              className="sr-btn sr-btn-primary"
              onClick={onStartReviewAll}
              data-testid="review-all-btn"
            >
              Review All ({totalDue})
            </button>
          )}
          {onCreateDeck && (
            <button
              className="sr-btn sr-btn-secondary"
              onClick={onCreateDeck}
              data-testid="create-deck-btn"
            >
              + New Deck
            </button>
          )}
        </div>
      </div>

      {/* Deck list */}
      <ul className="sr-deck-list" role="list" aria-label="Decks">
        {deckStats.map(({ deck, stats }) => (
          <DeckRow
            key={deck.id}
            deck={deck}
            stats={stats}
            onStartReview={onStartReview}
            onEdit={onEditDeck ? () => onEditDeck(deck) : undefined}
            onDelete={onDeleteDeck ? () => handleDeleteDeck(deck.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeckRow
// ---------------------------------------------------------------------------

interface DeckRowProps {
  deck: Deck;
  stats: DeckStats;
  onStartReview: (deckId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function DeckRow({ deck, stats, onStartReview, onEdit, onDelete }: DeckRowProps) {
  const hasDue = stats.dueCount > 0;

  const lastReviewedText = deck.lastReviewedAt
    ? formatRelativeDate(deck.lastReviewedAt)
    : 'Never reviewed';

  return (
    <li className={`sr-deck-row ${hasDue ? 'sr-deck-row--has-due' : ''}`} data-testid="deck-row">
      <div className="sr-deck-info">
        <div className="sr-deck-name-row">
          <h2 className="sr-deck-name">{deck.name}</h2>
          {hasDue && (
            <span
              className="sr-due-badge"
              aria-label={`${stats.dueCount} cards due`}
              data-testid="due-badge"
            >
              {stats.dueCount} due
            </span>
          )}
        </div>
        {deck.description && <p className="sr-deck-description">{deck.description}</p>}
        <div className="sr-deck-counts" aria-label="Card counts by state">
          <StatPill label="New" count={stats.newCount} variant="new" />
          <StatPill label="Learning" count={stats.learningCount} variant="learning" />
          <StatPill label="Review" count={stats.reviewCount} variant="review" />
          <StatPill label="Mastered" count={stats.masteredCount} variant="mastered" />
        </div>
        <div className="sr-deck-meta">
          <span className="sr-deck-last-reviewed">{lastReviewedText}</span>
          {stats.retentionRate > 0 && (
            <span className="sr-deck-retention">{stats.retentionRate}% retention</span>
          )}
        </div>
      </div>

      <div className="sr-deck-actions">
        <button
          className="sr-btn sr-btn-primary sr-btn-sm"
          onClick={() => onStartReview(deck.id)}
          disabled={!hasDue}
          aria-label={hasDue ? `Start review for ${deck.name}` : `No cards due in ${deck.name}`}
          data-testid="start-review-btn"
        >
          {hasDue ? `Study (${stats.dueCount})` : 'Up to date'}
        </button>
        {(onEdit || onDelete) && <DeckMenu deck={deck} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// StatPill
// ---------------------------------------------------------------------------

interface StatPillProps {
  label: string;
  count: number;
  variant: 'new' | 'learning' | 'review' | 'mastered';
}

function StatPill({ label, count, variant }: StatPillProps) {
  return (
    <span
      className={`sr-stat-pill sr-stat-pill--${variant}`}
      title={`${count} ${label.toLowerCase()} cards`}
    >
      <span className="sr-stat-pill-count">{count}</span>
      <span className="sr-stat-pill-label">{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// DeckMenu (simple inline menu)
// ---------------------------------------------------------------------------

interface DeckMenuProps {
  deck: Deck;
  onEdit?: () => void;
  onDelete?: () => void;
}

function DeckMenu({ deck, onEdit, onDelete }: DeckMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="sr-deck-menu" ref={menuRef}>
      <button
        className="sr-btn sr-btn-ghost sr-btn-icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Deck options for ${deck.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="deck-menu-btn"
      >
        ···
      </button>
      {open && (
        <ul className="sr-menu" role="menu" data-testid="deck-menu">
          {onEdit && (
            <li role="none">
              <button
                className="sr-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                data-testid="deck-edit-btn"
              >
                Edit deck
              </button>
            </li>
          )}
          {onDelete && (
            <li role="none">
              <button
                className="sr-menu-item sr-menu-item--danger"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (window.confirm(`Delete deck "${deck.name}" and all its cards?`)) {
                    onDelete();
                  }
                }}
                data-testid="deck-delete-btn"
              >
                Delete deck
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
