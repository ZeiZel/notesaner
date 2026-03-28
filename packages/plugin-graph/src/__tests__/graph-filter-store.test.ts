/**
 * Tests for graph-filter-store.ts
 *
 * Covers:
 * - All store actions (setSearchQuery, toggleTag, toggleFolder, setDateRange,
 *   toggleLinkType, setShowOrphans, clearAllFilters, applyFilterState,
 *   savePreset, deletePreset, loadPreset)
 * - Derived activeFilterCount via computeActiveFilterCount
 * - Selector helpers (selectFilterState, selectPresetList)
 *
 * Strategy: each test resets the store to its initial state via resetStore().
 * Persistence (localStorage) is not tested here — that responsibility lives
 * in the Zustand persist middleware which has its own test suite.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useGraphFilterStore,
  computeActiveFilterCount,
  selectFilterState,
  selectPresetList,
  type GraphFilterState,
} from '../graph-filter-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_STATE: GraphFilterState = {
  searchQuery: '',
  selectedTags: [],
  selectedFolders: [],
  dateRange: { from: null, to: null },
  selectedLinkTypes: [],
  showOrphans: true,
};

function resetStore() {
  localStorage.clear();
  useGraphFilterStore.setState({
    ...DEFAULT_STATE,
    activeFilterCount: 0,
    savedFilterPresets: [],
  });
}

function getState() {
  return useGraphFilterStore.getState();
}

// ---------------------------------------------------------------------------
// computeActiveFilterCount (pure function)
// ---------------------------------------------------------------------------

describe('computeActiveFilterCount', () => {
  it('returns 0 when all filters are at defaults', () => {
    expect(computeActiveFilterCount(DEFAULT_STATE)).toBe(0);
  });

  it('counts a non-empty search query as 1', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, searchQuery: 'foo' })).toBe(1);
  });

  it('counts whitespace-only search query as 0', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, searchQuery: '   ' })).toBe(0);
  });

  it('counts selected tags as 1 regardless of how many tags are selected', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, selectedTags: ['a'] })).toBe(1);
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, selectedTags: ['a', 'b', 'c'] })).toBe(1);
  });

  it('counts selected folders as 1 regardless of how many folders are selected', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, selectedFolders: ['projects'] })).toBe(1);
  });

  it('counts a date range with only "from" as 1', () => {
    expect(
      computeActiveFilterCount({ ...DEFAULT_STATE, dateRange: { from: '2024-01-01', to: null } }),
    ).toBe(1);
  });

  it('counts a date range with only "to" as 1', () => {
    expect(
      computeActiveFilterCount({ ...DEFAULT_STATE, dateRange: { from: null, to: '2024-12-31' } }),
    ).toBe(1);
  });

  it('counts a full date range as 1 (not 2)', () => {
    expect(
      computeActiveFilterCount({
        ...DEFAULT_STATE,
        dateRange: { from: '2024-01-01', to: '2024-12-31' },
      }),
    ).toBe(1);
  });

  it('counts selected link types as 1', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, selectedLinkTypes: ['WIKI'] })).toBe(1);
  });

  it('counts showOrphans = false as 1', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, showOrphans: false })).toBe(1);
  });

  it('does not count showOrphans = true (default)', () => {
    expect(computeActiveFilterCount({ ...DEFAULT_STATE, showOrphans: true })).toBe(0);
  });

  it('accumulates counts across multiple active dimensions', () => {
    const state: GraphFilterState = {
      searchQuery: 'react',
      selectedTags: ['typescript'],
      selectedFolders: ['projects'],
      dateRange: { from: '2024-01-01', to: null },
      selectedLinkTypes: ['WIKI', 'EMBED'],
      showOrphans: false,
    };
    expect(computeActiveFilterCount(state)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// setSearchQuery
// ---------------------------------------------------------------------------

describe('setSearchQuery', () => {
  beforeEach(resetStore);

  it('updates the search query', () => {
    getState().setSearchQuery('hello world');
    expect(getState().searchQuery).toBe('hello world');
  });

  it('replaces an existing query', () => {
    getState().setSearchQuery('first');
    getState().setSearchQuery('second');
    expect(getState().searchQuery).toBe('second');
  });

  it('clears the query when set to empty string', () => {
    getState().setSearchQuery('something');
    getState().setSearchQuery('');
    expect(getState().searchQuery).toBe('');
  });
});

// ---------------------------------------------------------------------------
// setSelectedTags / toggleTag
// ---------------------------------------------------------------------------

describe('tag filters', () => {
  beforeEach(resetStore);

  it('setSelectedTags replaces the entire tag list', () => {
    getState().setSelectedTags(['a', 'b', 'c']);
    expect(getState().selectedTags).toEqual(['a', 'b', 'c']);
  });

  it('toggleTag adds a tag when it is not selected', () => {
    getState().toggleTag('typescript');
    expect(getState().selectedTags).toContain('typescript');
  });

  it('toggleTag removes a tag when it is already selected', () => {
    getState().setSelectedTags(['react', 'typescript']);
    getState().toggleTag('react');
    expect(getState().selectedTags).not.toContain('react');
    expect(getState().selectedTags).toContain('typescript');
  });

  it('toggleTag maintains other tags when adding', () => {
    getState().setSelectedTags(['react']);
    getState().toggleTag('typescript');
    expect(getState().selectedTags).toHaveLength(2);
  });

  it('toggleTag on an empty list starts with one tag', () => {
    getState().toggleTag('newtag');
    expect(getState().selectedTags).toEqual(['newtag']);
  });
});

// ---------------------------------------------------------------------------
// setSelectedFolders / toggleFolder
// ---------------------------------------------------------------------------

describe('folder filters', () => {
  beforeEach(resetStore);

  it('setSelectedFolders replaces the entire folder list', () => {
    getState().setSelectedFolders(['projects', 'notes']);
    expect(getState().selectedFolders).toEqual(['projects', 'notes']);
  });

  it('toggleFolder adds a folder when not selected', () => {
    getState().toggleFolder('projects');
    expect(getState().selectedFolders).toContain('projects');
  });

  it('toggleFolder removes a folder when already selected', () => {
    getState().setSelectedFolders(['projects', 'notes']);
    getState().toggleFolder('projects');
    expect(getState().selectedFolders).not.toContain('projects');
    expect(getState().selectedFolders).toContain('notes');
  });

  it('toggleFolder does not duplicate an existing folder', () => {
    getState().toggleFolder('projects');
    getState().toggleFolder('projects');
    expect(getState().selectedFolders).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setDateRange
// ---------------------------------------------------------------------------

describe('setDateRange', () => {
  beforeEach(resetStore);

  it('updates from date', () => {
    getState().setDateRange({ from: '2024-01-01', to: null });
    expect(getState().dateRange.from).toBe('2024-01-01');
    expect(getState().dateRange.to).toBeNull();
  });

  it('updates to date', () => {
    getState().setDateRange({ from: null, to: '2024-12-31' });
    expect(getState().dateRange.to).toBe('2024-12-31');
  });

  it('updates both bounds', () => {
    getState().setDateRange({ from: '2024-01-01', to: '2024-12-31' });
    const { dateRange } = getState();
    expect(dateRange.from).toBe('2024-01-01');
    expect(dateRange.to).toBe('2024-12-31');
  });

  it('clears both bounds when set to null', () => {
    getState().setDateRange({ from: '2024-01-01', to: '2024-12-31' });
    getState().setDateRange({ from: null, to: null });
    const { dateRange } = getState();
    expect(dateRange.from).toBeNull();
    expect(dateRange.to).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setSelectedLinkTypes / toggleLinkType
// ---------------------------------------------------------------------------

describe('link type filters', () => {
  beforeEach(resetStore);

  it('setSelectedLinkTypes replaces the list', () => {
    getState().setSelectedLinkTypes(['WIKI', 'EMBED']);
    expect(getState().selectedLinkTypes).toEqual(['WIKI', 'EMBED']);
  });

  it('toggleLinkType adds a type when not selected', () => {
    getState().toggleLinkType('WIKI');
    expect(getState().selectedLinkTypes).toContain('WIKI');
  });

  it('toggleLinkType removes a type when already selected', () => {
    getState().setSelectedLinkTypes(['WIKI', 'MARKDOWN']);
    getState().toggleLinkType('WIKI');
    expect(getState().selectedLinkTypes).not.toContain('WIKI');
    expect(getState().selectedLinkTypes).toContain('MARKDOWN');
  });

  it('toggling back and forth works correctly', () => {
    getState().toggleLinkType('EMBED');
    getState().toggleLinkType('EMBED');
    expect(getState().selectedLinkTypes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setShowOrphans
// ---------------------------------------------------------------------------

describe('setShowOrphans', () => {
  beforeEach(resetStore);

  it('sets showOrphans to false', () => {
    getState().setShowOrphans(false);
    expect(getState().showOrphans).toBe(false);
  });

  it('sets showOrphans back to true', () => {
    getState().setShowOrphans(false);
    getState().setShowOrphans(true);
    expect(getState().showOrphans).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearAllFilters
// ---------------------------------------------------------------------------

describe('clearAllFilters', () => {
  beforeEach(resetStore);

  it('resets all filter dimensions to defaults', () => {
    getState().setSearchQuery('test');
    getState().setSelectedTags(['react']);
    getState().setSelectedFolders(['projects']);
    getState().setDateRange({ from: '2024-01-01', to: '2024-12-31' });
    getState().setSelectedLinkTypes(['WIKI']);
    getState().setShowOrphans(false);

    getState().clearAllFilters();

    const s = getState();
    expect(s.searchQuery).toBe('');
    expect(s.selectedTags).toHaveLength(0);
    expect(s.selectedFolders).toHaveLength(0);
    expect(s.dateRange).toEqual({ from: null, to: null });
    expect(s.selectedLinkTypes).toHaveLength(0);
    expect(s.showOrphans).toBe(true);
  });

  it('does not clear saved presets', () => {
    getState().savePreset('My Preset');
    getState().clearAllFilters();
    expect(getState().savedFilterPresets).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applyFilterState
// ---------------------------------------------------------------------------

describe('applyFilterState', () => {
  beforeEach(resetStore);

  it('applies the full provided filter state', () => {
    const target: GraphFilterState = {
      searchQuery: 'architecture',
      selectedTags: ['design', 'backend'],
      selectedFolders: ['docs'],
      dateRange: { from: '2023-01-01', to: '2023-12-31' },
      selectedLinkTypes: ['MARKDOWN'],
      showOrphans: false,
    };

    getState().applyFilterState(target);
    const s = getState();

    expect(s.searchQuery).toBe('architecture');
    expect(s.selectedTags).toEqual(['design', 'backend']);
    expect(s.selectedFolders).toEqual(['docs']);
    expect(s.dateRange).toEqual({ from: '2023-01-01', to: '2023-12-31' });
    expect(s.selectedLinkTypes).toEqual(['MARKDOWN']);
    expect(s.showOrphans).toBe(false);
  });

  it('overrides all existing filter values', () => {
    getState().setSearchQuery('old query');
    getState().setSelectedTags(['old-tag']);

    getState().applyFilterState({ ...DEFAULT_STATE, searchQuery: 'new query' });

    expect(getState().searchQuery).toBe('new query');
    expect(getState().selectedTags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// savePreset
// ---------------------------------------------------------------------------

describe('savePreset', () => {
  beforeEach(resetStore);

  it('creates a new preset with the current filter state', () => {
    getState().setSearchQuery('test query');
    getState().setSelectedTags(['react']);
    const id = getState().savePreset('Test Preset');

    const preset = getState().savedFilterPresets.find((p) => p.id === id);
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('Test Preset');
    expect(preset!.filters.searchQuery).toBe('test query');
    expect(preset!.filters.selectedTags).toContain('react');
    expect(preset!.savedAt).toBeGreaterThan(0);
  });

  it('uses "Untitled preset" when name is empty', () => {
    const id = getState().savePreset('');
    const preset = getState().savedFilterPresets.find((p) => p.id === id);
    expect(preset!.name).toBe('Untitled preset');
  });

  it('uses "Untitled preset" when name is only whitespace', () => {
    const id = getState().savePreset('   ');
    const preset = getState().savedFilterPresets.find((p) => p.id === id);
    expect(preset!.name).toBe('Untitled preset');
  });

  it('updates an existing preset when the same name is used', () => {
    getState().setSearchQuery('first');
    const id1 = getState().savePreset('Shared Name');

    getState().setSearchQuery('second');
    const id2 = getState().savePreset('Shared Name');

    expect(id1).toBe(id2);
    const preset = getState().savedFilterPresets.find((p) => p.id === id1);
    expect(preset!.filters.searchQuery).toBe('second');
  });

  it('stores multiple presets independently', () => {
    getState().savePreset('Preset A');
    getState().savePreset('Preset B');
    expect(getState().savedFilterPresets).toHaveLength(2);
  });

  it('captures a snapshot (mutations after save do not affect preset)', () => {
    getState().setSelectedTags(['react']);
    const id = getState().savePreset('Snapshot');

    getState().toggleTag('react'); // remove react

    const preset = getState().savedFilterPresets.find((p) => p.id === id);
    expect(preset!.filters.selectedTags).toContain('react');
  });
});

// ---------------------------------------------------------------------------
// deletePreset
// ---------------------------------------------------------------------------

describe('deletePreset', () => {
  beforeEach(resetStore);

  it('removes the preset from the list', () => {
    const id = getState().savePreset('To Delete');
    getState().deletePreset(id);
    expect(getState().savedFilterPresets.find((p) => p.id === id)).toBeUndefined();
  });

  it('is a no-op when the id does not exist', () => {
    getState().savePreset('Keep Me');
    expect(() => getState().deletePreset('non-existent')).not.toThrow();
    expect(getState().savedFilterPresets).toHaveLength(1);
  });

  it('does not affect other presets', () => {
    const id1 = getState().savePreset('Keep');
    const id2 = getState().savePreset('Delete');
    getState().deletePreset(id2);
    expect(getState().savedFilterPresets.find((p) => p.id === id1)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// loadPreset
// ---------------------------------------------------------------------------

describe('loadPreset', () => {
  beforeEach(resetStore);

  it('applies the preset filters to the live state', () => {
    getState().setSearchQuery('preset query');
    getState().setSelectedTags(['vue']);
    const id = getState().savePreset('To Load');

    // Change state after saving
    getState().clearAllFilters();

    getState().loadPreset(id);

    expect(getState().searchQuery).toBe('preset query');
    expect(getState().selectedTags).toContain('vue');
  });

  it('is a no-op when the id does not exist', () => {
    getState().setSearchQuery('untouched');
    expect(() => getState().loadPreset('non-existent')).not.toThrow();
    expect(getState().searchQuery).toBe('untouched');
  });
});

// ---------------------------------------------------------------------------
// selectFilterState selector
// ---------------------------------------------------------------------------

describe('selectFilterState', () => {
  beforeEach(resetStore);

  it('returns a snapshot of all filter fields', () => {
    getState().setSearchQuery('hello');
    getState().setSelectedTags(['ts']);
    const snapshot = selectFilterState(getState());
    expect(snapshot.searchQuery).toBe('hello');
    expect(snapshot.selectedTags).toEqual(['ts']);
  });

  it('returns defaults when no filters are active', () => {
    const snapshot = selectFilterState(getState());
    expect(snapshot).toEqual(DEFAULT_STATE);
  });
});

// ---------------------------------------------------------------------------
// selectPresetList selector
// ---------------------------------------------------------------------------

describe('selectPresetList', () => {
  beforeEach(resetStore);

  it('returns an empty array when there are no presets', () => {
    expect(selectPresetList(getState())).toHaveLength(0);
  });

  it('returns all presets sorted newest-first', () => {
    const id1 = getState().savePreset('First');
    const id2 = getState().savePreset('Second');

    // Manually stagger savedAt for deterministic ordering
    useGraphFilterStore.setState((s) => ({
      savedFilterPresets: s.savedFilterPresets.map((p) =>
        p.id === id1 ? { ...p, savedAt: 1000 } : { ...p, savedAt: 2000 },
      ),
    }));

    const list = selectPresetList(getState());
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(id2);
    expect(list[1].id).toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// activeFilterCount derived value
// ---------------------------------------------------------------------------

describe('activeFilterCount (derived via store getter)', () => {
  beforeEach(resetStore);

  it('is 0 initially', () => {
    expect(getState().activeFilterCount).toBe(0);
  });

  it('increments when a filter is activated', () => {
    getState().setSearchQuery('hello');
    expect(getState().activeFilterCount).toBe(1);
  });

  it('decrements when a filter is cleared', () => {
    getState().setSearchQuery('hello');
    getState().setSearchQuery('');
    expect(getState().activeFilterCount).toBe(0);
  });

  it('reflects all active dimensions', () => {
    getState().setSearchQuery('x');
    getState().toggleTag('t');
    getState().toggleFolder('f');
    getState().setDateRange({ from: '2024-01-01', to: null });
    getState().toggleLinkType('WIKI');
    getState().setShowOrphans(false);
    expect(getState().activeFilterCount).toBe(6);
  });
});
