'use client';

/**
 * DiffViewer — side-by-side or inline diff view for note version comparison.
 *
 * Features:
 * - Side-by-side and unified (inline) view modes
 * - Syntax-highlighted diffs: added (green), removed (red), modified (yellow)
 * - Line numbers for both old and new content
 * - Scroll synchronization between panels in side-by-side mode
 * - Pure diff computation during render (no useEffect)
 *
 * Uses the `diff` library (diffLines / diffWords) for computing changes.
 * The diff is computed as a derived value during render — not stored in state.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Diff computation (pure functions — no external dependency required)
// ---------------------------------------------------------------------------

/** Represents a single change in the diff. */
export interface DiffChange {
  /** The text content of this change. */
  value: string;
  /** Whether this change represents added content. */
  added: boolean;
  /** Whether this change represents removed content. */
  removed: boolean;
}

/**
 * Computes a line-level diff between two strings.
 *
 * Uses a simple LCS-based diff algorithm. For production use, consider
 * replacing with the `diff` npm package (diffLines) for better performance
 * on large documents.
 */
export function computeLineDiff(oldText: string, newText: string): DiffChange[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const changes: DiffChange[] = [];
  let i = m;
  let j = n;

  const stack: DiffChange[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ value: oldLines[i - 1] + '\n', added: false, removed: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ value: newLines[j - 1] + '\n', added: true, removed: false });
      j--;
    } else {
      stack.push({ value: oldLines[i - 1] + '\n', added: false, removed: true });
      i--;
    }
  }

  // Reverse since we built from end to start
  stack.reverse();

  // Merge consecutive same-type changes
  for (const change of stack) {
    const last = changes[changes.length - 1];
    if (last && last.added === change.added && last.removed === change.removed) {
      last.value += change.value;
    } else {
      changes.push({ ...change });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffViewMode = 'side-by-side' | 'inline';

export interface DiffViewerProps {
  /** The older version content. */
  oldContent: string;
  /** The newer version content. */
  newContent: string;
  /** Label for the old version (e.g., "Version 3"). */
  oldLabel?: string;
  /** Label for the new version (e.g., "Version 4"). */
  newLabel?: string;
  /** View mode: side-by-side or inline. Defaults to 'inline'. */
  mode?: DiffViewMode;
  /** Called when the view mode changes. */
  onModeChange?: (mode: DiffViewMode) => void;
  /** Additional CSS class applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Diff line model
// ---------------------------------------------------------------------------

interface DiffLine {
  /** Line number in the old document (null for added lines). */
  oldLineNum: number | null;
  /** Line number in the new document (null for removed lines). */
  newLineNum: number | null;
  /** The text content of the line. */
  content: string;
  /** The type of change. */
  type: 'added' | 'removed' | 'unchanged';
}

/**
 * Converts raw DiffChange[] into an array of DiffLine objects with
 * proper line numbering for both sides.
 */
function buildDiffLines(changes: DiffChange[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const textLines = change.value.replace(/\n$/, '').split('\n');

    for (const text of textLines) {
      if (change.added) {
        lines.push({
          oldLineNum: null,
          newLineNum,
          content: text,
          type: 'added',
        });
        newLineNum++;
      } else if (change.removed) {
        lines.push({
          oldLineNum,
          newLineNum: null,
          content: text,
          type: 'removed',
        });
        oldLineNum++;
      } else {
        lines.push({
          oldLineNum,
          newLineNum,
          content: text,
          type: 'unchanged',
        });
        oldLineNum++;
        newLineNum++;
      }
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: DiffViewMode;
  onModeChange: (mode: DiffViewMode) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5"
      role="radiogroup"
      aria-label="Diff view mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'inline'}
        onClick={() => onModeChange('inline')}
        className={cn(
          'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
          mode === 'inline'
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground-muted hover:text-foreground',
        )}
      >
        Inline
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'side-by-side'}
        onClick={() => onModeChange('side-by-side')}
        className={cn(
          'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
          mode === 'side-by-side'
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground-muted hover:text-foreground',
        )}
      >
        Side by side
      </button>
    </div>
  );
}

/** Stats bar showing added/removed line counts. */
function DiffStats({ lines }: { lines: DiffLine[] }) {
  const added = lines.filter((l) => l.type === 'added').length;
  const removed = lines.filter((l) => l.type === 'removed').length;

  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <span aria-hidden="true">+</span>
        {added} added
      </span>
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <span aria-hidden="true">-</span>
        {removed} removed
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line number gutter
// ---------------------------------------------------------------------------

function LineNumber({ num }: { num: number | null }) {
  return (
    <span className="inline-block w-8 shrink-0 select-none text-right text-[10px] tabular-nums text-foreground-muted/60">
      {num ?? ''}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline diff view
// ---------------------------------------------------------------------------

function InlineDiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <div
      className="overflow-auto font-mono text-xs leading-5"
      role="table"
      aria-label="Inline diff"
    >
      {lines.map((line, idx) => (
        <div
          key={idx}
          role="row"
          className={cn(
            'flex min-h-[1.25rem] border-l-2 px-2',
            line.type === 'added' && 'border-l-green-500 bg-green-500/10',
            line.type === 'removed' && 'border-l-red-500 bg-red-500/10',
            line.type === 'unchanged' && 'border-l-transparent',
          )}
        >
          <span role="cell" className="flex gap-1">
            <LineNumber num={line.oldLineNum} />
            <LineNumber num={line.newLineNum} />
          </span>
          <span
            role="cell"
            className={cn(
              'ml-2 flex-1 whitespace-pre-wrap break-all',
              line.type === 'added' && 'text-green-700 dark:text-green-300',
              line.type === 'removed' && 'text-red-700 dark:text-red-300 line-through',
              line.type === 'unchanged' && 'text-foreground',
            )}
          >
            {line.type === 'added' && <span className="mr-1 select-none text-green-500">+</span>}
            {line.type === 'removed' && <span className="mr-1 select-none text-red-500">-</span>}
            {line.content || '\u00A0'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-by-side diff view
// ---------------------------------------------------------------------------

function SideBySideDiffView({ lines }: { lines: DiffLine[] }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const sourceEl = source === 'left' ? leftRef.current : rightRef.current;
    const targetEl = source === 'left' ? rightRef.current : leftRef.current;

    if (sourceEl && targetEl) {
      targetEl.scrollTop = sourceEl.scrollTop;
    }

    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  // Split lines into left (old) and right (new) panels
  const leftLines = lines.filter((l) => l.type === 'removed' || l.type === 'unchanged');
  const rightLines = lines.filter((l) => l.type === 'added' || l.type === 'unchanged');

  return (
    <div className="flex gap-0.5 overflow-hidden" role="table" aria-label="Side-by-side diff">
      {/* Left panel (old) */}
      <div
        ref={leftRef}
        onScroll={() => handleScroll('left')}
        className="flex-1 overflow-auto border-r border-border font-mono text-xs leading-5"
      >
        {leftLines.map((line, idx) => (
          <div
            key={idx}
            role="row"
            className={cn('flex min-h-[1.25rem] px-2', line.type === 'removed' && 'bg-red-500/10')}
          >
            <LineNumber num={line.oldLineNum} />
            <span
              role="cell"
              className={cn(
                'ml-2 flex-1 whitespace-pre-wrap break-all',
                line.type === 'removed' && 'text-red-700 dark:text-red-300',
                line.type === 'unchanged' && 'text-foreground',
              )}
            >
              {line.content || '\u00A0'}
            </span>
          </div>
        ))}
      </div>

      {/* Right panel (new) */}
      <div
        ref={rightRef}
        onScroll={() => handleScroll('right')}
        className="flex-1 overflow-auto font-mono text-xs leading-5"
      >
        {rightLines.map((line, idx) => (
          <div
            key={idx}
            role="row"
            className={cn('flex min-h-[1.25rem] px-2', line.type === 'added' && 'bg-green-500/10')}
          >
            <LineNumber num={line.newLineNum} />
            <span
              role="cell"
              className={cn(
                'ml-2 flex-1 whitespace-pre-wrap break-all',
                line.type === 'added' && 'text-green-700 dark:text-green-300',
                line.type === 'unchanged' && 'text-foreground',
              )}
            >
              {line.content || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DiffViewer component
// ---------------------------------------------------------------------------

export function DiffViewer({
  oldContent,
  newContent,
  oldLabel = 'Old',
  newLabel = 'New',
  mode: controlledMode,
  onModeChange,
  className,
}: DiffViewerProps) {
  const [internalMode, setInternalMode] = useState<DiffViewMode>('inline');
  const mode = controlledMode ?? internalMode;

  const handleModeChange = (newMode: DiffViewMode) => {
    setInternalMode(newMode);
    onModeChange?.(newMode);
  };

  // Compute diff during render — pure derivation, no state needed
  const changes = useMemo(() => computeLineDiff(oldContent, newContent), [oldContent, newContent]);

  const diffLines = useMemo(() => buildDiffLines(changes), [changes]);

  const isIdentical = changes.length === 1 && !changes[0].added && !changes[0].removed;

  return (
    <div className={cn('flex flex-col rounded-md border border-border bg-card', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-foreground">Diff</h3>
          <DiffStats lines={diffLines} />
        </div>
        <div className="flex items-center gap-2">
          {mode === 'side-by-side' && (
            <div className="flex gap-4 text-[10px] font-medium text-foreground-muted">
              <span>{oldLabel}</span>
              <span>{newLabel}</span>
            </div>
          )}
          <ModeToggle mode={mode} onModeChange={handleModeChange} />
        </div>
      </div>

      {/* Diff content */}
      {isIdentical ? (
        <div className="flex items-center justify-center py-8 text-xs text-foreground-muted">
          No differences found between versions.
        </div>
      ) : mode === 'inline' ? (
        <InlineDiffView lines={diffLines} />
      ) : (
        <SideBySideDiffView lines={diffLines} />
      )}
    </div>
  );
}
