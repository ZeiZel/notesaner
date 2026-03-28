'use client';

/**
 * SearchReplaceResults -- results list with match context previews.
 *
 * Displays search matches grouped by note. Each match shows:
 * - Surrounding context with the matched text highlighted
 * - Line number and path
 * - Replacement preview (when replace text is provided)
 * - Individual replace / exclude buttons
 *
 * Click a match to navigate to it in the editor.
 */

import { useCallback, useState } from 'react';
import type { SearchMatch, NoteMatchGroup, ReplacePreview } from '../hooks/useSearchReplace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchReplaceResultsProps {
  /** Matches grouped by note. */
  matchesByNote: NoteMatchGroup[];
  /** Total number of matches. */
  totalMatches: number;
  /** Set of match IDs excluded from bulk replace. */
  excludedMatchIds: Set<string>;
  /** Whether a replace operation is in progress. */
  isReplacing: boolean;
  /** Whether the replace section is visible. */
  showReplace: boolean;
  /** Replace text for preview. */
  replaceText: string;
  /** Called when a match row is clicked (navigate to match). */
  onMatchClick: (match: SearchMatch) => void;
  /** Called when the user clicks "Replace" on a single match. */
  onReplaceSingle: (matchId: string) => void;
  /** Called to toggle a match's exclusion from bulk replace. */
  onToggleExclusion: (matchId: string) => void;
  /** Called to exclude all matches for a note. */
  onExcludeNote: (noteId: string) => void;
  /** Called to include all matches for a note. */
  onIncludeNote: (noteId: string) => void;
  /** Generate a replacement preview for a match. */
  getReplacementPreview: (match: SearchMatch) => ReplacePreview;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-foreground-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-primary/60"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
      <path d="M9.5 1.5v2.75c0 .138.112.25.25.25h2.75L9.5 1.5z" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Match context renderer
// ---------------------------------------------------------------------------

