'use client';

/**
 * DayView — single day view with notes displayed in a timeline layout.
 *
 * Shows a full 24-hour column for the selected date with:
 *   - Hour grid lines in the left gutter
 *   - Note cards positioned by time when a `time` frontmatter field is present
 *   - All-day notes stacked above the timed grid
 *   - Current time indicator line
 *   - "Open / create daily note" button in the header
 *   - Tag color bar on each note card
 */

import type { CalendarNote } from './calendar-utils';
import { noteColor } from './calendar-utils';

export interface DayViewProps {
  /** ISO YYYY-MM-DD date string. */
  dateStr: string;
  /** Notes for this day. */
  notes: CalendarNote[];
  /** Called when the user clicks the daily note button or an empty hour slot. */
  onOpenDailyNote: (dateStr: string) => void;
  /** Called when a note card is clicked. */
  onNoteClick: (noteId: string) => void;
  /** Optional CSS class on root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT_PX = 56;

// ---------------------------------------------------------------------------
// Time extraction
// ---------------------------------------------------------------------------

function extractTime(note: CalendarNote): { hour: number; minute: number } | null {
  const timeVal = (note as unknown as { frontmatter?: Record<string, unknown> }).frontmatter?.[
    'time'
  ];
  if (typeof timeVal !== 'string') return null;
  const match = timeVal.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: CalendarNote;
  positioned: boolean;
  topPx?: number;
  onNoteClick: (noteId: string) => void;
}

function NoteCard({ note, positioned, topPx, onNoteClick }: NoteCardProps) {
  const color = noteColor(note);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNoteClick(note.id);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onNoteClick(note.id);
    }
  };

  const base = [
    'overflow-hidden rounded-r-md border-l-[3px] bg-surface-elevated px-2 py-1',
    'cursor-pointer shadow-sm transition-shadow hover:shadow-md',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
  ].join(' ');

  if (positioned) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`absolute left-2 right-2 ${base}`}
        style={{
          top: topPx,
          minHeight: HOUR_HEIGHT_PX - 8,
          borderLeftColor: color,
          zIndex: 1,
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={note.title}
      >
        <p className="truncate text-sm font-semibold text-foreground">{note.title}</p>
        {note.tags.length > 0 && (
          <p className="truncate text-[10px] text-foreground-muted">
            {note.tags
              .slice(0, 3)
              .map((t) => `#${t}`)
              .join(' ')}
          </p>
        )}
        {note.isRecurringInstance && <span className="text-[9px] text-primary">recurring</span>}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`mb-1.5 ${base}`}
      style={{ borderLeftColor: color }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={note.title}
    >
      <p className="truncate text-sm font-semibold text-foreground">{note.title}</p>
      {note.tags.length > 0 && (
        <p className="truncate text-[10px] text-foreground-muted">
          {note.tags
            .slice(0, 3)
            .map((t) => `#${t}`)
            .join(' ')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayView
// ---------------------------------------------------------------------------

export function DayView({ dateStr, notes, onOpenDailyNote, onNoteClick, className }: DayViewProps) {
  const now = new Date();
  const isToday =
    dateStr ===
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeTopPx = isToday
    ? ((now.getHours() * 60 + now.getMinutes()) / 1440) * HOURS.length * HOUR_HEIGHT_PX
    : null;

  // Split notes into all-day and timed
  const allDayNotes: CalendarNote[] = [];
  const timedNotes: Array<{ note: CalendarNote; hour: number; minute: number }> = [];

  for (const note of notes) {
    const time = extractTime(note);
    if (time) {
      timedNotes.push({ note, ...time });
    } else {
      allDayNotes.push(note);
    }
  }

  timedNotes.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const totalGridHeight = HOURS.length * HOUR_HEIGHT_PX;

  return (
    <div
      className={['flex h-full flex-col overflow-hidden', className ?? ''].join(' ')}
      aria-label={`Day view for ${dateStr}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <p className="text-sm font-medium text-foreground-muted">
            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
            })}
          </p>
          <p
            className={[
              'text-2xl font-bold leading-none',
              isToday ? 'text-primary' : 'text-foreground',
            ].join(' ')}
          >
            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => onOpenDailyNote(dateStr)}
        >
          {notes.some((n) => n.path.includes(dateStr)) ? 'Open daily note' : 'Create daily note'}
        </button>
      </div>

      {/* All-day section */}
      {allDayNotes.length > 0 && (
        <div className="border-b border-border bg-surface/50 px-4 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
            All day — {allDayNotes.length} note{allDayNotes.length !== 1 ? 's' : ''}
          </p>
          {allDayNotes.map((note) => (
            <NoteCard
              key={note.id + note.date}
              note={note}
              positioned={false}
              onNoteClick={onNoteClick}
            />
          ))}
        </div>
      )}

      {/* Timed grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Hour gutter */}
        <div className="w-14 shrink-0 border-r border-border">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end pr-2 text-[10px] text-foreground-muted"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
          ))}
        </div>

        {/* Events column */}
        <div
          className="relative flex-1 cursor-pointer"
          style={{ height: totalGridHeight }}
          role="button"
          tabIndex={0}
          onClick={() => onOpenDailyNote(dateStr)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenDailyNote(dateStr);
            }
          }}
          aria-label={`Click to open daily note for ${dateStr}`}
        >
          {/* Hour slot dividers */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute w-full border-b border-border/30"
              style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
            />
          ))}

          {/* Current time indicator */}
          {currentTimeTopPx !== null && (
            <div
              className="pointer-events-none absolute z-10 w-full border-t-2 border-primary"
              style={{ top: currentTimeTopPx }}
            >
              <span className="absolute -top-1.5 left-0 h-3 w-3 rounded-full bg-primary" />
            </div>
          )}

          {/* Timed note cards */}
          {timedNotes.map(({ note, hour, minute }) => (
            <NoteCard
              key={note.id + note.date}
              note={note}
              positioned
              topPx={((hour * 60 + minute) / 60) * HOUR_HEIGHT_PX}
              onNoteClick={onNoteClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
