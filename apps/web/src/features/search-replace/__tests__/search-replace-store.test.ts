import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchReplaceStore } from '../model/search-replace-store';
import { groupMatchesByNote } from '../model/search-replace-store';
import type { SearchReplaceMatch } from '../model/search-replace-store';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<SearchReplaceMatch> = {}): SearchReplaceMatch {
  return {
    id: 'note-1-3-10',
    noteId: 'note-1',
    noteTitle: 'Test Note',
    notePath: 'folder/test.md',
    matchText: 'TODO',
    contextBefore: 'This is a ',
    contextAfter: ' item',
    lineNumber: 3,
    columnOffset: 10,
    replacementPreview: 'DONE',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSearchReplaceStore', () => {
  beforeEach(() => {
    useSearchReplaceStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSearchReplaceStore.getState();
      expect(state.query).toBe('');
      expect(state.replacement).toBe('');
      expect(state.mode).toBe('plain');
      expect(state.caseSensitive).toBe(false);
      expect(state.wholeWord).toBe(false);
      expect(state.matches).toEqual([]);
      expect(state.totalMatches).toBe(0);
      expect(state.isOpen).toBe(false);
      expect(state.isReplaceExpanded).toBe(false);
    });
  });

  describe('setQuery', () => {
    it('updates query and clears search error', () => {
      const store = useSearchReplaceStore.getState();
      store.setSearchError('some error');
      store.setQuery('new query');

      const updated = useSearchReplaceStore.getState();
      expect(updated.query).toBe('new query');
      expect(updated.searchError).toBeNull();
    });
  });

  describe('setMatches', () => {
    it('updates matches and resets exclusions', () => {
      const store = useSearchReplaceStore.getState();
      store.toggleMatchExclusion('old-id');

      const matches = [makeMatch()];
      store.setMatches(matches, 1, 1, false);

      const updated = useSearchReplaceStore.getState();
      expect(updated.matches).toEqual(matches);
      expect(updated.totalMatches).toBe(1);
      expect(updated.notesAffected).toBe(1);
      expect(updated.excludedMatchIds.size).toBe(0);
    });
  });

  describe('toggleMatchExclusion', () => {
    it('adds match ID to exclusion set', () => {
      const store = useSearchReplaceStore.getState();
      store.toggleMatchExclusion('match-1');

      expect(useSearchReplaceStore.getState().excludedMatchIds.has('match-1')).toBe(true);
    });

    it('removes match ID from exclusion set on second toggle', () => {
      const store = useSearchReplaceStore.getState();
      store.toggleMatchExclusion('match-1');
      store.toggleMatchExclusion('match-1');

      expect(useSearchReplaceStore.getState().excludedMatchIds.has('match-1')).toBe(false);
    });
  });

  describe('excludeAllMatchesForNote / includeAllMatchesForNote', () => {
    it('excludes all matches for a specific note', () => {
      const store = useSearchReplaceStore.getState();
      const matches = [
        makeMatch({ id: 'm1', noteId: 'note-1' }),
        makeMatch({ id: 'm2', noteId: 'note-1' }),
        makeMatch({ id: 'm3', noteId: 'note-2' }),
      ];
      store.setMatches(matches, 3, 2, false);
      store.excludeAllMatchesForNote('note-1');

      const excluded = useSearchReplaceStore.getState().excludedMatchIds;
      expect(excluded.has('m1')).toBe(true);
      expect(excluded.has('m2')).toBe(true);
      expect(excluded.has('m3')).toBe(false);
    });

    it('includes all matches for a specific note', () => {
      const store = useSearchReplaceStore.getState();
      const matches = [
        makeMatch({ id: 'm1', noteId: 'note-1' }),
        makeMatch({ id: 'm2', noteId: 'note-1' }),
      ];
      store.setMatches(matches, 2, 1, false);
      store.excludeAllMatchesForNote('note-1');
      store.includeAllMatchesForNote('note-1');

      const excluded = useSearchReplaceStore.getState().excludedMatchIds;
      expect(excluded.has('m1')).toBe(false);
      expect(excluded.has('m2')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to defaults', () => {
      const store = useSearchReplaceStore.getState();
      store.setQuery('test');
      store.setReplacement('replace');
      store.setMode('regex');
      store.setCaseSensitive(true);
      store.setWholeWord(true);
      store.setOpen(true);
      store.setMatches([makeMatch()], 1, 1, false);

      store.reset();

      const reset = useSearchReplaceStore.getState();
      expect(reset.query).toBe('');
      expect(reset.replacement).toBe('');
      expect(reset.mode).toBe('plain');
      expect(reset.caseSensitive).toBe(false);
      expect(reset.wholeWord).toBe(false);
      expect(reset.matches).toEqual([]);
      expect(reset.isOpen).toBe(false);
    });
  });

  describe('panel visibility', () => {
    it('setOpen toggles panel visibility', () => {
      const store = useSearchReplaceStore.getState();
      store.setOpen(true);
      expect(useSearchReplaceStore.getState().isOpen).toBe(true);

      store.setOpen(false);
      expect(useSearchReplaceStore.getState().isOpen).toBe(false);
    });

    it('setReplaceExpanded toggles replace section', () => {
      const store = useSearchReplaceStore.getState();
      store.setReplaceExpanded(true);
      expect(useSearchReplaceStore.getState().isReplaceExpanded).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// groupMatchesByNote
// ---------------------------------------------------------------------------

describe('groupMatchesByNote', () => {
  it('groups matches by noteId', () => {
    const matches: SearchReplaceMatch[] = [
      makeMatch({ id: 'm1', noteId: 'note-1', noteTitle: 'Note 1', notePath: 'n1.md' }),
      makeMatch({ id: 'm2', noteId: 'note-1', noteTitle: 'Note 1', notePath: 'n1.md' }),
      makeMatch({ id: 'm3', noteId: 'note-2', noteTitle: 'Note 2', notePath: 'n2.md' }),
    ];

    const groups = groupMatchesByNote(matches);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.noteId).toBe('note-1');
    expect(groups[0]?.matches).toHaveLength(2);
    expect(groups[1]?.noteId).toBe('note-2');
    expect(groups[1]?.matches).toHaveLength(1);
  });

  it('returns empty array for no matches', () => {
    expect(groupMatchesByNote([])).toEqual([]);
  });

  it('preserves match order within groups', () => {
    const matches: SearchReplaceMatch[] = [
      makeMatch({ id: 'm1', noteId: 'note-1', lineNumber: 5 }),
      makeMatch({ id: 'm2', noteId: 'note-1', lineNumber: 10 }),
      makeMatch({ id: 'm3', noteId: 'note-1', lineNumber: 15 }),
    ];

    const groups = groupMatchesByNote(matches);
    expect(groups[0]?.matches.map((m) => m.lineNumber)).toEqual([5, 10, 15]);
  });
});
