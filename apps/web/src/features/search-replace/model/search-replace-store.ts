/**
 * search-replace-store.ts
 *
 * Zustand store for workspace-level search & replace business logic.
 * Manages search state, match data, and API interactions.
 *
 * UI-only state (panel visibility, expanded sections) is kept here as minor
 * fields that do not justify a separate context/useState split.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SearchReplaceMatchDto, SearchReplaceMode } from '@/shared/api/search-replace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A match enriched with a stable client-side ID. */
export interface SearchReplaceMatch extends SearchReplaceMatchDto {
  /** Stable ID: `${noteId}-${lineNumber}-${columnOffset}` */
  id: string;
}

/** Matches grouped by note for display. */
export interface NoteMatchGroup {
  noteId: string;
  noteTitle: string;
  notePath: string;
  matches: SearchReplaceMatch[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface SearchReplaceState {
  // -- Search options --
  query: string;
  replacement: string;
  mode: SearchReplaceMode;
  caseSensitive: boolean;
  wholeWord: boolean;

  // -- Results --
  matches: SearchReplaceMatch[];
  totalMatches: number;
  notesAffected: number;
  truncated: boolean;

  // -- Loading / error --
  isSearching: boolean;
  searchError: string | null;
  isReplacing: boolean;
  replaceProgress: number; // 0-100
  replaceError: string | null;

  // -- Selection --
  /** Match IDs excluded from bulk replacement. */
  excludedMatchIds: Set<string>;

  // -- Panel visibility --
  isOpen: boolean;
  isReplaceExpanded: boolean;

  // -- Actions --
  setQuery: (query: string) => void;
  setReplacement: (replacement: string) => void;
  setMode: (mode: SearchReplaceMode) => void;
  setCaseSensitive: (v: boolean) => void;
  setWholeWord: (v: boolean) => void;

  setMatches: (
    matches: SearchReplaceMatch[],
    total: number,
    notesAffected: number,
    truncated: boolean,
  ) => void;
  clearMatches: () => void;

  setIsSearching: (v: boolean) => void;
  setSearchError: (error: string | null) => void;
  setIsReplacing: (v: boolean) => void;
  setReplaceProgress: (progress: number) => void;
  setReplaceError: (error: string | null) => void;

  toggleMatchExclusion: (matchId: string) => void;
  excludeAllMatchesForNote: (noteId: string) => void;
  includeAllMatchesForNote: (noteId: string) => void;
  clearExclusions: () => void;

  setOpen: (open: boolean) => void;
  setReplaceExpanded: (expanded: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSearchReplaceStore = create<SearchReplaceState>()(
  devtools(
    (set) => ({
      // Initial state
      query: '',
      replacement: '',
      mode: 'plain' as SearchReplaceMode,
      caseSensitive: false,
      wholeWord: false,

      matches: [],
      totalMatches: 0,
      notesAffected: 0,
      truncated: false,

      isSearching: false,
      searchError: null,
      isReplacing: false,
      replaceProgress: 0,
      replaceError: null,

      excludedMatchIds: new Set<string>(),

      isOpen: false,
      isReplaceExpanded: false,

      // -- Actions --
      setQuery: (query) => set({ query, searchError: null }, false, 'searchReplace/setQuery'),
      setReplacement: (replacement) => set({ replacement }, false, 'searchReplace/setReplacement'),
      setMode: (mode) => set({ mode }, false, 'searchReplace/setMode'),
      setCaseSensitive: (caseSensitive) =>
        set({ caseSensitive }, false, 'searchReplace/setCaseSensitive'),
      setWholeWord: (wholeWord) => set({ wholeWord }, false, 'searchReplace/setWholeWord'),

      setMatches: (matches, totalMatches, notesAffected, truncated) =>
        set(
          { matches, totalMatches, notesAffected, truncated, excludedMatchIds: new Set() },
          false,
          'searchReplace/setMatches',
        ),
      clearMatches: () =>
        set(
          {
            matches: [],
            totalMatches: 0,
            notesAffected: 0,
            truncated: false,
            excludedMatchIds: new Set(),
          },
          false,
          'searchReplace/clearMatches',
        ),

      setIsSearching: (isSearching) => set({ isSearching }, false, 'searchReplace/setIsSearching'),
      setSearchError: (searchError) => set({ searchError }, false, 'searchReplace/setSearchError'),
      setIsReplacing: (isReplacing) => set({ isReplacing }, false, 'searchReplace/setIsReplacing'),
      setReplaceProgress: (replaceProgress) =>
        set({ replaceProgress }, false, 'searchReplace/setReplaceProgress'),
      setReplaceError: (replaceError) =>
        set({ replaceError }, false, 'searchReplace/setReplaceError'),

      toggleMatchExclusion: (matchId) =>
        set(
          (state) => {
            const next = new Set(state.excludedMatchIds);
            if (next.has(matchId)) {
              next.delete(matchId);
            } else {
              next.add(matchId);
            }
            return { excludedMatchIds: next };
          },
          false,
          'searchReplace/toggleExclusion',
        ),
      excludeAllMatchesForNote: (noteId) =>
        set(
          (state) => {
            const next = new Set(state.excludedMatchIds);
            for (const m of state.matches) {
              if (m.noteId === noteId) next.add(m.id);
            }
            return { excludedMatchIds: next };
          },
          false,
          'searchReplace/excludeNote',
        ),
      includeAllMatchesForNote: (noteId) =>
        set(
          (state) => {
            const next = new Set(state.excludedMatchIds);
            for (const m of state.matches) {
              if (m.noteId === noteId) next.delete(m.id);
            }
            return { excludedMatchIds: next };
          },
          false,
          'searchReplace/includeNote',
        ),
      clearExclusions: () =>
        set({ excludedMatchIds: new Set() }, false, 'searchReplace/clearExclusions'),

      setOpen: (isOpen) => set({ isOpen }, false, 'searchReplace/setOpen'),
      setReplaceExpanded: (isReplaceExpanded) =>
        set({ isReplaceExpanded }, false, 'searchReplace/setReplaceExpanded'),

      reset: () =>
        set(
          {
            query: '',
            replacement: '',
            mode: 'plain' as SearchReplaceMode,
            caseSensitive: false,
            wholeWord: false,
            matches: [],
            totalMatches: 0,
            notesAffected: 0,
            truncated: false,
            isSearching: false,
            searchError: null,
            isReplacing: false,
            replaceProgress: 0,
            replaceError: null,
            excludedMatchIds: new Set(),
            isOpen: false,
            isReplaceExpanded: false,
          },
          false,
          'searchReplace/reset',
        ),
    }),
    { name: 'SearchReplaceStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors / Helpers
// ---------------------------------------------------------------------------

/**
 * Group matches by note for the results list.
 */
export function groupMatchesByNote(matches: SearchReplaceMatch[]): NoteMatchGroup[] {
  const map = new Map<string, NoteMatchGroup>();

  for (const match of matches) {
    let group = map.get(match.noteId);
    if (!group) {
      group = {
        noteId: match.noteId,
        noteTitle: match.noteTitle,
        notePath: match.notePath,
        matches: [],
      };
      map.set(match.noteId, group);
    }
    group.matches.push(match);
  }

  return Array.from(map.values());
}
