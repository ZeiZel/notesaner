'use client';

/**
 * UndoRedoToolbar — Undo/redo buttons with dropdown history for the editor.
 *
 * Displays two buttons (undo and redo) that show:
 *   - Enabled/disabled state based on history availability
 *   - Tooltip with the next action description (e.g., "Undo: typed text")
 *   - A dropdown menu listing recent past/future actions when clicked
 *     on the dropdown chevron
 *
 * Keyboard shortcuts (Cmd+Z / Cmd+Shift+Z) are handled by the editor engine
 * itself (CodeMirror / TipTap). This component syncs its visual state via
 * the history-store Zustand selectors — no useEffect needed.
 *
 * The `onUndo` and `onRedo` callbacks allow the parent to trigger the actual
 * undo/redo in the editor engine while this component updates the history
 * store's cursor.
 */

import { useState, useRef } from 'react';
import { cn } from '@notesaner/ui';
import {
  useHistoryStore,
  selectCanUndo,
  selectCanRedo,
  selectUndoEntry,
  selectRedoEntry,
  selectPastEntries,
  selectFutureEntries,
  type HistoryEntry,
} from '../model/history.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoRedoToolbarProps {
  /**
   * Callback invoked when the user clicks the undo button.
   * The parent should trigger the editor engine's undo command.
   */
  onUndo?: () => void;
  /**
   * Callback invoked when the user clicks the redo button.
   * The parent should trigger the editor engine's redo command.
   */
  onRedo?: () => void;
  /**
   * Callback invoked when the user jumps to a specific history point.
   * Receives the target entry index and the number of steps to undo/redo.
   * Positive steps = redo, negative steps = undo.
   */
  onJumpTo?: (index: number, steps: number) => void;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7h7a3 3 0 0 1 0 6H8" />
      <path d="M5.5 4.5 3 7l2.5 2.5" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 7H6a3 3 0 0 0 0 6h2" />
      <path d="M10.5 4.5 13 7l-2.5 2.5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Action Type Icons (for dropdown items)
// ---------------------------------------------------------------------------

function ActionTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'insert':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <path d="M6.5 1v4.5H11v1H6.5V11h-1V6.5H1v-1h4.5V1h1z" />
        </svg>
      );
    case 'delete':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <path d="M1 5.5h10v1H1v-1z" />
        </svg>
      );
    case 'format':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <path d="M2 2h8v2H8.5V3H6.75v6H7.5v1h-3v-1h.75V3H3.5v1H2V2z" />
        </svg>
      );
    case 'structure':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <path d="M1 2h10v1.5H1V2zm0 3h7v1.5H1V5zm0 3h10v1.5H1V8z" />
        </svg>
      );
    case 'paste':
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <path d="M4 1.5A1.5 1.5 0 015.5 0h1A1.5 1.5 0 018 1.5V2h1.5A1.5 1.5 0 0111 3.5v7A1.5 1.5 0 019.5 12h-7A1.5 1.5 0 011 10.5v-7A1.5 1.5 0 012.5 2H4V1.5zM5.5 1a.5.5 0 00-.5.5V2h2v-.5a.5.5 0 00-.5-.5h-1z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden="true">
          <circle cx="6" cy="6" r="2" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Time Formatter
// ---------------------------------------------------------------------------

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
// Dropdown Item
// ---------------------------------------------------------------------------

interface DropdownItemProps {
  entry: HistoryEntry;
  isCurrent: boolean;
  onClick: () => void;
}

