'use client';

import { usePublicSearchStore } from './public-search-store';
import type { PublicSearchResult } from '@/shared/api/public-search';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublicSearchResultsProps {
  /** The public slug of the vault — used to build note navigation links. */
  publicSlug: string;
  /**
   * Callback invoked when the user clicks a result.
   * Receives the note path (e.g. "folder/note.md").
   * Defaults to navigating to `/public/:slug/:path` via window.location.
   */
  onResultClick?: (result: PublicSearchResult) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mx-auto mb-3 h-10 w-10 text-foreground-muted/40"
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
      className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-foreground-muted border-t-primary"
      role="status"
      aria-label="Loading search results"
    />
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  result: PublicSearchResult;
  publicSlug: string;
  onResultClick?: (result: PublicSearchResult) => void;
}

function ResultCard({ result, publicSlug, onResultClick }: ResultCardProps) {
  const pathWithoutExtension = result.path.replace(/\.md$/, '');

  function handleClick() {
    if (onResultClick) {
      onResultClick(result);
    } else {
      // Default: navigate to the published note page
      window.location.href = `/public/${publicSlug}/${pathWithoutExtension}`;
    }
  }

  return (
    <article className="group rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-md">
      <button type="button" onClick={handleClick} className="w-full text-left">
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {result.title || 'Untitled'}
        </p>

        <p className="mt-0.5 truncate text-xs text-foreground-muted">{result.path}</p>

        {/* Highlighted snippet — ts_headline produces safe HTML with <mark> only */}
        {result.snippet && result.snippet !== result.title && (
          <p
            className="mt-1 line-clamp-2 text-sm text-foreground-secondary [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        )}
      </button>
    </article>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

function Pagination({ page, total, limit, hasMore, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Search results pagination"
      className="flex items-center justify-between border-t border-border pt-4"
    >
      <p className="text-xs text-foreground-muted">
        Page {page + 1} of {totalPages} &mdash; {total} result{total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * PublicSearchResults — renders the current search results from the store.
 *
 * Renders:
 * - Loading spinner while search is in progress.
 * - Empty state when no results match the query.
 * - List of result cards with highlighted snippets.
 * - Pagination controls when total results exceed the page limit.
 * - Error state with a human-readable message.
 *
 * This component reads state from usePublicSearchStore and is intentionally
 * decoupled from the search input (PublicSearchBar) for layout flexibility.
 */
export function PublicSearchResults({ publicSlug, onResultClick }: PublicSearchResultsProps) {
  const query = usePublicSearchStore((s) => s.query);
  const results = usePublicSearchStore((s) => s.results);
  const total = usePublicSearchStore((s) => s.total);
  const page = usePublicSearchStore((s) => s.page);
  const limit = usePublicSearchStore((s) => s.limit);
  const hasMore = usePublicSearchStore((s) => s.hasMore);
  const status = usePublicSearchStore((s) => s.status);
  const errorMessage = usePublicSearchStore((s) => s.errorMessage);
  const setPage = usePublicSearchStore((s) => s.setPage);

  const trimmedQuery = query.trim();
  const isLoading = status === 'loading';
  const isError = status === 'error';

  // Don't render anything when there's no active query
  if (!trimmedQuery) return null;

  return (
    <section
      aria-label="Search results"
      aria-live="polite"
      aria-busy={isLoading}
      className="mt-4 space-y-3"
    >
      {/* Results summary */}
      {!isLoading && status === 'success' && (
        <p className="text-sm text-foreground-muted">
          {total > 0
            ? `${total} result${total !== 1 ? 's' : ''} for "${trimmedQuery}"`
            : `No results found for "${trimmedQuery}"`}
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm font-medium text-destructive">Search failed</p>
          {errorMessage && <p className="mt-1 text-xs text-destructive/70">{errorMessage}</p>}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && status === 'success' && results.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <EmptyIcon />
          <p className="text-sm font-medium text-foreground-muted">No results found</p>
          <p className="mt-1 text-xs text-foreground-muted">
            Try different keywords or check your spelling
          </p>
        </div>
      )}

      {/* Result cards */}
      {!isLoading && results.length > 0 && (
        <>
          <ul className="space-y-2" role="list">
            {results.map((result) => (
              <li key={result.path}>
                <ResultCard result={result} publicSlug={publicSlug} onResultClick={onResultClick} />
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            total={total}
            limit={limit}
            hasMore={hasMore}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
