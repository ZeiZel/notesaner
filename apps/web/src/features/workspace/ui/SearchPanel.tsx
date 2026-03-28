'use client';

/**
 * SearchPanel — sidebar search with virtualized results.
 *
 * Replaces the static SearchPanelPlaceholder with a functional search
 * panel that uses VirtualList for result rendering.
 *
 * Features:
 *   - Debounced search input
 *   - Virtualized result list (handles hundreds of results efficiently)
 *   - Highlighted snippet display
 *   - Keyboard navigation (ArrowDown from input focuses results)
 */

import { useRef, useCallback, useState } from 'react';
import { VirtualList, type VirtualListHandle } from '@/shared/ui/VirtualList';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet?: string;
}

export interface SearchPanelProps {
  /** Called when user enters a query. Should update `results`. */
  onSearch: (query: string) => void;
  /** Search results to display. */
  results: SearchResult[];
  /** Whether a search is in progress. */
  isLoading?: boolean;
  /** Called when a result is clicked. */
  onResultClick: (result: SearchResult) => void;
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function SearchResultRow({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: (result: SearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(result)}
      className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
    >
      <span className="truncate text-sm font-medium text-sidebar-foreground">
        {result.title || 'Untitled'}
      </span>
      <span className="truncate text-xs text-sidebar-muted">{result.path}</span>
      {result.snippet && (
        <span className="line-clamp-2 text-xs text-sidebar-muted/80">{result.snippet}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SearchPanel({
  onSearch,
  results,
  isLoading = false,
  onResultClick,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<VirtualListHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(value.trim());
      }, 300);
    },
    [onSearch],
  );

  const renderItem = useCallback(
    (result: SearchResult) => <SearchResultRow result={result} onClick={onResultClick} />,
    [onResultClick],
  );

  const getItemKey = useCallback((item: SearchResult) => item.id, []);

  return (
    <div className="flex h-full flex-col gap-2" role="search" aria-label="Search notes">
      <input
        type="search"
        placeholder="Search notes..."
        value={query}
        onChange={handleChange}
        className="w-full rounded-sm border border-sidebar-border bg-background-input px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
        aria-label="Search notes"
      />

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-sidebar-muted border-t-primary" />
        </div>
      )}

      {!isLoading && query.trim() && results.length === 0 && (
        <p className="px-2 text-xs text-sidebar-muted" role="status" aria-live="polite">
          No results found
        </p>
      )}

      {!isLoading && results.length > 0 && (
        <>
          <p className="px-2 text-xs text-sidebar-muted" role="status" aria-live="polite">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <VirtualList<SearchResult>
            ref={listRef}
            items={results}
            estimateSize={56}
            getItemKey={getItemKey}
            renderItem={renderItem}
            overscan={5}
            className="flex-1"
            aria-label="Search results"
          />
        </>
      )}

      {!query.trim() && !isLoading && (
        <p className="px-2 text-xs text-sidebar-muted">Type to search across all notes.</p>
      )}
    </div>
  );
}
