'use client';

/**
 * CalendarView — main calendar component with Month/Week/Day/Timeline tabs.
 *
 * Responsibilities:
 *   - Owns the Zustand calendar store subscription
 *   - Fetches notes for the visible range via the plugin context API
 *   - Expands recurring note instances via expandRecurringNotes()
 *   - Renders the active view (MonthView, WeekView, DayView, TimelineView)
 *   - Provides the top toolbar: view tabs, prev/next/today navigation,
 *     current period label, and loading/error states
 *
 * Prop surface is intentionally minimal — all navigation state lives in the
 * Zustand store so sub-views can read it without prop drilling.
 */

import { useEffect, useCallback } from 'react';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { useCalendarStore, getVisibleRange } from './calendar-store';
import type { CalendarViewMode } from './calendar-store';
import {
  expandRecurringNotes,
  extractDateFromFrontmatter,
  formatMonthLabel,
  parseRecurrenceRule,
  toDateString,
} from './calendar-utils';
import type { CalendarNote } from './calendar-utils';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { TimelineView } from './TimelineView';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CalendarViewProps {
  /** Plugin context for API calls and navigation events. */
  ctx: PluginContext;
  /** Optional CSS class on the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEW_TABS: Array<{ mode: CalendarViewMode; label: string }> = [
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'day', label: 'Day' },
  { mode: 'timeline', label: 'Timeline' },
];

function periodLabel(viewMode: CalendarViewMode, focusedDate: Date): string {
  const year = focusedDate.getFullYear();
  const month = focusedDate.getMonth();
  switch (viewMode) {
    case 'month':
    case 'timeline':
      return formatMonthLabel(year, month);
    case 'week': {
      const dow = focusedDate.getDay() === 0 ? 6 : focusedDate.getDay() - 1;
      const monday = new Date(focusedDate);
      monday.setDate(focusedDate.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${year}`;
    }
    case 'day':
      return focusedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
  }
}

// ---------------------------------------------------------------------------
// Note transformation
// ---------------------------------------------------------------------------

/**
 * Map a PluginNote to a CalendarNote by resolving its date from frontmatter.
 * Returns null when the note has no resolvable date.
 */
function toCalendarNote(rawNote: {
  id: string;
  path: string;
  title: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  frontmatter: Record<string, unknown>;
}): CalendarNote | null {
  const date = extractDateFromFrontmatter(rawNote.frontmatter);
  if (!date) return null;

  const recurrence = parseRecurrenceRule(rawNote.frontmatter) ?? undefined;

  return {
    id: rawNote.id,
    title: rawNote.title,
    path: rawNote.path,
    date,
    tags: Array.isArray(rawNote.frontmatter['tags'])
      ? (rawNote.frontmatter['tags'] as string[])
      : [],
    createdAt: rawNote.createdAt,
    updatedAt: rawNote.updatedAt,
    recurrence,
  };
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView({ ctx, className }: CalendarViewProps) {
  const {
    viewMode,
    focusedDate,
    notes,
    isLoading,
    error,
    setViewMode,
    navigatePrev,
    navigateNext,
    navigateToday,
    setNotes,
    setLoading,
    setError,
    setFocusedDate,
  } = useCalendarStore();

  // -------------------------------------------------------------------------
  // Fetch notes whenever the visible range changes
  // -------------------------------------------------------------------------

  const fetchNotes = useCallback(
    async (rangeStart: string, rangeEnd: string) => {
      setLoading(true);
      setError(null);
      try {
        // Fetch a broad window around the range; the plugin notes.search API
        // does not natively support date range filtering, so we post-filter.
        const result = await ctx.notes.search({ query: '', limit: 500 });
        const calendarNotes: CalendarNote[] = [];
        for (const raw of result.notes) {
          const cn = toCalendarNote(raw as Parameters<typeof toCalendarNote>[0]);
          if (cn) calendarNotes.push(cn);
        }
        // Expand recurring instances across the visible range
        const expanded = expandRecurringNotes(calendarNotes, rangeStart, rangeEnd);
        setNotes(expanded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notes.');
      } finally {
        setLoading(false);
      }
    },
    // ctx is stable within a plugin lifecycle
    [],
  );

  useEffect(() => {
    const { start, end } = getVisibleRange(viewMode, focusedDate);
    void fetchNotes(start, end);
  }, [viewMode, focusedDate, fetchNotes]);

  // -------------------------------------------------------------------------
  // Navigation handlers
  // -------------------------------------------------------------------------

  const handleDayClick = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00');
      setFocusedDate(d);
      setViewMode('day');
    },
    [setFocusedDate, setViewMode],
  );

  const handleOpenDailyNote = useCallback(
    (dateStr: string) => {
      ctx.events.emit('calendar.open-daily-note', { dateStr });
    },
    [ctx.events],
  );

  const handleNoteClick = useCallback(
    (noteId: string) => {
      ctx.events.emit('navigation.open-note', { noteId });
    },
    [ctx.events],
  );

  // -------------------------------------------------------------------------
  // Derived values for the active view
  // -------------------------------------------------------------------------

  const year = focusedDate.getFullYear();
  const month = focusedDate.getMonth();
  const todayStr = toDateString(new Date());
  const isToday = toDateString(focusedDate) === todayStr;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className={[
        'flex h-full flex-col overflow-hidden bg-background text-foreground',
        className ?? '',
      ].join(' ')}
      aria-label="Calendar"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        {/* View mode tabs */}
        <div className="flex rounded-md border border-border bg-surface p-0.5" role="tablist">
          {VIEW_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              className={[
                'rounded px-3 py-1 text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                viewMode === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground-muted hover:text-foreground',
              ].join(' ')}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-foreground-muted hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={navigatePrev}
            aria-label="Previous period"
          >
            ‹
          </button>
          <button
            type="button"
            className={[
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              'hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
              isToday ? 'text-primary' : 'text-foreground-muted',
            ].join(' ')}
            onClick={navigateToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-foreground-muted hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={navigateNext}
            aria-label="Next period"
          >
            ›
          </button>
        </div>

        {/* Period label */}
        <p className="text-sm font-semibold text-foreground">
          {periodLabel(viewMode, focusedDate)}
        </p>

        {/* Loading indicator */}
        {isLoading && (
          <span className="ml-auto text-xs text-foreground-muted" aria-live="polite">
            Loading…
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error banner                                                         */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div
          className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* View area                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {viewMode === 'month' && (
          <MonthView year={year} month={month} notes={notes} onDayClick={handleDayClick} />
        )}

        {viewMode === 'week' && (
          <WeekView
            focusedDate={focusedDate}
            notes={notes}
            onDayClick={handleDayClick}
            onNoteClick={handleNoteClick}
          />
        )}

        {viewMode === 'day' && (
          <DayView
            dateStr={toDateString(focusedDate)}
            notes={notes}
            onOpenDailyNote={handleOpenDailyNote}
            onNoteClick={handleNoteClick}
          />
        )}

        {viewMode === 'timeline' && (
          <TimelineView notes={notes} onNoteClick={handleNoteClick} onDayClick={handleDayClick} />
        )}
      </div>
    </div>
  );
}
