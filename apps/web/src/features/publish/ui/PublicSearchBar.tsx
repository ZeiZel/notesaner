'use client';

import { useCallback, useEffect, useRef } from 'react';
import { debounce } from '@notesaner/utils';
import { searchPublicVault } from '@/shared/api/public-search';
import { usePublicSearchStore } from '../model/public-search-store';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublicSearchBarProps {
  /** The public slug of the vault being searched. */
  publicSlug: string;
  /** Optional placeholder override. Defaults to "Search published notes..." */
  placeholder?: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-foreground-muted"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function Spinner() {
  return (
    <div
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-foreground-muted border-t-primary"
      aria-label="Searching..."
      role="status"
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PublicSearchBar — keyboard-accessible full-text search input for public vaults.
 *
 * Features:
 * - Press / to focus the search bar from anywhere on the page.
 * - Debounced query (300 ms) — avoids hammering the API on every keystroke.
 * - Delegates all state management to usePublicSearchStore.
 * - Renders a spinner while the search is in progress.
 * - Works without authentication.
 */
export function PublicSearchBar({
  publicSlug,
  placeholder = 'Search published notes...',
}: PublicSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const query = usePublicSearchStore((s) => s.query);
  const status = usePublicSearchStore((s) => s.status);
  const page = usePublicSearchStore((s) => s.page);
  const limit = usePublicSearchStore((s) => s.limit);
  const setQuery = usePublicSearchStore((s) => s.setQuery);
  const setSearching = usePublicSearchStore((s) => s.setSearching);
  const setResults = usePublicSearchStore((s) => s.setResults);
  const setError = usePublicSearchStore((s) => s.setError);
  const reset = usePublicSearchStore((s) => s.reset);

  // ─── Debounced search effect ─────────────────────────────────────────────

  const performSearch = useCallback(
    debounce(async (q: string, currentPage: number) => {
      if (q.trim().length < 2) {
        reset();
        return;
      }

      setSearching();

      try {
        const response = await searchPublicVault(publicSlug, {
          q,
          limit,
          page: currentPage,
        });
        setResults(response.data, response.pagination.total, response.pagination.hasMore);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed. Please try again.';
        setError(message);
      }
    }, 300),
    [publicSlug, limit, setSearching, setResults, setError, reset],
  );

  // Effect: reactive search trigger when query or page changes from store.
  // Kept as useEffect because `page` is set by external pagination controls.
  // TODO: consider moving search trigger into Zustand subscribe() in the store.
  useEffect(() => {
    performSearch(query, page);
  }, [query, page, performSearch]);

  // ─── Keyboard shortcut: press / to focus ─────────────────────────────────

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Ignore if focus is already on an input, textarea, or contenteditable
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable')
      ) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
  }

  function handleClear() {
    reset();
    inputRef.current?.focus();
  }

  const isLoading = status === 'loading';
  const hasValue = query.trim().length > 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="relative flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring"
      role="search"
      aria-label="Search published notes"
    >
      <SearchIcon />

      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search query"
        autoComplete="off"
        spellCheck={false}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
      />

      {isLoading && <Spinner />}

      {!isLoading && hasValue && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-accent hover:text-foreground transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      )}

      {!isLoading && !hasValue && (
        <kbd
          className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted sm:inline-flex"
          title="Press / to focus search"
        >
          /
        </kbd>
      )}
    </div>
  );
}