function DropdownItem({ entry, isCurrent, onClick }: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
        isCurrent
          ? 'bg-[var(--ns-color-primary-muted)] text-[var(--ns-color-primary)]'
          : 'text-[var(--ns-color-foreground-secondary)] hover:bg-[var(--ns-color-background-hover)]',
      )}
    >
      <ActionTypeIcon
        type={entry.type}
        className={cn(
          'h-3 w-3 shrink-0',
          isCurrent ? 'text-[var(--ns-color-primary)]' : 'text-[var(--ns-color-foreground-muted)]',
        )}
      />
      <span className="flex-1 truncate">{entry.description}</span>
      <span className="shrink-0 text-[10px] text-[var(--ns-color-foreground-muted)]">
        {formatRelativeTime(entry.timestamp)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// History Dropdown
// ---------------------------------------------------------------------------

interface HistoryDropdownProps {
  direction: 'undo' | 'redo';
  entries: HistoryEntry[];
  cursor: number;
  onJump: (targetIndex: number) => void;
  onClose: () => void;
}

function HistoryDropdown({ direction, entries, cursor, onJump, onClose }: HistoryDropdownProps) {
  if (entries.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-[var(--ns-color-foreground-muted)]">
        No {direction === 'undo' ? 'past' : 'future'} actions
      </div>
    );
  }

  // Show maximum 15 entries in the dropdown
  const visibleEntries = entries.slice(0, 15);

  return (
    <div className="max-h-[240px] overflow-y-auto p-1">
      <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ns-color-foreground-muted)]">
        {direction === 'undo' ? 'Past actions' : 'Future actions'}
      </div>
      {visibleEntries.map((entry) => {
        // For undo entries (reversed past), find the original index
        const originalIndex =
          direction === 'undo'
            ? cursor - entries.indexOf(entry)
            : cursor + 1 + entries.indexOf(entry);

        return (
          <DropdownItem
            key={entry.id}
            entry={entry}
            isCurrent={originalIndex === cursor}
            onClick={() => {
              onJump(originalIndex);
              onClose();
            }}
          />
        );
      })}
      {entries.length > 15 && (
        <div className="mt-1 px-2 py-1 text-center text-[10px] text-[var(--ns-color-foreground-muted)]">
          {entries.length - 15} more actions...
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UndoRedoToolbar({ onUndo, onRedo, onJumpTo, className }: UndoRedoToolbarProps) {
  const canUndo = useHistoryStore(selectCanUndo);
  const canRedo = useHistoryStore(selectCanRedo);
  const undoEntry = useHistoryStore(selectUndoEntry);
  const redoEntry = useHistoryStore(selectRedoEntry);
  const pastEntries = useHistoryStore(selectPastEntries);
  const futureEntries = useHistoryStore(selectFutureEntries);
  const cursor = useHistoryStore((s) => s.cursor);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const jumpTo = useHistoryStore((s) => s.jumpTo);

  const [openDropdown, setOpenDropdown] = useState<'undo' | 'redo' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  function handleJump(targetIndex: number) {
    const currentCursor = useHistoryStore.getState().cursor;
    const steps = targetIndex - currentCursor;
    jumpTo(targetIndex);
    onJumpTo?.(targetIndex, steps);
  }

  function handleToggleDropdown(direction: 'undo' | 'redo') {
    setOpenDropdown((prev) => (prev === direction ? null : direction));
  }

  // Determine tooltip text
  const undoTooltip =
    canUndo && undoEntry ? `Undo: ${undoEntry.description} (Cmd+Z)` : 'Nothing to undo';

  const redoTooltip =
    canRedo && redoEntry ? `Redo: ${redoEntry.description} (Cmd+Shift+Z)` : 'Nothing to redo';

  return (
    <div
      className={cn('relative flex items-center gap-0.5', className)}
      role="toolbar"
      aria-label="Undo and redo"
    >
      {/* Undo button group */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          aria-label={undoTooltip}
          title={undoTooltip}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-l-md transition-colors',
            canUndo
              ? 'text-[var(--ns-color-foreground-secondary)] hover:bg-[var(--ns-color-background-hover)] active:bg-[var(--ns-color-background-active)]'
              : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-50',
          )}
        >
          <UndoIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleToggleDropdown('undo')}
          disabled={!canUndo}
          aria-label="Undo history"
          aria-expanded={openDropdown === 'undo'}
          aria-haspopup="true"
          className={cn(
            'flex h-7 w-4 items-center justify-center rounded-r-md border-l transition-colors',
            'border-[var(--ns-color-border-subtle)]',
            canUndo
              ? 'text-[var(--ns-color-foreground-muted)] hover:bg-[var(--ns-color-background-hover)]'
              : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-50',
          )}
        >
          <ChevronDownIcon className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Redo button group */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          aria-label={redoTooltip}
          title={redoTooltip}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-l-md transition-colors',
            canRedo
              ? 'text-[var(--ns-color-foreground-secondary)] hover:bg-[var(--ns-color-background-hover)] active:bg-[var(--ns-color-background-active)]'
              : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-50',
          )}
        >
          <RedoIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleToggleDropdown('redo')}
          disabled={!canRedo}
          aria-label="Redo history"
          aria-expanded={openDropdown === 'redo'}
          aria-haspopup="true"
          className={cn(
            'flex h-7 w-4 items-center justify-center rounded-r-md border-l transition-colors',
            'border-[var(--ns-color-border-subtle)]',
            canRedo
              ? 'text-[var(--ns-color-foreground-muted)] hover:bg-[var(--ns-color-background-hover)]'
              : 'cursor-not-allowed text-[var(--ns-color-foreground-muted)] opacity-50',
          )}
        >
          <ChevronDownIcon className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Dropdown overlay — closes on outside click */}
      {openDropdown !== null && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenDropdown(null)}
            aria-hidden="true"
          />
          <div
            ref={dropdownRef}
            role="menu"
            aria-label={`${openDropdown === 'undo' ? 'Undo' : 'Redo'} history`}
            className={cn(
              'absolute top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border',
              'border-[var(--ns-color-border)] bg-[var(--ns-color-popover)]',
              'shadow-[var(--ns-shadow-md)]',
              openDropdown === 'undo' ? 'left-0' : 'right-0',
            )}
          >
            <HistoryDropdown
              direction={openDropdown}
              entries={openDropdown === 'undo' ? pastEntries : futureEntries}
              cursor={cursor}
              onJump={handleJump}
              onClose={() => setOpenDropdown(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

UndoRedoToolbar.displayName = 'UndoRedoToolbar';
