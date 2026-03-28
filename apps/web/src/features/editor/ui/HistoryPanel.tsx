'use client';

/**
 * HistoryPanel — Visual history timeline showing all editor actions.
 *
 * Renders a vertical timeline of history entries with:
 *   - Timestamps relative to the current time
 *   - Action type icons and human-readable descriptions
 *   - Current position indicator (cursor)
 *   - Click to jump to any point in history
 *   - Visual distinction between past (applied) and future (undone) entries
 *
 * Designed to be rendered in a sidebar or slide-out panel. Reads from the
 * history-store and does not require useEffect — all state is derived from
 * Zustand selectors.
 *
 * The `onJumpTo` callback allows the parent to coordinate the actual editor
 * undo/redo steps needed to reach the target state.
 */

import { cn } from '@notesaner/ui';
import {
  useHistoryStore,
  selectCanUndo,
  selectCanRedo,
  type HistoryEntry,
  type HistoryActionType,
} from '../model/history.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryPanelProps {
  /**
   * Callback invoked when the user clicks a history entry to jump to it.
   * Receives the target entry index and the number of steps to undo/redo.
   * Positive steps = redo, negative steps = undo.
   */
  onJumpTo?: (index: number, steps: number) => void;
  /** Callback to trigger undo. */
  onUndo?: () => void;
  /** Callback to trigger redo. */
  onRedo?: () => void;
  /** Whether the panel is visible. Controls render. */
  open?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ActionIcon({ type, className }: { type: HistoryActionType; className?: string }) {
  const iconClass = cn('h-3.5 w-3.5', className);

  switch (type) {
    case 'insert':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M7.5 1v5.5H13v1H7.5V13h-1V7.5H1v-1h5.5V1h1z" />
        </svg>
      );
    case 'delete':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M3 6.5h8v1H3v-1z" />
        </svg>
      );
    case 'format':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M3 2h8v2.5h-1.5V3.5H8v7h1v1H5v-1h1v-7H4.5V4.5H3V2z" />
        </svg>
      );
    case 'replace':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M2 4h4.5v1H3v4h3.5v1H2V4zm5.5 0H12v6H7.5V9H11V5H7.5V4z" />
        </svg>
      );
    case 'paste':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M5 1.5A1.5 1.5 0 016.5 0h1A1.5 1.5 0 019 1.5V2h2a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1h2V1.5zM6.5 1a.5.5 0 00-.5.5V2h2v-.5a.5.5 0 00-.5-.5h-1z" />
        </svg>
      );
    case 'cut':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M4 2a2 2 0 00-1.24 3.57L5.5 7 2.76 8.43A2 2 0 104 12a2 2 0 001.24-3.57L7 7.5l1.76.93A2 2 0 1011.24 5.57L8.5 7l2.74-1.43A2 2 0 104 2z" />
        </svg>
      );
    case 'structure':
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <path d="M1 2.5h12v1.5H1V2.5zm0 3.5h8v1.5H1V6zm0 3.5h12v1.5H1V9.5z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 14 14" className={iconClass} fill="currentColor" aria-hidden="true">
          <circle cx="7" cy="7" r="2.5" />
        </svg>
      );
  }
}

function UndoSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h6a2.5 2.5 0 0 1 0 5H7" />
      <path d="M5 4L3 6l2 2" />
    </svg>
  );
}

function RedoSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 6H5a2.5 2.5 0 0 0 0 5h2" />
      <path d="M9 4l2 2-2 2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Time Formatting
// ---------------------------------------------------------------------------

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

// ---------------------------------------------------------------------------
// Timeline Entry
// ---------------------------------------------------------------------------

interface TimelineEntryProps {
  entry: HistoryEntry;
  index: number;
  cursor: number;
  isLast: boolean;
  onClick: () => void;
}

