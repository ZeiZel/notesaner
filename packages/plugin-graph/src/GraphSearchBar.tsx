'use client';

/**
 * GraphSearchBar — debounced search input for the knowledge graph.
 *
 * Features:
 * - Debounced input (300 ms) to avoid per-keystroke filter re-runs
 * - Keyboard shortcut Cmd+F / Ctrl+F when the graph is focused
 * - Match count badge (shows how many nodes match the current query)
 * - Clear button when the query is non-empty
 * - Accessible: aria-label, role, live region for match count
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphSearchBarProps {
  /** Current search query value (controlled). */
  value: string;
  /** Called with the new query after the debounce delay. */
  onChange: (query: string) => void;
  /**
   * Number of nodes currently matching the query.
   * Displayed as a badge next to the input.
   * Pass 0 or undefined to hide the count.
   */
  matchCount?: number;
  /** Additional CSS class name applied to the root container. */
  className?: string;
  /**
   * Whether the keyboard shortcut (Cmd+F / Ctrl+F) is active.
   * When true, the shortcut listener attaches to the window.
   * Defaults to true.
   */
  keyboardShortcutEnabled?: boolean;
  /** Placeholder text for the search input. Defaults to "Search nodes...". */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphSearchBar({
  value,
  onChange,
  matchCount,
  className,
  keyboardShortcutEnabled = true,
  placeholder = 'Search nodes...',
}: GraphSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Local draft state so the input feels instant while the parent update is debounced
  const [draft, setDraft] = useState(value);

  // Sync external value changes into local draft (e.g., "Clear all" button)
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const debouncedDraft = useDebounce(draft, 300);

  // Fire onChange when the debounced value changes
  useEffect(() => {
    if (debouncedDraft !== value) {
      onChange(debouncedDraft);
    }
    // We intentionally omit `value` from deps to avoid loops:
  }, [debouncedDraft, onChange]);

  // Cmd+F / Ctrl+F keyboard shortcut
  useEffect(() => {
    if (!keyboardShortcutEnabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcutEnabled]);

  const handleClear = useCallback(() => {
    setDraft('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear],
  );

  const hasQuery = draft.length > 0;
  const showMatchCount = hasQuery && typeof matchCount === 'number' && matchCount >= 0;

  return (
    <div
      role="search"
      aria-label="Search graph nodes"
      className={['relative flex items-center', className ?? ''].join(' ')}
    >
      {/* Search icon */}
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-foreground-muted"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
          clipRule="evenodd"
        />
      </svg>

      <input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search graph nodes by title or path"
        className={[
          'h-7 rounded-md border border-border bg-card/90 pl-7 text-xs text-foreground backdrop-blur',
          'placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-ring',
          // Adjust right padding to accommodate clear button and/or match count
          hasQuery ? 'pr-14' : 'pr-2',
        ].join(' ')}
        style={{ width: '13rem' }}
      />

      {/* Match count badge */}
      {showMatchCount && (
        <span
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none absolute right-6 text-[10px] font-medium text-foreground-muted"
        >
          {matchCount}
        </span>
      )}

      {/* Clear button */}
      {hasQuery && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search (Esc)"
          className="absolute right-1 flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:bg-accent hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
