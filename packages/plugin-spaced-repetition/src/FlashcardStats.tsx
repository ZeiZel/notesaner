/**
 * FlashcardStats — Statistics panel for a deck or the global collection.
 *
 * Displays:
 * - Overall retention rate
 * - Current review streak
 * - Card state distribution (new/learning/review/mastered)
 * - 7-day review forecast (how many cards become due each day)
 * - Recent review history (last 7 sessions summary)
 */

import { useMemo } from 'react';
import { useCardStore } from './card-store';
import type { Flashcard, DeckStats } from './card-store';
import { computeDeckStats } from './deck-manager';
import { isCardDue } from './sm2-algorithm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlashcardStatsProps {
  /** Show stats for a specific deck. null = global stats across all decks. */
  deckId?: string | null;
  /** Show the 7-day forecast panel. Default: true. */
  showForecast?: boolean;
}

interface ForecastDay {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Human-readable day label ("Today", "Tomorrow", "Mon", etc.). */
  label: string;
  /** Number of cards due on this day. */
  dueCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlashcardStats({ deckId = null, showForecast = true }: FlashcardStatsProps) {
  const allCards = useCardStore((s) => Object.values(s.cards));

  const cards = useMemo(
    () => (deckId ? allCards.filter((c) => c.deckId === deckId) : allCards),
    [allCards, deckId],
  );

  const stats = useMemo(() => computeDeckStats(cards), [cards]);

  const forecast = useMemo(
    () => (showForecast ? computeForecast(cards, 7) : []),
    [cards, showForecast],
  );

  const streak = useMemo(() => computeStreak(cards), [cards]);

  if (cards.length === 0) {
    return (
      <div className="sr-stats-empty" data-testid="flashcard-stats-empty">
        <p>No cards to show statistics for.</p>
      </div>
    );
  }

  const maxForecast = Math.max(...forecast.map((d) => d.dueCount), 1);

  return (
    <div className="sr-stats-panel" data-testid="flashcard-stats">
      {/* Summary row */}
      <div className="sr-stats-summary" aria-label="Summary statistics">
        <StatCard
          label="Retention Rate"
          value={`${stats.retentionRate}%`}
          description="Successful reviews / total reviews"
          highlight={stats.retentionRate >= 80}
        />
        <StatCard
          label="Streak"
          value={`${streak} days`}
          description="Consecutive days with at least one review"
          highlight={streak >= 7}
        />
        <StatCard
          label="Total Cards"
          value={String(stats.total)}
          description="All cards in this collection"
        />
        <StatCard
          label="Mastered"
          value={`${stats.masteredCount}`}
          description="Cards with interval ≥ 21 days"
          highlight={stats.masteredCount > 0}
        />
      </div>

      {/* State distribution */}
      <section className="sr-stats-section" aria-labelledby="distribution-title">
        <h3 id="distribution-title" className="sr-stats-section-title">
          Card Distribution
        </h3>
        <StateDistribution stats={stats} />
      </section>

      {/* Forecast */}
      {showForecast && forecast.length > 0 && (
        <section className="sr-stats-section" aria-labelledby="forecast-title">
          <h3 id="forecast-title" className="sr-stats-section-title">
            7-Day Forecast
          </h3>
          <div className="sr-forecast-chart" role="img" aria-label="7-day review forecast chart">
            {forecast.map((day) => {
              const height = maxForecast > 0 ? Math.round((day.dueCount / maxForecast) * 100) : 0;
              return (
                <div
                  key={day.date}
                  className="sr-forecast-bar-wrapper"
                  title={`${day.label}: ${day.dueCount} cards`}
                >
                  <div className="sr-forecast-count">{day.dueCount}</div>
                  <div
                    className="sr-forecast-bar"
                    style={{ height: `${Math.max(height, day.dueCount > 0 ? 4 : 0)}%` }}
                    aria-hidden="true"
                  />
                  <div className="sr-forecast-label">{day.label}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  description?: string;
  highlight?: boolean;
}

function StatCard({ label, value, description, highlight = false }: StatCardProps) {
  return (
    <div
      className={`sr-stat-card ${highlight ? 'sr-stat-card--highlight' : ''}`}
      data-testid="stat-card"
    >
      <div className="sr-stat-card-value" aria-label={`${label}: ${value}`}>
        {value}
      </div>
      <div className="sr-stat-card-label">{label}</div>
      {description && <div className="sr-stat-card-description">{description}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StateDistribution sub-component
// ---------------------------------------------------------------------------

interface StateDistributionProps {
  stats: DeckStats;
}

function StateDistribution({ stats }: StateDistributionProps) {
  const segments = [
    { label: 'New', count: stats.newCount, colorClass: 'sr-dist--new' },
    { label: 'Learning', count: stats.learningCount, colorClass: 'sr-dist--learning' },
    { label: 'Review', count: stats.reviewCount, colorClass: 'sr-dist--review' },
    { label: 'Mastered', count: stats.masteredCount, colorClass: 'sr-dist--mastered' },
  ].filter((s) => s.count > 0);

  const total = stats.total || 1;

  return (
    <div className="sr-distribution" data-testid="state-distribution">
      <div className="sr-distribution-bar" role="img" aria-label="Card state distribution">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`sr-distribution-segment ${seg.colorClass}`}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count} (${Math.round((seg.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <dl className="sr-distribution-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="sr-distribution-legend-item">
            <dt className={`sr-dist-dot ${seg.colorClass}`} />
            <dd>
              {seg.label}: {seg.count}
              <span className="sr-dist-pct"> ({Math.round((seg.count / total) * 100)}%)</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Computes how many cards are due each day for the next `days` days.
 *
 * @param cards - All cards to forecast.
 * @param days  - Number of days to forecast (inclusive of today).
 */
export function computeForecast(cards: Flashcard[], days: number): ForecastDay[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, i) => {
    const forecastDate = new Date(now);
    forecastDate.setDate(forecastDate.getDate() + i);
    const forecastIso = forecastDate.toISOString();

    const dueCount = cards.filter((card) => {
      if (card.dueDate === null) return i === 0; // new cards are due today
      const cardDueDate = new Date(card.dueDate);
      cardDueDate.setHours(0, 0, 0, 0);
      return cardDueDate.getTime() <= forecastDate.getTime();
    }).length;

    return {
      date: forecastIso.slice(0, 10),
      label: formatForecastLabel(i),
      dueCount,
    };
  });
}

function formatForecastLabel(dayOffset: number): string {
  if (dayOffset === 0) return 'Today';
  if (dayOffset === 1) return 'Tmrw';
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Computes the current consecutive-day review streak.
 *
 * A "streak day" counts if at least one card was reviewed on that calendar day.
 *
 * @param cards - All cards. Uses `lastReviewedAt` timestamps.
 * @returns Number of consecutive days with at least one review, ending today.
 */
export function computeStreak(cards: Flashcard[]): number {
  const reviewedDates = new Set<string>();

  for (const card of cards) {
    if (card.lastReviewedAt) {
      const day = card.lastReviewedAt.slice(0, 10); // YYYY-MM-DD
      reviewedDates.add(day);
    }
  }

  if (reviewedDates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const cursor = new Date(today);

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (reviewedDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Re-export for testability
export { isCardDue };