function TimelineEntry({ entry, index, cursor, isLast, onClick }: TimelineEntryProps) {
  const isPast = index <= cursor;
  const isCurrent = index === cursor;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-start gap-3 py-2 pl-6 pr-3 text-left transition-colors',
        'hover:bg-[var(--ns-color-background-hover)]',
        isCurrent && 'bg-[var(--ns-color-primary-muted)]',
      )}
      aria-label={`${entry.description} - ${formatRelativeTime(entry.timestamp)}${isCurrent ? ' (current)' : ''}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Timeline line */}
      <div
        className="absolute left-[17px] top-0 bottom-0 w-px"
        style={{
          backgroundColor: isPast ? 'var(--ns-color-primary)' : 'var(--ns-color-border-subtle)',
          display: isLast ? 'none' : undefined,
        }}
      />

      {/* Timeline dot */}
      <div
        className={cn(
          'relative z-10 mt-1.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
          isCurrent
            ? 'bg-[var(--ns-color-primary)] ring-2 ring-[var(--ns-color-primary-muted)]'
            : isPast
              ? 'bg-[var(--ns-color-primary)]'
              : 'border-2 border-[var(--ns-color-border)] bg-[var(--ns-color-background)]',
        )}
      >
        {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <ActionIcon
            type={entry.type}
            className={cn(
              'shrink-0',
              isPast
                ? 'text-[var(--ns-color-foreground-secondary)]'
                : 'text-[var(--ns-color-foreground-muted)]',
            )}
          />
          <span
            className={cn(
              'truncate text-xs font-medium',
              isPast
                ? 'text-[var(--ns-color-foreground)]'
                : 'text-[var(--ns-color-foreground-muted)]',
            )}
          >
            {entry.description}
          </span>
        </div>
        <span className="text-[10px] text-[var(--ns-color-foreground-muted)]">
          {formatTimestamp(entry.timestamp)}
          <span className="ml-1.5 opacity-70">{formatRelativeTime(entry.timestamp)}</span>
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ns-color-secondary)]">
        <svg
          viewBox="0 0 16 16"
          className="h-5 w-5 text-[var(--ns-color-foreground-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5v4l2.5 1.5" />
        </svg>
      </div>
      <p className="text-xs font-medium text-[var(--ns-color-foreground-secondary)]">
        No history yet
      </p>
      <p className="mt-1 text-[10px] text-[var(--ns-color-foreground-muted)]">
        Start editing to see your action history here
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HistoryPanel({
  onJumpTo,
  onUndo,
  onRedo,
  open = true,
  className,
}: HistoryPanelProps) {
  const entries = useHistoryStore((s) => s.entries);
  const cursor = useHistoryStore((s) => s.cursor);
  const canUndo = useHistoryStore(selectCanUndo);
  const canRedo = useHistoryStore(selectCanRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const jumpTo = useHistoryStore((s) => s.jumpTo);
  const clear = useHistoryStore((s) => s.clear);

  if (!open) return null;

  function handleJump(targetIndex: number) {
    const currentCursor = useHistoryStore.getState().cursor;
    const steps = targetIndex - currentCursor;
    jumpTo(targetIndex);
    onJumpTo?.(targetIndex, steps);
  }

  function handleUndo() {
    if (!canUndo) return;
    undo();
    onUndo?.();
  }

  function handleRedo() {
    if (!canRedo) return;
    redo();
    onRedo?.();
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden border-l',
        'border-[var(--ns-color-border)] bg-[var(--ns-color-background)]',
        className,
      )}
      role="region"
      aria-label="Edit history"
      data-testid="history-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ns-color-border)] px-3 py-2">
        <h2 className="text-xs font-semibold text-[var(--ns-color-foreground)]">History</h2>
        <div className="flex items-center gap-1">
          {/* Undo/Redo shortcuts in panel */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Cmd+Z)"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded transition-colors',
              canUndo
                ? 'text-[var(--ns-color-foreground-secondary)] hover:bg-[var(--ns-color-background-hover)]'
                : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-40',
            )}
          >
            <UndoSmallIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Cmd+Shift+Z)"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded transition-colors',
              canRedo
                ? 'text-[var(--ns-color-foreground-secondary)] hover:bg-[var(--ns-color-background-hover)]'
                : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-40',
            )}
          >
            <RedoSmallIcon className="h-3.5 w-3.5" />
          </button>

          {/* Clear history */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear history"
              title="Clear all history"
              className="ml-1 flex h-6 items-center justify-center rounded px-1.5 text-[10px] text-[var(--ns-color-foreground-muted)] transition-colors hover:bg-[var(--ns-color-background-hover)] hover:text-[var(--ns-color-foreground-secondary)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 border-b border-[var(--ns-color-border-subtle)] px-3 py-1.5">
          <span className="text-[10px] text-[var(--ns-color-foreground-muted)]">
            {cursor + 1}/{entries.length} actions
          </span>
          <div className="h-1 flex-1 rounded-full bg-[var(--ns-color-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--ns-color-primary)] transition-all"
              style={{
                width: entries.length > 0 ? `${((cursor + 1) / entries.length) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="py-1">
            {/* Initial state marker */}
            <div className="relative flex items-center gap-3 py-1.5 pl-6 pr-3">
              <div
                className="absolute left-[17px] top-1/2 bottom-0 w-px"
                style={{
                  backgroundColor:
                    cursor >= 0 ? 'var(--ns-color-primary)' : 'var(--ns-color-border-subtle)',
                }}
              />
              <div
                className={cn(
                  'relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
                  cursor === -1
                    ? 'bg-[var(--ns-color-primary)] ring-2 ring-[var(--ns-color-primary-muted)]'
                    : 'border-2 border-[var(--ns-color-primary)] bg-[var(--ns-color-background)]',
                )}
              >
                {cursor === -1 && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-[10px] font-medium text-[var(--ns-color-foreground-muted)]">
                Initial state
              </span>
            </div>

            {/* History entries, oldest first */}
            {entries.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                index={index}
                cursor={cursor}
                isLast={index === entries.length - 1}
                onClick={() => handleJump(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

HistoryPanel.displayName = 'HistoryPanel';
