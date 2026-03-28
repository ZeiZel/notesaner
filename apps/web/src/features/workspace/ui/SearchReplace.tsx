'use client';

/**
 * SearchReplace -- workspace-level search & replace panel.
 *
 * Features:
 *   - Search across all notes in the workspace
 *   - Regex support with validation
 *   - Case sensitivity and whole word toggles
 *   - Replace with preview: see changes before applying
 *   - Replace one / replace all with match exclusion
 *   - Click a match to navigate to it in the editor
 *
 * Design decisions:
 *   - No useEffect: search is triggered by event handlers (input change,
 *     toggle clicks), not by watching state.
 *   - Debouncing is handled inside useSearchReplace hook.
 *   - Result grouping is computed during render (derived state).
 */

import { useCallback, useRef } from 'react';
import { useSearchReplace } from '../hooks/useSearchReplace';
import { SearchReplaceResults } from './SearchReplaceResults';
import type { SearchMatch } from '../hooks/useSearchReplace';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchReplaceProps {
  /** Called when the user clicks a match to navigate to it. */
  onNavigateToMatch?: (match: SearchMatch) => void;
  /** Additional CSS class for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Toggle button icons
// ---------------------------------------------------------------------------

function RegexIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-foreground-muted'}`}
    >
      <text x="3" y="18" fontSize="14" fontFamily="monospace" fill="currentColor" stroke="none">
        .*
      </text>
    </svg>
  );
}

function CaseSensitiveIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-foreground-muted'}`}
    >
      <text x="2" y="18" fontSize="16" fontFamily="monospace" fill="currentColor">
        Aa
      </text>
    </svg>
  );
}

function WholeWordIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-foreground-muted'}`}
    >
      <text x="1" y="17" fontSize="12" fontFamily="monospace" fill="currentColor">
        ab
      </text>
      <line x1="0" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronDownIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground-muted border-t-primary" />
  );
}

// ---------------------------------------------------------------------------
// Toggle button
// ---------------------------------------------------------------------------

function ToggleButton({
  active,
  onClick,
  title,
  'aria-label': ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  'aria-label': string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground-muted hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SearchReplace({ onNavigateToMatch, className }: SearchReplaceProps) {
  const {
    query,
    replaceText,
    isRegex,
    isCaseSensitive,
    wholeWord,
    matchesByNote,
    totalMatches,
    isSearching,
    searchError,
    isReplacing,
    replaceError,
    excludedMatchIds,
    isReplaceExpanded,
    includedCount,
    setQuery,
    setReplaceText,
    setIsRegex,
    setIsCaseSensitive,
    setWholeWord,
    setReplaceExpanded,
    setOpen,
    toggleMatchExclusion,
    excludeAllMatchesForNote,
    includeAllMatchesForNote,
    performSearch,
    replaceSingle,
    replaceAll,
    getReplacementPreview,
    reset,
  } = useSearchReplace();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Event handlers -- all search triggers happen here, NOT in effects
  // ---------------------------------------------------------------------------

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      performSearch(value);
    },
    [setQuery, performSearch],
  );

  const handleReplaceTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReplaceText(e.target.value);
    },
    [setReplaceText],
  );

  const handleToggleRegex = useCallback(() => {
    setIsRegex(!isRegex);
    // Re-trigger search with updated option
    performSearch();
  }, [isRegex, setIsRegex, performSearch]);

  const handleToggleCaseSensitive = useCallback(() => {
    setIsCaseSensitive(!isCaseSensitive);
    performSearch();
  }, [isCaseSensitive, setIsCaseSensitive, performSearch]);

  const handleToggleWholeWord = useCallback(() => {
    setWholeWord(!wholeWord);
    performSearch();
  }, [wholeWord, setWholeWord, performSearch]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setOpen(false);
        reset();
      }
      if (e.key === 'Enter') {
        performSearch();
      }
    },
    [setOpen, reset, performSearch],
  );

  const handleMatchClick = useCallback(
    (match: SearchMatch) => {
      onNavigateToMatch?.(match);
    },
    [onNavigateToMatch],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
  }, [setOpen, reset]);

  const handleReplaceAll = useCallback(() => {
    void replaceAll();
  }, [replaceAll]);

  const handleToggleReplace = useCallback(() => {
    setReplaceExpanded(!isReplaceExpanded);
  }, [isReplaceExpanded, setReplaceExpanded]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`flex h-full flex-col border-r border-border bg-background ${className ?? ''}`}
      role="search"
      aria-label="Search and replace in workspace"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">Search & Replace</h2>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close search panel"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Search input */}
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search across all notes..."
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded-sm border border-border bg-background-input px-2 py-1.5 pr-8 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Search query"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <SpinnerIcon />
              </div>
            )}
          </div>
        </div>

        {/* Search option toggles */}
        <div className="flex items-center gap-1">
          <ToggleButton
            active={isRegex}
            onClick={handleToggleRegex}
            title="Use regular expression"
            aria-label="Toggle regular expression"
          >
            <RegexIcon active={isRegex} />
          </ToggleButton>

          <ToggleButton
            active={isCaseSensitive}
            onClick={handleToggleCaseSensitive}
            title="Match case"
            aria-label="Toggle case sensitivity"
          >
            <CaseSensitiveIcon active={isCaseSensitive} />
          </ToggleButton>

          <ToggleButton
            active={wholeWord}
            onClick={handleToggleWholeWord}
            title="Match whole word"
            aria-label="Toggle whole word matching"
          >
            <WholeWordIcon active={wholeWord} />
          </ToggleButton>

          <div className="flex-1" />

          {/* Expand replace section */}
          <button
            type="button"
            onClick={handleToggleReplace}
            className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
            aria-expanded={isReplaceExpanded}
            aria-label="Toggle replace section"
          >
            Replace
            <ChevronDownIcon expanded={isReplaceExpanded} />
          </button>
        </div>

        {/* Replace input */}
        {isReplaceExpanded && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={handleReplaceTextChange}
              className="w-full rounded-sm border border-border bg-background-input px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Replacement text"
            />

            {/* Replace all button */}
            {totalMatches > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReplaceAll}
                  disabled={isReplacing || includedCount === 0}
                  className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Replace ${includedCount} matches`}
                >
                  {isReplacing ? (
                    <SpinnerIcon />
                  ) : (
                    <>
                      Replace {includedCount} match{includedCount !== 1 ? 'es' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error messages */}
      {searchError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2" role="alert">
          <p className="text-xs text-destructive">{searchError}</p>
        </div>
      )}

      {replaceError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2" role="alert">
          <p className="text-xs text-destructive">{replaceError}</p>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!isSearching && query.trim() && matchesByNote.length === 0 && (
          <p
            className="px-3 py-4 text-center text-xs text-foreground-muted"
            role="status"
            aria-live="polite"
          >
            No results found
          </p>
        )}

        {matchesByNote.length > 0 && (
          <SearchReplaceResults
            matchesByNote={matchesByNote}
            totalMatches={totalMatches}
            excludedMatchIds={excludedMatchIds}
            isReplacing={isReplacing}
            showReplace={isReplaceExpanded}
            replaceText={replaceText}
            onMatchClick={handleMatchClick}
            onReplaceSingle={replaceSingle}
            onToggleExclusion={toggleMatchExclusion}
            onExcludeNote={excludeAllMatchesForNote}
            onIncludeNote={includeAllMatchesForNote}
            getReplacementPreview={getReplacementPreview}
          />
        )}

        {!query.trim() && !isSearching && (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-foreground-muted/50"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-xs text-foreground-muted">
              Search across all notes in your workspace.
            </p>
            <p className="text-2xs text-foreground-muted/70">
              Supports regular expressions, case-sensitive, and whole-word matching.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