function MatchContext({
  match,
  preview,
  showReplace,
}: {
  match: SearchMatch;
  preview: ReplacePreview | null;
  showReplace: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Original text with match highlighted */}
      <span className="font-mono text-xs leading-relaxed text-foreground-secondary">
        <span className="text-foreground-muted">{match.contextBefore}</span>
        <mark className="rounded-sm bg-warning/30 px-0.5 text-foreground font-medium">
          {match.matchText}
        </mark>
        <span className="text-foreground-muted">{match.contextAfter}</span>
      </span>

      {/* Replacement preview */}
      {showReplace && preview && (
        <span className="font-mono text-xs leading-relaxed text-foreground-secondary">
          <span className="text-foreground-muted">{preview.contextBefore}</span>
          <mark className="rounded-sm bg-success/30 px-0.5 text-success-foreground font-medium">
            {preview.replacement}
          </mark>
          <span className="text-foreground-muted">{preview.contextAfter}</span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single match row
// ---------------------------------------------------------------------------

function MatchRow({
  match,
  isExcluded,
  isReplacing,
  showReplace,
  preview,
  onMatchClick,
  onReplaceSingle,
  onToggleExclusion,
}: {
  match: SearchMatch;
  isExcluded: boolean;
  isReplacing: boolean;
  showReplace: boolean;
  preview: ReplacePreview | null;
  onMatchClick: (match: SearchMatch) => void;
  onReplaceSingle: (matchId: string) => void;
  onToggleExclusion: (matchId: string) => void;
}) {
  return (
    <div
      className={`group flex items-start gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-accent ${
        isExcluded ? 'opacity-50' : ''
      }`}
    >
      {/* Checkbox for include/exclude */}
      {showReplace && (
        <label
          className="mt-0.5 flex shrink-0 items-center"
          aria-label={`Include match in replace`}
        >
          <input
            type="checkbox"
            checked={!isExcluded}
            onChange={() => onToggleExclusion(match.id)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
        </label>
      )}

      {/* Match content (clickable) */}
      <button
        type="button"
        onClick={() => onMatchClick(match)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
        aria-label={`Go to match at line ${match.lineNumber} in ${match.noteTitle}`}
      >
        <span className="text-2xs text-foreground-muted">Line {match.lineNumber}</span>
        <MatchContext match={match} preview={preview} showReplace={showReplace} />
      </button>

      {/* Replace single button */}
      {showReplace && !isExcluded && (
        <button
          type="button"
          onClick={() => onReplaceSingle(match.id)}
          disabled={isReplacing}
          className="mt-0.5 shrink-0 rounded-sm p-1 text-foreground-muted opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
          title="Replace this match"
          aria-label="Replace this match"
        >
          <ReplaceIcon />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note group
// ---------------------------------------------------------------------------

function NoteGroup({
  group,
  excludedMatchIds,
  isReplacing,
  showReplace,
  onMatchClick,
  onReplaceSingle,
  onToggleExclusion,
  onExcludeNote,
  onIncludeNote,
  getReplacementPreview,
}: {
  group: NoteMatchGroup;
  excludedMatchIds: Set<string>;
  isReplacing: boolean;
  showReplace: boolean;
  onMatchClick: (match: SearchMatch) => void;
  onReplaceSingle: (matchId: string) => void;
  onToggleExclusion: (matchId: string) => void;
  onExcludeNote: (noteId: string) => void;
  onIncludeNote: (noteId: string) => void;
  getReplacementPreview: (match: SearchMatch) => ReplacePreview;
}) {
  const [expanded, setExpanded] = useState(true);

  const allExcluded = group.matches.every((m) => excludedMatchIds.has(m.id));
  const someExcluded = group.matches.some((m) => excludedMatchIds.has(m.id));

  const handleNoteCheckbox = useCallback(() => {
    if (allExcluded || !someExcluded) {
      // If all excluded or none excluded, toggle all
      if (allExcluded) {
        onIncludeNote(group.noteId);
      } else {
        onExcludeNote(group.noteId);
      }
    } else {
      // If some excluded, include all
      onIncludeNote(group.noteId);
    }
  }, [allExcluded, someExcluded, group.noteId, onExcludeNote, onIncludeNote]);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Note header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {showReplace && (
          <label
            className="flex shrink-0 items-center"
            aria-label={`Include all matches in ${group.noteTitle}`}
          >
            <input
              type="checkbox"
              checked={!allExcluded}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someExcluded && !allExcluded;
                }
              }}
              onChange={handleNoteCheckbox}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={expanded}
          aria-label={`${group.noteTitle}, ${group.matches.length} matches`}
        >
          <ChevronIcon expanded={expanded} />
          <FileIcon />
          <span className="truncate text-sm font-medium text-foreground">
            {group.noteTitle || 'Untitled'}
          </span>
          <span className="shrink-0 text-xs text-foreground-muted">{group.matches.length}</span>
        </button>
      </div>

      {/* Note path */}
      {expanded && (
        <div className="px-2 pb-1">
          <span className="text-2xs text-foreground-muted">{group.notePath}</span>
        </div>
      )}

      {/* Match rows */}
      {expanded && (
        <div className="flex flex-col pb-1 pl-2">
          {group.matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              isExcluded={excludedMatchIds.has(match.id)}
              isReplacing={isReplacing}
              showReplace={showReplace}
              preview={showReplace ? getReplacementPreview(match) : null}
              onMatchClick={onMatchClick}
              onReplaceSingle={onReplaceSingle}
              onToggleExclusion={onToggleExclusion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SearchReplaceResults({
  matchesByNote,
  totalMatches,
  excludedMatchIds,
  isReplacing,
  showReplace,
  replaceText: _replaceText,
  onMatchClick,
  onReplaceSingle,
  onToggleExclusion,
  onExcludeNote,
  onIncludeNote,
  getReplacementPreview,
}: SearchReplaceResultsProps) {
  // replaceText is exposed in the props API for consumers that need it;
  // this component delegates preview rendering to getReplacementPreview.
  void _replaceText;
  if (matchesByNote.length === 0) {
    return null;
  }

  const noteCount = matchesByNote.length;

  return (
    <div className="flex flex-col" role="region" aria-label="Search results">
      {/* Summary header */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-xs text-foreground-muted" role="status" aria-live="polite">
          {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {noteCount} note
          {noteCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Results list */}
      <div className="flex flex-col overflow-y-auto">
        {matchesByNote.map((group) => (
          <NoteGroup
            key={group.noteId}
            group={group}
            excludedMatchIds={excludedMatchIds}
            isReplacing={isReplacing}
            showReplace={showReplace}
            onMatchClick={onMatchClick}
            onReplaceSingle={onReplaceSingle}
            onToggleExclusion={onToggleExclusion}
            onExcludeNote={onExcludeNote}
            onIncludeNote={onIncludeNote}
            getReplacementPreview={getReplacementPreview}
          />
        ))}
      </div>
    </div>
  );
}
