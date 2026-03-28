'use client';

/**
 * TimelineView — chronological list of notes for the current month.
 *
 * Renders notes sorted oldest-first, grouped by date. Each date group shows
 * a sticky date header and the notes underneath. Each note card shows:
 *   - Tag color bar on the left
 *   - Title
 *   - Tag chips
 *   - Recurring indicator when the note is a virtual recurrence instance
 *
 * Clicking a note card calls onNoteClick.
 * Clicking a date header calls onDayClick (to switch to DayView for that date).
 */

import type { CalendarNote } from './calendar-utils';
import { sortNotesByDate, noteColor } from './calendar-utils';

export interface TimelineViewProps {
  /** Notes already expanded for the visible range. */
  notes: CalendarNote[];
  /** Called when a note card is clicked. */
  onNoteClick: (noteId: string) => void;
  /** Called when a date header is clicked. */
  onDayClick: (dateStr: string) => void;
  /** Optional CSS class on root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

interface TimelineNoteCardProps {
  note: CalendarNote;
  onNoteClick: (noteId: string) => void;
}

function TimelineNoteCard({ note, onNoteClick }: TimelineNoteCardProps) {
  const color = noteColor(note);

  const handleClick = () => onNoteClick(note.id);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNoteClick(note.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-focus hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={note.title}
    >
      {/* Color bar */}
      <div
        className="mt-0.5 h-full w-1 shrink-0 rounded-full"
        style={{ backgroundColor: color, minHeight: 20 }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
            {note.title}
          </p>
          {note.isRecurringInstance && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-semibold text-primary">
              recurring
            </span>
          )}
        </div>

        {/* Path */}
        <p className="mt-0.5 truncate text-[11px] text-foreground-muted">{note.path}</p>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {note.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-1.5 py-px text-[9px] font-medium"
                style={{
                  backgroundColor: `${noteColor({ ...note, tags: [tag] })}20`,
                  color: noteColor({ ...note, tags: [tag] }),
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <time className="shrink-0 text-[10px] text-foreground-muted" dateTime={note.updatedAt}>
        {new Date(note.updatedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </time>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineView
// ---------------------------------------------------------------------------

export function TimelineView({ notes, onNoteClick, onDayClick, className }: TimelineViewProps) {
  const sorted = sortNotesByDate(notes);

  if (sorted.length === 0) {
    return (
      <div
        className={[
          'flex flex-col items-center justify-center gap-3 py-16 text-foreground-muted',
          className ?? '',
        ].join(' ')}
      >
        <span className="text-4xl" aria-hidden="true">
          📅
        </span>
        <p className="text-sm font-medium">No notes scheduled for this period.</p>
        <p className="text-xs">
          Add a <code className="rounded bg-surface-elevated px-1 py-px text-xs">date</code> field
          to a note's frontmatter to see it here.
        </p>
      </div>
    );
  }

  // Group into date buckets (already sorted)
  const groups: Array<{ dateStr: string; notes: CalendarNote[] }> = [];
  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.dateStr === note.date) {
      last.notes.push(note);
    } else {
      groups.push({ dateStr: note.date, notes: [note] });
    }
  }

  return (
    <div
      className={['flex flex-col overflow-y-auto', className ?? ''].join(' ')}
      aria-label="Timeline view"
    >
      {groups.map(({ dateStr, notes: groupNotes }) => {
        const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <div key={dateStr} className="mb-6">
            {/* Sticky date header */}
            <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 bg-background/90 py-1 backdrop-blur-sm">
              <button
                type="button"
                className="text-sm font-semibold text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onDayClick(dateStr)}
              >
                {displayDate}
              </button>
              <span className="text-xs text-foreground-muted">
                {groupNotes.length} note{groupNotes.length !== 1 ? 's' : ''}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 px-1">
              {groupNotes.map((note) => (
                <TimelineNoteCard key={note.id + note.date} note={note} onNoteClick={onNoteClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
