'use client';

/**
 * WeekView — 7-column layout with time slots for a single week.
 *
 * Layout:
 *   - Header row: day labels with week number displayed on the leftmost label
 *   - Left gutter: hour labels (00:00 – 23:00 in 1-hour increments)
 *   - 7 columns: one per day, each containing note cards positioned by time
 *     or stacked at the top when no time is available in the frontmatter
 *   - "Current time" indicator line on today's column
 *   - Clicking any column's header or empty area calls onDayClick
 *   - Clicking a note card calls onNoteClick
 *
 * Notes with no time component are rendered as all-day events at the top.
 */

import { useMemo } from 'react';
import type { CalendarNote } from './calendar-utils';
import { buildWeekDays, getISOWeekNumber, groupNotesByDate, noteColor } from './calendar-utils';

export interface WeekViewProps {
  /** Any date in the week to display (the view shows Mon–Sun of this week). */
  focusedDate: Date;
  /** Notes for the visible week range. */
  notes: CalendarNote[];
  /** Called when a day header or empty area is clicked. */
  onDayClick: (dateStr: string) => void;
  /** Called when a note card is clicked. */
  onNoteClick: (noteId: string) => void;
  /** Optional CSS class on the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT_PX = 48; // pixels per hour

// ---------------------------------------------------------------------------
// Time extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract an hour (0–23) and minute (0–59) from a note's frontmatter `time`
 * field (format "HH:MM" or "H:MM").
 * Returns null when no valid time is found.
 */
function extractTime(note: CalendarNote): { hour: number; minute: number } | null {
  const raw = note.id; // placeholder — actual access via frontmatter below
  void raw;

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
// NoteCard sub-component
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: CalendarNote;
  positioned: boolean; // true = absolutely positioned by time, false = all-day strip
  topPx?: number;
  heightPx?: number;
  onNoteClick: (noteId: string) => void;
}

function NoteCard({ note, positioned, topPx, heightPx, onNoteClick }: NoteCardProps) {
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

  const style: React.CSSProperties = positioned
    ? {
        position: 'absolute',
        top: topPx,
        left: 2,
        right: 2,
        height: heightPx,
        borderLeftColor: color,
        zIndex: 1,
      }
    : { borderLeftColor: color };

  return (
    <div
      role="button"
      tabIndex={0}
      style={style}
      className={[
        'overflow-hidden rounded-r-sm border-l-2 bg-surface-elevated px-1 py-0.5',
        'cursor-pointer text-[11px] leading-tight',
        'hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        positioned ? '' : 'mb-0.5',
      ]
        .filter(Boolean)
        .join(' ')}
      title={note.title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="block truncate font-medium text-foreground">{note.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayColumn sub-component
// ---------------------------------------------------------------------------

interface DayColumnProps {
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
  allDayNotes: CalendarNote[];
  timedNotes: Array<{ note: CalendarNote; hour: number; minute: number }>;
  onDayClick: (dateStr: string) => void;
  onNoteClick: (noteId: string) => void;
}

function DayColumn({
  dateStr,
  isToday,
  allDayNotes,
  timedNotes,
  onDayClick,
  onNoteClick,
}: DayColumnProps) {
  const totalHeight = HOURS.length * HOUR_HEIGHT_PX;

  // Current time indicator
  const now = new Date();
  const currentTimeTop = isToday
    ? ((now.getHours() * 60 + now.getMinutes()) / 1440) * totalHeight
    : null;

  const handleColumnClick = () => onDayClick(dateStr);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDayClick(dateStr);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col border-l border-border first:border-l-0">
      {/* All-day strip */}
      {allDayNotes.length > 0 && (
        <div className="border-b border-border px-0.5 py-0.5">
          {allDayNotes.map((n) => (
            <NoteCard key={n.id + n.date} note={n} positioned={false} onNoteClick={onNoteClick} />
          ))}
        </div>
      )}

      {/* Timed events area */}
      <div
        className="relative cursor-pointer"
        style={{ height: totalHeight }}
        role="button"
        tabIndex={0}
        onClick={handleColumnClick}
        onKeyDown={handleKeyDown}
        aria-label={`Open daily note for ${dateStr}`}
      >
        {/* Hour slot backgrounds */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute w-full border-b border-border/40"
            style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
          />
        ))}

        {/* Current time indicator */}
        {currentTimeTop !== null && (
          <div
            className="pointer-events-none absolute z-10 w-full border-t-2 border-primary"
            style={{ top: currentTimeTop }}
          >
            <span className="absolute -top-2 -left-1 h-3 w-3 rounded-full bg-primary" />
          </div>
        )}

        {/* Positioned note cards */}
        {timedNotes.map(({ note, hour, minute }) => {
          const topPx = ((hour * 60 + minute) / 60) * HOUR_HEIGHT_PX;
          return (
            <NoteCard
              key={note.id + note.date}
              note={note}
              positioned
              topPx={topPx}
              heightPx={HOUR_HEIGHT_PX - 4}
              onNoteClick={onNoteClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeekView
// ---------------------------------------------------------------------------

export function WeekView({
  focusedDate,
  notes,
  onDayClick,
  onNoteClick,
  className,
}: WeekViewProps) {
  const weekDays = buildWeekDays(focusedDate);
  const weekNumber = getISOWeekNumber(weekDays[0].date);
  const notesByDate = groupNotesByDate(notes);

  const dayColumns = useMemo(
    () =>
      weekDays.map((day) => {
        const dayNotes = notesByDate.get(day.dateStr) ?? [];
        const allDayNotes: CalendarNote[] = [];
        const timedNotes: Array<{ note: CalendarNote; hour: number; minute: number }> = [];

        for (const note of dayNotes) {
          const time = extractTime(note);
          if (time) {
            timedNotes.push({ note, ...time });
          } else {
            allDayNotes.push(note);
          }
        }

        timedNotes.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

        return { day, allDayNotes, timedNotes };
      }),
    [weekDays.map((d) => d.dateStr).join(','), notes],
  );

  return (
    <div
      className={['flex h-full flex-col overflow-hidden', className ?? ''].join(' ')}
      aria-label={`Week ${weekNumber} view`}
    >
      {/* Column headers */}
      <div className="flex border-b border-border">
        {/* Gutter header for hour labels */}
        <div className="w-12 shrink-0 border-r border-border text-right text-[10px] text-foreground-muted">
          <span className="pr-1 text-xs">W{weekNumber}</span>
        </div>

        {weekDays.map(({ dateStr, date, isToday, isWeekend }) => {
          const dayLabel = date.toLocaleString('en-US', { weekday: 'short' });
          const dayNum = date.getDate();
          return (
            <button
              key={dateStr}
              type="button"
              className={[
                'flex min-w-0 flex-1 flex-col items-center border-l border-border py-1',
                'text-xs font-medium hover:bg-surface-hover first:border-l-0',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                isWeekend ? 'text-foreground-muted' : 'text-foreground',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onDayClick(dateStr)}
            >
              <span className="text-[10px] uppercase tracking-wide">{dayLabel}</span>
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  isToday ? 'bg-primary text-primary-foreground' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Hour gutter */}
        <div className="w-12 shrink-0 border-r border-border">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end pr-1 text-[10px] text-foreground-muted"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1">
          {dayColumns.map(({ day, allDayNotes, timedNotes }) => (
            <DayColumn
              key={day.dateStr}
              dateStr={day.dateStr}
              isToday={day.isToday}
              isWeekend={day.isWeekend}
              allDayNotes={allDayNotes}
              timedNotes={timedNotes}
              onDayClick={onDayClick}
              onNoteClick={onNoteClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
