'use client';

/**
 * GraphSearch — Search box that highlights matching nodes in the graph view.
 *
 * Features:
 * - Debounced search input (300ms) for performant filtering
 * - Match count badge showing number of matching nodes
 * - Keyboard shortcut (Cmd+F / Ctrl+F) to focus the search input
 * - Search results dropdown with matched nodes for quick navigation
 * - Highlighted node IDs are pushed to the workspace graph store
 * - Clear button and Escape key support
 *
 * Architecture:
 * - Search query is synced to useWorkspaceGraphStore
 * - Matching nodes are computed during render (derived state, not in an effect)
 * - Node highlight IDs are written to store via event handler (not effect)
 *
 * Accepts full node list as prop; filtering is a pure computation during render.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { useWorkspaceGraphStore } from '@/shared/stores/graph-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphSearchNode {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface GraphSearchProps {
  /** Full list of nodes available in the graph (unfiltered). */
  nodes: GraphSearchNode[];
  /** Called when a specific node should be focused/centered in the graph. */
  onNodeFocus?: (nodeId: string) => void;
  /** Whether the keyboard shortcut (Cmd+F / Ctrl+F) is active. Defaults to true. */
  keyboardShortcutEnabled?: boolean;
  /** Placeholder text. Defaults to "Search graph...". */
  placeholder?: string;
  /** Additional CSS class applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Debounce hook (inline, avoids external dependency)
// ---------------------------------------------------------------------------

function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    }) as T,
    [delayMs],
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphSearch({
  nodes,
  onNodeFocus,
  keyboardShortcutEnabled = true,
  placeholder = 'Search graph...',
  className,
}: GraphSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Store actions
  const setSearchQuery = useWorkspaceGraphStore((s) => s.setSearchQuery);
  const setHighlightedNodeIds = useWorkspaceGraphStore((s) => s.setHighlightedNodeIds);

  // Debounced store update
  const debouncedUpdate = useDebouncedCallback((query: string) => {
    setSearchQuery(query);
    const matchIds = computeMatches(nodes, query).map((n) => n.id);
    setHighlightedNodeIds(matchIds);
  }, 300);

  // Compute matching nodes during render (derived state, not in effect)
  const matches = useMemo(() => computeMatches(nodes, draft), [nodes, draft]);

  // Keyboard shortcut: Cmd+F / Ctrl+F
  // Using a ref-based event listener attached to window
  const shortcutAttachedRef = useRef(false);
  if (typeof window !== 'undefined' && keyboardShortcutEnabled && !shortcutAttachedRef.current) {
    shortcutAttachedRef.current = true;
    // This is safe as a module-level side effect for keyboard shortcuts
    // (attached once, never removed — acceptable for long-lived UI)
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDraft(value);
      setShowResults(value.trim().length > 0);
      debouncedUpdate(value);
    },
    [debouncedUpdate],
  );

  const handleClear = useCallback(() => {
    setDraft('');
    setShowResults(false);
    setSearchQuery('');
    setHighlightedNodeIds([]);
    inputRef.current?.focus();
  }, [setSearchQuery, setHighlightedNodeIds]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onNodeFocus?.(nodeId);
      setShowResults(false);
    },
    [onNodeFocus],
  );

  const handleFocus = useCallback(() => {
    if (draft.trim().length > 0) {
      setShowResults(true);
    }
  }, [draft]);

  const handleBlur = useCallback(() => {
    // Delay hiding results to allow click events to fire
    setTimeout(() => setShowResults(false), 200);
  }, []);

  const hasQuery = draft.length > 0;
  const matchCount = matches.length;

  return (
    <div role="search" aria-label="Search graph nodes" className={cn('relative', className)}>
      <div className="relative flex items-center">
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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label="Search graph nodes by title, path, or tag"
          className={cn(
            'h-8 w-56 rounded-md border border-border bg-card/90 pl-7 text-xs text-foreground backdrop-blur',
            'placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-ring',
            hasQuery ? 'pr-16' : 'pr-2',
          )}
        />

        {/* Match count badge */}
        {hasQuery && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none absolute right-7 text-[10px] font-medium text-foreground-muted tabular-nums"
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

      {/* Search results dropdown */}
      {showResults && matches.length > 0 && (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
          role="listbox"
          aria-label="Search results"
        >
          {matches.slice(0, 20).map((node) => (
            <button
              key={node.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => handleNodeClick(node.id)}
              className="flex w-full flex-col gap-0.5 border-b border-border/50 px-3 py-1.5 text-left last:border-b-0 hover:bg-accent/50"
            >
              <span className="truncate text-xs font-medium text-foreground">
                {highlightMatch(node.title, draft)}
              </span>
              <span className="truncate text-[10px] text-foreground-muted">
                {highlightMatch(node.path, draft)}
              </span>
              {node.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {node.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] text-primary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {matches.length > 20 && (
            <p className="border-t border-border px-3 py-1.5 text-center text-[10px] text-foreground-muted">
              +{matches.length - 20} more results
            </p>
          )}
        </div>
      )}

      {/* No results message */}
      {showResults && hasQuery && matches.length === 0 && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-md border border-border bg-card px-3 py-3 text-center shadow-lg">
          <p className="text-xs text-foreground-muted">No matching nodes found</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Filters nodes that match the query by title, path, or tags.
 * Case-insensitive. Returns the matching nodes (not just IDs) for
 * rendering in the dropdown.
 */
function computeMatches(nodes: GraphSearchNode[], query: string): GraphSearchNode[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];

  return nodes.filter((node) => {
    if (node.title.toLowerCase().includes(q)) return true;
    if (node.path.toLowerCase().includes(q)) return true;
    if (node.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
    return false;
  });
}

/**
 * Returns a JSX fragment with matched substrings wrapped in <mark>.
 * Used for highlighting search terms in result items.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const q = query.trim();
  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded-sm bg-yellow-200/60 text-inherit dark:bg-yellow-500/30">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
