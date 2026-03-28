'use client';

/**
 * DailyNotesBanner — Top banner component for the Daily Notes plugin.
 *
 * Shows today's daily note status (exists / not created yet) and provides
 * a quick "Open" or "Create" button. Intended to be displayed at the top of
 * the workspace view on startup when autoCreate is disabled.
 *
 * The banner is dismissible and remembers the dismissed state per-session
 * (not persisted across reloads).
 */

import { useCallback, useEffect, useState } from 'react';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { useDailyNotesStore } from './daily-notes-store';
import { formatDateYMD, formatRelativeDate } from './date-utils';
import { generateDailyNoteName } from './note-name-generator';
import { generateDailyNoteContent } from './periodic-notes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NoteExistenceStatus = 'unknown' | 'exists' | 'missing';

export interface DailyNotesBannerProps {
  ctx: PluginContext;
  /** Override class applied to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyNotesBanner({ ctx, className }: DailyNotesBannerProps) {
  const { today, settings, isLoading, setLoading, setError } = useDailyNotesStore();

  const [dismissed, setDismissed] = useState(false);
  const [noteStatus, setNoteStatus] = useState<NoteExistenceStatus>('unknown');

  const todayStr = formatDateYMD(today);
  const noteName = generateDailyNoteName(today, settings.nameFormat, settings.folder);
  const relativeLabel = formatRelativeDate(today, today); // always "Today" for the banner

  // Check whether today's note exists by searching for it
  useEffect(() => {
    let cancelled = false;

    async function checkNoteExists(): Promise<void> {
      try {
        const result = await ctx.notes.search({
          query: noteName.title,
          folder: settings.folder || undefined,
          limit: 5,
        });
        if (cancelled) return;

        const found = result.notes.some(
          (n) =>
            n.path === noteName.path ||
            n.path.endsWith(noteName.filename) ||
            n.title === noteName.title,
        );
        setNoteStatus(found ? 'exists' : 'missing');
      } catch {
        if (!cancelled) setNoteStatus('unknown');
      }
    }

    void checkNoteExists();

    return () => {
      cancelled = true;
    };
  }, [ctx, todayStr, noteName.path, noteName.filename, noteName.title, settings.folder]);

  const handleOpenOrCreate = useCallback(async () => {
    setLoading(true);
    try {
      ctx.events.emit('daily-notes.open-note', {
        dateStr: todayStr,
        path: noteName.path,
        defaultContent: generateDailyNoteContent(todayStr),
      });
      setDismissed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open daily note.');
    } finally {
      setLoading(false);
    }
  }, [ctx, todayStr, noteName.path, setLoading, setError]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render if dismissed
  if (dismissed) return null;

  const actionLabel =
    noteStatus === 'exists' ? `Open ${relativeLabel}'s Note` : `Create ${relativeLabel}'s Note`;

  const statusColor =
    noteStatus === 'exists'
      ? 'bg-success/10 border-success/20 text-success-foreground'
      : noteStatus === 'missing'
        ? 'bg-primary/5 border-primary/15 text-foreground'
        : 'bg-surface-elevated border-border text-foreground-muted';

  return (
    <div
      role="banner"
      aria-label="Daily note banner"
      className={[
        'flex items-center justify-between rounded-lg border px-4 py-2.5',
        'text-sm transition-colors',
        statusColor,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 shrink-0 rounded-full',
            noteStatus === 'exists'
              ? 'bg-success'
              : noteStatus === 'missing'
                ? 'bg-primary/60'
                : 'bg-foreground-disabled',
          ].join(' ')}
        />

        <div>
          <span className="font-medium">{todayStr}</span>
          {noteStatus === 'exists' && (
            <span className="ml-2 text-xs text-foreground-muted">Note exists</span>
          )}
          {noteStatus === 'missing' && (
            <span className="ml-2 text-xs text-foreground-muted">No note yet</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenOrCreate}
          disabled={isLoading || noteStatus === 'unknown'}
          title={noteName.path}
          className={[
            'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {isLoading ? 'Opening…' : actionLabel}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          title="Dismiss"
          aria-label="Dismiss daily note banner"
          className={[
            'flex h-6 w-6 items-center justify-center rounded text-foreground-muted',
            'hover:bg-surface-hover hover:text-foreground transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          ].join(' ')}
        >
          ×
        </button>
      </div>
    </div>
  );
}
