/**
 * useSearchReplace — workspace-level search and replace hook.
 *
 * Orchestrates the search-replace API calls and wires them to the Zustand store.
 * Search is triggered by user action (performSearch), not by state changes.
 * No useEffect usage.
 */

import { useRef, useCallback, useMemo } from 'react';
import { searchReplaceApi } from '@/shared/api/search-replace';
import type { MatchReference } from '@/shared/api/search-replace';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import {
  useSearchReplaceStore,
  groupMatchesByNote,
  type SearchReplaceMatch,
} from '../model/search-replace-store';

/** Debounce delay for preview search (ms). */
const SEARCH_DEBOUNCE_MS = 400;

export function useSearchReplace() {
  const store = useSearchReplaceStore();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // Search (preview)
  // -------------------------------------------------------------------------

  /**
   * Perform a workspace-wide search preview.
   * Cancels any in-flight request and debounces by SEARCH_DEBOUNCE_MS.
   */
  const performSearch = useCallback(
    (queryOverride?: string) => {
      const searchQuery = queryOverride ?? store.query;

      // Cancel previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Cancel in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      if (!searchQuery.trim() || !workspaceId) {
        store.clearMatches();
        store.setIsSearching(false);
        return;
      }

      // Validate regex before sending to server
      if (store.mode === 'regex') {
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
          const response = await searchReplaceApi.preview(workspaceId, {
            query: searchQuery,
            replacement: store.replacement,
            mode: store.mode,
            caseSensitive: store.caseSensitive,
            wholeWord: store.wholeWord,
          });

          // Enrich matches with stable IDs
          const matches: SearchReplaceMatch[] = response.matches.map((m) => ({
            ...m,
            id: `${m.noteId}-${m.lineNumber}-${m.columnOffset}`,
          }));

          store.setMatches(
            matches,
            response.totalMatches,
            response.notesAffected,
            response.truncated,
          );
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          const message = error instanceof Error ? error.message : 'Search failed';
          store.setSearchError(message);
          store.clearMatches();
        } finally {
          store.setIsSearching(false);
        }
      }, SEARCH_DEBOUNCE_MS);
    },
    [workspaceId, store],
  );

  // -------------------------------------------------------------------------
  // Replace single match
  // -------------------------------------------------------------------------

  const replaceSingle = useCallback(
    async (matchId: string) => {
      if (!workspaceId) return;

      const match = store.matches.find((m) => m.id === matchId);
      if (!match) return;

      store.setIsReplacing(true);
      store.setReplaceError(null);

      try {
        const matchRef: MatchReference = {
          noteId: match.noteId,
          lineNumber: match.lineNumber,
          columnOffset: match.columnOffset,
          matchText: match.matchText,
        };

        await searchReplaceApi.execute(workspaceId, {
          query: store.query,
          replacement: store.replacement,
          mode: store.mode,
          caseSensitive: store.caseSensitive,
          wholeWord: store.wholeWord,
          matches: [matchRef],
        });

        // Remove the replaced match from local state
        const updatedMatches = store.matches.filter((m) => m.id !== matchId);
        store.setMatches(
          updatedMatches,
          store.totalMatches - 1,
          // Recalculate notes affected
          new Set(updatedMatches.map((m) => m.noteId)).size,
          store.truncated,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Replace failed';
        store.setReplaceError(message);
      } finally {
        store.setIsReplacing(false);
      }
    },
    [workspaceId, store],
  );

  // -------------------------------------------------------------------------
  // Replace all (non-excluded)
  // -------------------------------------------------------------------------

  const replaceAll = useCallback(async () => {
    if (!workspaceId) return;

    const includedMatches = store.matches.filter((m) => !store.excludedMatchIds.has(m.id));

    if (includedMatches.length === 0) return;

    store.setIsReplacing(true);
    store.setReplaceProgress(0);
    store.setReplaceError(null);

    try {
      const matchRefs: MatchReference[] = includedMatches.map((m) => ({
        noteId: m.noteId,
        lineNumber: m.lineNumber,
        columnOffset: m.columnOffset,
        matchText: m.matchText,
      }));

      const result = await searchReplaceApi.execute(workspaceId, {
        query: store.query,
        replacement: store.replacement,
        mode: store.mode,
        caseSensitive: store.caseSensitive,
        wholeWord: store.wholeWord,
        matches: matchRefs,
      });

      store.setReplaceProgress(100);

      // Remove replaced matches, keep only excluded
      const remainingMatches = store.matches.filter((m) => store.excludedMatchIds.has(m.id));
      store.setMatches(
        remainingMatches,
        store.totalMatches - result.replacedCount,
        new Set(remainingMatches.map((m) => m.noteId)).size,
        store.truncated,
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Replace all failed';
      store.setReplaceError(message);
      return undefined;
    } finally {
      store.setIsReplacing(false);
    }
  }, [workspaceId, store]);

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const matchesByNote = useMemo(() => groupMatchesByNote(store.matches), [store.matches]);

  const includedCount = store.matches.length - store.excludedMatchIds.size;

  return {
    // State
    query: store.query,
    replacement: store.replacement,
    mode: store.mode,
    caseSensitive: store.caseSensitive,
    wholeWord: store.wholeWord,
    matches: store.matches,
    matchesByNote,
    totalMatches: store.totalMatches,
    notesAffected: store.notesAffected,
    truncated: store.truncated,
    isSearching: store.isSearching,
    searchError: store.searchError,
    isReplacing: store.isReplacing,
    replaceProgress: store.replaceProgress,
    replaceError: store.replaceError,
    excludedMatchIds: store.excludedMatchIds,
    isOpen: store.isOpen,
    isReplaceExpanded: store.isReplaceExpanded,
    includedCount,

    // Setters
    setQuery: store.setQuery,
    setReplacement: store.setReplacement,
    setMode: store.setMode,
    setCaseSensitive: store.setCaseSensitive,
    setWholeWord: store.setWholeWord,
    toggleMatchExclusion: store.toggleMatchExclusion,
    excludeAllMatchesForNote: store.excludeAllMatchesForNote,
    includeAllMatchesForNote: store.includeAllMatchesForNote,
    clearExclusions: store.clearExclusions,
    setOpen: store.setOpen,
    setReplaceExpanded: store.setReplaceExpanded,
    reset: store.reset,

    // Actions
    performSearch,
    replaceSingle,
    replaceAll,
  };
}
