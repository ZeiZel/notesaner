'use client';

/**
 * MonthView — monthly calendar grid with note dots on dates.
 *
 * Renders a 6-row × 7-col ISO-week-aligned grid. Each cell shows:
 *   - Day number
 *   - ISO week number on the first column (Monday)
 *   - Color-coded dots for notes scheduled that day (up to 3 + overflow count)
 *   - "today" ring highlight
 *   - Dimmed appearance for days outside the displayed month
 *
 * Clicking any cell calls onDayClick, allowing the parent to navigate to
 * that day's daily note or open DayView.
 */

import type { CalendarDay, CalendarNote } from './calendar-utils';
import {
  buildMonthGrid,
  getISOWeekNumber,
  groupNotesByDate,
  noteColor,
  weekdayLabels,
} from './calendar-utils';

export interface MonthViewProps {
  /** Full year, e.g. 2026 */
  year: number;
  /** Zero-based month index (0 = Jan, 11 = Dec) */
  month: number;
  /** Notes to display on the grid (already filtered for the month's range). */
  notes: CalendarNote[];
  /** Called when the user clicks on a day cell. */
  onDayClick: (dateStr: string) => void;
  /** Optional CSS class applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// NoteDots sub-component
// ---------------------------------------------------------------------------

const MAX_VISIBLE_DOTS = 3;

interface NoteDotsProps {
  notes: CalendarNote[];
}

function NoteDots({ notes }: NoteDotsProps) {
  if (notes.length === 0) return null;

  const visible = notes.slice(0, MAX_VISIBLE_DOTS);
  const overflow = notes.length - MAX_VISIBLE_DOTS;

  return (
    <div className="mt-0.5 flex items-center gap-0.5 px-0.5">
      {visible.map((note) => (
        <span
          key={note.id + note.date}
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: noteColor(note) }}
          title={note.title}
          aria-hidden="true"
        />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] leading-none text-foreground-muted">+{overflow}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayCell sub-component
// ---------------------------------------------------------------------------

interface DayCellProps {
  day: CalendarDay;
  notes: CalendarNote[];
  weekNumber: number | null; // ISO week number; only set on the first col (Monday)
  onDayClick: (dateStr: string) => void;
}

function DayCell({ day, notes, weekNumber, onDayClick }: DayCellProps) {
  const handleClick = () => onDayClick(day.dateStr);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDayClick(day.dateStr);
    }
  };

  return (
    <div className="relative flex flex-col">
      {/* ISO week number label (only on Monday column) */}
      {weekNumber !== null && (
        <span
          className="absolute -left-7 top-1 w-6 text-center text-[10px] text-foreground-muted select-none"
          title={`Week ${weekNumber}`}
          aria-label={`Week ${weekNumber}`}
        >
          {weekNumber}
        </span>
      )}

      {/* Day cell */}
      <div
        role="button"
        tabIndex={0}
        className={[
          'flex min-h-[72px] cursor-pointer flex-col rounded-md border p-1 text-sm transition-colors',
          'hover:border-border-focus hover:bg-surface-hover',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          day.isCurrentMonth
            ? 'border-border bg-surface'
            : 'border-transparent bg-transparent opacity-40',
          day.isToday ? 'ring-2 ring-primary ring-offset-1' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${day.dateStr}${notes.length > 0 ? `, ${notes.length} note${notes.length !== 1 ? 's' : ''}` : ''}`}
      >
        <span
          className={[
            'ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium leading-none',
            day.isToday
              ? 'bg-primary text-primary-foreground'
              : day.isWeekend && day.isCurrentMonth
                ? 'text-foreground-muted'
                : 'text-foreground',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {day.dayOfMonth}
        </span>
        <NoteDots notes={notes} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthView
// ---------------------------------------------------------------------------

export function MonthView({ year, month, notes, onDayClick, className }: MonthViewProps) {
  const grid = buildMonthGrid(year, month);
  const notesByDate = groupNotesByDate(notes);
  const dayLabels = weekdayLabels();

  return (
    <div
      className={['w-full select-none', className ?? ''].join(' ')}
      aria-label={`Month view for ${year}-${String(month + 1).padStart(2, '0')}`}
    >
      {/* Week number column header + day-of-week headers */}
      <div className="mb-1 ml-7 grid grid-cols-7 gap-1">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium uppercase tracking-wide text-foreground-muted"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar rows */}
      <div className="ml-7 flex flex-col gap-1">
        {grid.map((week) => {
          const mondayDate = week[0].date;
          const weekNumber = getISOWeekNumber(mondayDate);

          return (
            <div key={week[0].dateStr} className="relative grid grid-cols-7 gap-1">
              {week.map((day, colIdx) => (
                <DayCell
                  key={day.dateStr}
                  day={day}
                  notes={notesByDate.get(day.dateStr) ?? []}
                  weekNumber={colIdx === 0 ? weekNumber : null}
                  onDayClick={onDayClick}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
