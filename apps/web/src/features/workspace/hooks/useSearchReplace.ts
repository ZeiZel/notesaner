import { useRef, useCallback } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '@/shared/api/client';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchMatch {
  /** Unique ID for this match (noteId + matchIndex). */
  id: string;
  /** Note ID containing the match. */
  noteId: string;
  /** Note title. */
  noteTitle: string;
  /** Note path (relative to workspace root). */
  notePath: string;
  /** The matched text. */
  matchText: string;
  /** Surrounding context before the match. */
  contextBefore: string;
  /** Surrounding context after the match. */
  contextAfter: string;
  /** Line number within the note (1-based). */
  lineNumber: number;
  /** Character offset within the line (0-based). */
  columnOffset: number;
}

export interface SearchReplaceOptions {
  query: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  wholeWord: boolean;
}

export interface ReplacePreview {
  matchId: string;
  /** Original text that will be replaced. */
  original: string;
  /** The text that will replace the original. */
  replacement: string;
  /** Updated context before. */
  contextBefore: string;
  /** Updated context after. */
  contextAfter: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SearchReplaceState {
  // Search options
  query: string;
  replaceText: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  wholeWord: boolean;

  // Results
  matches: SearchMatch[];
  totalMatches: number;
  isSearching: boolean;
  searchError: string | null;

  // Replace state
  isReplacing: boolean;
  replaceError: string | null;
  /** Matches excluded from bulk replace (user deselected them). */
  excludedMatchIds: Set<string>;

  // Panel visibility
  isOpen: boolean;
  /** Whether the replace section is expanded. */
  isReplaceExpanded: boolean;

  // Actions
  setQuery: (query: string) => void;
  setReplaceText: (text: string) => void;
  setIsRegex: (isRegex: boolean) => void;
  setIsCaseSensitive: (isCaseSensitive: boolean) => void;
  setWholeWord: (wholeWord: boolean) => void;
  setMatches: (matches: SearchMatch[], total: number) => void;
  setIsSearching: (searching: boolean) => void;
  setSearchError: (error: string | null) => void;
  setIsReplacing: (replacing: boolean) => void;
  setReplaceError: (error: string | null) => void;
  toggleMatchExclusion: (matchId: string) => void;
  excludeAllMatchesForNote: (noteId: string) => void;
  includeAllMatchesForNote: (noteId: string) => void;
  setOpen: (open: boolean) => void;
  setReplaceExpanded: (expanded: boolean) => void;
  reset: () => void;
}

export const useSearchReplaceStore = create<SearchReplaceState>()(
  devtools(
    (set) => ({
      // Initial state
      query: '',
      replaceText: '',
      isRegex: false,
      isCaseSensitive: false,
      wholeWord: false,
      matches: [],
      totalMatches: 0,
      isSearching: false,
      searchError: null,
      isReplacing: false,
      replaceError: null,
      excludedMatchIds: new Set<string>(),
      isOpen: false,
      isReplaceExpanded: false,

      // Actions
      setQuery: (query) => set({ query, searchError: null }, false, 'searchReplace/setQuery'),
      setReplaceText: (replaceText) => set({ replaceText }, false, 'searchReplace/setReplaceText'),
      setIsRegex: (isRegex) => set({ isRegex }, false, 'searchReplace/setIsRegex'),
      setIsCaseSensitive: (isCaseSensitive) =>
        set({ isCaseSensitive }, false, 'searchReplace/setIsCaseSensitive'),
      setWholeWord: (wholeWord) => set({ wholeWord }, false, 'searchReplace/setWholeWord'),
      setMatches: (matches, totalMatches) =>
        set(
          { matches, totalMatches, excludedMatchIds: new Set() },
          false,
          'searchReplace/setMatches',
        ),
      setIsSearching: (isSearching) => set({ isSearching }, false, 'searchReplace/setIsSearching'),
      setSearchError: (searchError) => set({ searchError }, false, 'searchReplace/setSearchError'),
      setIsReplacing: (isReplacing) => set({ isReplacing }, false, 'searchReplace/setIsReplacing'),
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
            for (const match of state.matches) {
              if (match.noteId === noteId) {
                next.add(match.id);
              }
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
            for (const match of state.matches) {
              if (match.noteId === noteId) {
                next.delete(match.id);
              }
            }
            return { excludedMatchIds: next };
          },
          false,
          'searchReplace/includeNote',
        ),
      setOpen: (isOpen) => set({ isOpen }, false, 'searchReplace/setOpen'),
      setReplaceExpanded: (isReplaceExpanded) =>
        set({ isReplaceExpanded }, false, 'searchReplace/setReplaceExpanded'),
      reset: () =>
        set(
          {
            query: '',
            replaceText: '',
            isRegex: false,
            isCaseSensitive: false,
            wholeWord: false,
            matches: [],
            totalMatches: 0,
            isSearching: false,
            searchError: null,
            isReplacing: false,
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
// API response types
// ---------------------------------------------------------------------------

interface WorkspaceSearchApiMatch {
  noteId: string;
  noteTitle: string;
  notePath: string;
  matchText: string;
  contextBefore: string;
  contextAfter: string;
  lineNumber: number;
  columnOffset: number;
}

interface WorkspaceSearchApiResponse {
  matches: WorkspaceSearchApiMatch[];
  total: number;
}

interface ReplaceApiResponse {
  replacedCount: number;
  modifiedNotes: string[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSearchReplace -- workspace-level search and replace.
 *
 * Manages search across all notes, with regex/case sensitivity support
 * and replace with preview. No useEffect: search is triggered by user
 * action via performSearch, not by state changes.
 */
export function useSearchReplace() {
  const store = useSearchReplaceStore();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Perform a workspace-wide search.
   * Cancels any in-flight search and debounces by 300ms.
   */
  const performSearch = useCallback(
    (query?: string) => {
      const searchQuery = query ?? store.query;

      // Cancel previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Cancel in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      if (!searchQuery.trim() || !workspaceId) {
        store.setMatches([], 0);
        store.setIsSearching(false);
        return;
      }

      // Validate regex before sending to server
      if (store.isRegex) {
        try {
          new RegExp(searchQuery);
        } catch {
          store.setSearchError('Invalid regular expression');
          return;
        }
      }

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        store.setIsSearching(true);
        store.setSearchError(null);

        try {
          const params = new URLSearchParams({
            q: searchQuery,
            regex: String(store.isRegex),
            caseSensitive: String(store.isCaseSensitive),
            wholeWord: String(store.wholeWord),
          });

          const response = await apiClient.get<WorkspaceSearchApiResponse>(
            `/api/workspaces/${workspaceId}/search?${params.toString()}`,
            { signal: controller.signal },
          );

          // Map API response to our SearchMatch type
          const matches: SearchMatch[] = response.matches.map((m, index) => ({
            id: `${m.noteId}-${index}`,
            noteId: m.noteId,
            noteTitle: m.noteTitle,
            notePath: m.notePath,
            matchText: m.matchText,
            contextBefore: m.contextBefore,
            contextAfter: m.contextAfter,
            lineNumber: m.lineNumber,
            columnOffset: m.columnOffset,
          }));

          store.setMatches(matches, response.total);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            // Search was cancelled — ignore
            return;
          }
          const message = error instanceof Error ? error.message : 'Search failed';
          store.setSearchError(message);
          store.setMatches([], 0);
        } finally {
          store.setIsSearching(false);
        }
      }, 300);
    },
    [workspaceId, store],
  );

  /**
   * Replace a single match.
   */
  const replaceSingle = useCallback(
    async (matchId: string) => {
      if (!workspaceId || store.replaceText === undefined) return;

      const match = store.matches.find((m) => m.id === matchId);
      if (!match) return;

      store.setIsReplacing(true);
      store.setReplaceError(null);

      try {
        await apiClient.post<ReplaceApiResponse>(`/api/workspaces/${workspaceId}/search/replace`, {
          matches: [
            {
              noteId: match.noteId,
              lineNumber: match.lineNumber,
              columnOffset: match.columnOffset,
              matchText: match.matchText,
            },
          ],
          replaceText: store.replaceText,
          isRegex: store.isRegex,
          isCaseSensitive: store.isCaseSensitive,
          wholeWord: store.wholeWord,
          query: store.query,
        });

        // Remove the replaced match from results
        const updatedMatches = store.matches.filter((m) => m.id !== matchId);
        store.setMatches(updatedMatches, store.totalMatches - 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Replace failed';
        store.setReplaceError(message);
      } finally {
        store.setIsReplacing(false);
      }
    },
    [workspaceId, store],
  );

  /**
   * Replace all non-excluded matches.
   */
  const replaceAll = useCallback(async () => {
    if (!workspaceId) return;

    const includedMatches = store.matches.filter((m) => !store.excludedMatchIds.has(m.id));

    if (includedMatches.length === 0) return;

    store.setIsReplacing(true);
    store.setReplaceError(null);

    try {
      await apiClient.post<ReplaceApiResponse>(`/api/workspaces/${workspaceId}/search/replace`, {
        matches: includedMatches.map((m) => ({
          noteId: m.noteId,
          lineNumber: m.lineNumber,
          columnOffset: m.columnOffset,
          matchText: m.matchText,
        })),
        replaceText: store.replaceText,
        isRegex: store.isRegex,
        isCaseSensitive: store.isCaseSensitive,
        wholeWord: store.wholeWord,
        query: store.query,
      });

      // Remove all replaced matches, keep only excluded ones
      const remainingMatches = store.matches.filter((m) => store.excludedMatchIds.has(m.id));
      store.setMatches(remainingMatches, store.totalMatches - includedMatches.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Replace all failed';
      store.setReplaceError(message);
    } finally {
      store.setIsReplacing(false);
    }
  }, [workspaceId, store]);

  /**
   * Generate a preview of what the replacement would look like for a match.
   */
  const getReplacementPreview = useCallback(
    (match: SearchMatch): ReplacePreview => {
      let replacement: string;

      if (store.isRegex) {
        try {
          const flags = store.isCaseSensitive ? 'g' : 'gi';
          const regex = new RegExp(store.query, flags);
          replacement = match.matchText.replace(regex, store.replaceText);
        } catch {
          replacement = store.replaceText;
        }
      } else {
        replacement = store.replaceText;
      }

      return {
        matchId: match.id,
        original: match.matchText,
        replacement,
        contextBefore: match.contextBefore,
        contextAfter: match.contextAfter,
      };
    },
    [store.query, store.replaceText, store.isRegex, store.isCaseSensitive],
  );

  /**
   * Group matches by note for the results display.
   */
  const matchesByNote = groupMatchesByNote(store.matches);

  /**
   * Count of included (non-excluded) matches.
   */
  const includedCount = store.matches.length - store.excludedMatchIds.size;

  return {
    // State (read from store)
    query: store.query,
    replaceText: store.replaceText,
    isRegex: store.isRegex,
    isCaseSensitive: store.isCaseSensitive,
    wholeWord: store.wholeWord,
    matches: store.matches,
    matchesByNote,
    totalMatches: store.totalMatches,
    isSearching: store.isSearching,
    searchError: store.searchError,
    isReplacing: store.isReplacing,
    replaceError: store.replaceError,
    excludedMatchIds: store.excludedMatchIds,
    isOpen: store.isOpen,
    isReplaceExpanded: store.isReplaceExpanded,
    includedCount,

    // Setters
    setQuery: store.setQuery,
    setReplaceText: store.setReplaceText,
    setIsRegex: store.setIsRegex,
    setIsCaseSensitive: store.setIsCaseSensitive,
    setWholeWord: store.setWholeWord,
    toggleMatchExclusion: store.toggleMatchExclusion,
    excludeAllMatchesForNote: store.excludeAllMatchesForNote,
    includeAllMatchesForNote: store.includeAllMatchesForNote,
    setOpen: store.setOpen,
    setReplaceExpanded: store.setReplaceExpanded,
    reset: store.reset,

    // Actions
    performSearch,
    replaceSingle,
    replaceAll,
    getReplacementPreview,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface NoteMatchGroup {
  noteId: string;
  noteTitle: string;
  notePath: string;
  matches: SearchMatch[];
}

function groupMatchesByNote(matches: SearchMatch[]): NoteMatchGroup[] {
  const groupMap = new Map<string, NoteMatchGroup>();

  for (const match of matches) {
    let group = groupMap.get(match.noteId);
    if (!group) {
      group = {
        noteId: match.noteId,
        noteTitle: match.noteTitle,
        notePath: match.notePath,
        matches: [],
      };
      groupMap.set(match.noteId, group);
    }
    group.matches.push(match);
  }

  return Array.from(groupMap.values());
}
