'use client';

/**
 * DailyNotesPanel — Sidebar panel for the Daily Notes plugin.
 *
 * Features:
 *   - "Today" button to jump to the current day
 *   - Previous/next day navigation arrows
 *   - Mini calendar (month grid) for quick date navigation
 *   - Quick links to the weekly and monthly periodic notes for the selected date
 *   - "Open note" / "Create note" action for the focused date
 *
 * This component is designed to run in both the host React tree (direct
 * embedding) and inside a sandboxed plugin iframe. When sandboxed, the
 * PluginContext is passed as a prop and used for all API calls.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { useDailyNotesStore } from './daily-notes-store';
import {
  formatDateYMD,
  formatRelativeDate,
  buildMonthGrid,
  addMonths,
  type CalendarGridDay,
} from './date-utils';
import { generateDailyNoteName } from './note-name-generator';
import { generateDailyNoteContent, getWeeklyPeriod, getMonthlyPeriod } from './periodic-notes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DailyNotesPanelProps {
  ctx: PluginContext;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NavButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function NavButton({ onClick, title, children, disabled = false }: NavButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-md text-sm',
        'text-foreground-muted transition-colors',
        'hover:bg-surface-hover hover:text-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mini calendar
// ---------------------------------------------------------------------------

interface MiniCalendarProps {
  displayMonth: Date;
  selectedDate: Date;
  today: Date;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function MiniCalendar({
  displayMonth,
  selectedDate,
  today,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MiniCalendarProps) {
  const grid = useMemo(
    () => buildMonthGrid(displayMonth.getFullYear(), displayMonth.getMonth()),
    [displayMonth],
  );

  const selectedStr = formatDateYMD(selectedDate);
  const todayStr = formatDateYMD(today);

  const monthLabel = displayMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dn-mini-cal px-3 pb-2 pt-1" aria-label="Mini calendar">
      {/* Month navigation */}
      <div className="mb-1 flex items-center justify-between">
        <NavButton onClick={onPrevMonth} title="Previous month">
          ‹
        </NavButton>
        <span className="text-xs font-semibold text-foreground">{monthLabel}</span>
        <NavButton onClick={onNextMonth} title="Next month">
          ›
        </NavButton>
      </div>

      {/* Weekday header */}
      <div className="mb-0.5 grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-0.5 text-[10px] font-medium text-foreground-muted">
            {label}
          </span>
        ))}
      </div>

      {/* Day grid */}
      {grid.map((week, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-7">
          {week.map((day: CalendarGridDay) => {
            const isSelected = day.dateStr === selectedStr;
            const isToday = day.dateStr === todayStr;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => onSelectDate(day.date)}
                title={day.dateStr}
                aria-label={day.dateStr}
                aria-pressed={isSelected}
                className={[
                  'flex h-6 w-full items-center justify-center rounded text-[11px]',
                  'transition-colors focus-visible:outline focus-visible:outline-2',
                  'focus-visible:outline-ring',
                  !day.isCurrentMonth && 'text-foreground-disabled',
                  day.isCurrentMonth && !isSelected && !isToday
                    ? 'text-foreground hover:bg-surface-hover'
                    : '',
                  isToday && !isSelected ? 'font-bold text-primary' : '',
                  isSelected
                    ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90'
                    : '',
                  day.isWeekend && !isSelected && day.isCurrentMonth ? 'text-foreground-muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {day.dayOfMonth}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Periodic note quick-link button
// ---------------------------------------------------------------------------

interface PeriodicLinkProps {
  label: string;
  path: string;
  onClick: () => void;
}

function PeriodicLink({ label, path, onClick }: PeriodicLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={path}
      className={[
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs',
        'text-foreground-muted transition-colors',
        'hover:bg-surface-hover hover:text-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function DailyNotesPanel({ ctx, className }: DailyNotesPanelProps) {
  const {
    currentDate,
    today,
    settings,
    isLoading,
    setCurrentDate,
    goToToday,
    goToPrevDay,
    goToNextDay,
  } = useDailyNotesStore();

  // The mini calendar displays a separate display month that can be navigated
  // independently (e.g., browsing future months without changing the selected date).
  const [displayMonth, setDisplayMonth] = useState(() => new Date(currentDate));

  // Keep display month in sync when currentDate changes via prev/next day buttons
  useEffect(() => {
    setDisplayMonth(new Date(currentDate));
  }, [currentDate]);

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth((prev) => addMonths(prev, -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleSelectDate = useCallback(
    (date: Date) => {
      setCurrentDate(date);
    },
    [setCurrentDate],
  );

  // Generate paths for quick links
  const dailyNoteName = useMemo(
    () => generateDailyNoteName(currentDate, settings.nameFormat, settings.folder),
    [currentDate, settings.nameFormat, settings.folder],
  );

  const weeklyPeriod = useMemo(
    () =>
      settings.weeklyEnabled
        ? getWeeklyPeriod(
            currentDate,
            settings.weeklyFormat,
            settings.weeklyFolder || settings.folder,
          )
        : null,
    [currentDate, settings],
  );

  const monthlyPeriod = useMemo(
    () =>
      settings.monthlyEnabled
        ? getMonthlyPeriod(
            currentDate,
            settings.monthlyFormat,
            settings.monthlyFolder || settings.folder,
          )
        : null,
    [currentDate, settings],
  );

  const currentDateStr = formatDateYMD(currentDate);
  const relativeLabel = useMemo(() => formatRelativeDate(currentDate, today), [currentDate, today]);

  const handleOpenOrCreateNote = useCallback(async () => {
    try {
      // Emit a navigation event — the host app handles note creation
      ctx.events.emit('daily-notes.open-note', {
        dateStr: currentDateStr,
        path: dailyNoteName.path,
        defaultContent: generateDailyNoteContent(currentDateStr),
      });
    } catch (_err) {
      // Non-fatal: the host may not have a handler registered yet
    }
  }, [ctx, currentDateStr, dailyNoteName.path]);

  const handleOpenWeeklyNote = useCallback(() => {
    if (!weeklyPeriod) return;
    ctx.events.emit('daily-notes.open-periodic-note', {
      type: 'weekly',
      path: weeklyPeriod.note.path,
      period: weeklyPeriod,
    });
  }, [ctx, weeklyPeriod]);

  const handleOpenMonthlyNote = useCallback(() => {
    if (!monthlyPeriod) return;
    ctx.events.emit('daily-notes.open-periodic-note', {
      type: 'monthly',
      path: monthlyPeriod.note.path,
      period: monthlyPeriod,
    });
  }, [ctx, monthlyPeriod]);

  const isCurrentDateToday = formatDateYMD(currentDate) === formatDateYMD(today);

  return (
    <div
      className={['flex h-full flex-col overflow-hidden text-sm', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-label="Daily Notes panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Daily Notes
        </span>
        <button
          type="button"
          onClick={goToToday}
          disabled={isCurrentDateToday}
          title="Go to today"
          className={[
            'rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
            isCurrentDateToday
              ? 'text-foreground-disabled cursor-default'
              : 'text-primary hover:bg-surface-hover',
          ].join(' ')}
        >
          Today
        </button>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <NavButton onClick={goToPrevDay} title="Previous day">
          ←
        </NavButton>

        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-foreground">{relativeLabel}</span>
          <span className="text-[10px] text-foreground-muted">{currentDateStr}</span>
        </div>

        <NavButton onClick={goToNextDay} title="Next day">
          →
        </NavButton>
      </div>

      {/* Open / create note button */}
      <div className="border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={handleOpenOrCreateNote}
          disabled={isLoading}
          className={[
            'w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold',
            'text-primary-foreground transition-colors',
            'hover:bg-primary/90 focus-visible:outline focus-visible:outline-2',
            'focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {isLoading ? 'Opening…' : `Open ${relativeLabel}'s Note`}
        </button>
      </div>

      {/* Mini calendar */}
      <div className="flex-1 overflow-y-auto">
        <MiniCalendar
          displayMonth={displayMonth}
          selectedDate={currentDate}
          today={today}
          onSelectDate={handleSelectDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        {/* Periodic note quick links */}
        {(weeklyPeriod || monthlyPeriod) && (
          <div className="border-t border-border px-1 py-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
              Periodic Notes
            </p>
            {weeklyPeriod && (
              <PeriodicLink
                label={weeklyPeriod.label}
                path={weeklyPeriod.note.path}
                onClick={handleOpenWeeklyNote}
              />
            )}
            {monthlyPeriod && (
              <PeriodicLink
                label={monthlyPeriod.label}
                path={monthlyPeriod.note.path}
                onClick={handleOpenMonthlyNote}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
