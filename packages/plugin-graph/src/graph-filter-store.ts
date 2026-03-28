/**
 * graph-filter-store — Zustand store for the graph search and filter panel.
 *
 * Manages:
 * - searchQuery: text search / highlight
 * - selectedTags: tag-based filtering
 * - selectedFolders: folder-based filtering
 * - dateRange: created-at date range filter
 * - selectedLinkTypes: link type filtering (WIKI / MARKDOWN / EMBED / BLOCK_REF)
 * - showOrphans: toggle visibility of nodes with no connections
 * - savedFilterPresets: named filter snapshots (persisted to localStorage)
 *
 * Derived:
 * - activeFilterCount: total number of active filter dimensions (excludes showOrphans = false)
 *
 * Persistence: localStorage key `notesaner-graph-filter-presets`.
 * Only savedFilterPresets is persisted — the live filter state is session-only.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LinkType } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An inclusive date range for filtering by note creation date. */
export interface DateRange {
  /** ISO 8601 date string (YYYY-MM-DD), inclusive lower bound. Null = unbounded. */
  from: string | null;
  /** ISO 8601 date string (YYYY-MM-DD), inclusive upper bound. Null = unbounded. */
  to: string | null;
}

/** A named snapshot of the current filter state that can be re-applied later. */
export interface FilterPreset {
  /** Unique identifier (generated on creation). */
  id: string;
  /** Human-readable name chosen by the user. */
  name: string;
  /** The filter values captured at save time. */
  filters: GraphFilterState;
  /** Unix timestamp (ms) when this preset was saved. */
  savedAt: number;
}

/** The live filter state (session-only). */
export interface GraphFilterState {
  /** Text query for highlighting / filtering nodes by title or path. Empty = no filter. */
  searchQuery: string;
  /** Tag slugs that must be present on a node for it to be visible. Empty = show all. */
  selectedTags: string[];
  /** Folder paths that a node must belong to for it to be visible. Empty = show all. */
  selectedFolders: string[];
  /** Date range filter on note creation date. */
  dateRange: DateRange;
  /** Structural link types to show. Empty = show all. */
  selectedLinkTypes: LinkType[];
  /** When true, nodes with connectionCount === 0 are shown. When false, orphans are hidden. */
  showOrphans: boolean;
}

/** The full store shape. */
export interface GraphFilterStore extends GraphFilterState {
  /** Total count of active filter dimensions (search, tags, folders, date, link types, orphan-hide). */
  activeFilterCount: number;
  /** Persisted named filter presets. */
  savedFilterPresets: FilterPreset[];

  // --- Actions ---

  /** Replace the current search query. */
  setSearchQuery: (query: string) => void;
  /** Set the full list of selected tag slugs. */
  setSelectedTags: (tags: string[]) => void;
  /** Toggle a single tag in/out of the selection. */
  toggleTag: (tag: string) => void;
  /** Set the full list of selected folder paths. */
  setSelectedFolders: (folders: string[]) => void;
  /** Toggle a single folder path in/out of the selection. */
  toggleFolder: (folder: string) => void;
  /** Update the date range filter. Pass null fields to clear bounds. */
  setDateRange: (range: DateRange) => void;
  /** Set the full list of selected link types. */
  setSelectedLinkTypes: (types: LinkType[]) => void;
  /** Toggle a single link type in/out of the selection. */
  toggleLinkType: (type: LinkType) => void;
  /** Set the show-orphans toggle. */
  setShowOrphans: (show: boolean) => void;
  /** Reset all live filter state to defaults (clears search, tags, folders, date, link types, shows orphans). */
  clearAllFilters: () => void;
  /** Apply the entire filter state from a preset object (live state only — does not save). */
  applyFilterState: (state: GraphFilterState) => void;
  /** Save the current live filter state as a named preset. */
  savePreset: (name: string) => string;
  /** Delete a saved preset by id. */
  deletePreset: (id: string) => void;
  /** Load a preset by id and apply its filters to the live state. */
  loadPreset: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_DATE_RANGE: DateRange = { from: null, to: null };

const DEFAULT_FILTER_STATE: GraphFilterState = {
  searchQuery: '',
  selectedTags: [],
  selectedFolders: [],
  dateRange: DEFAULT_DATE_RANGE,
  selectedLinkTypes: [],
  showOrphans: true,
};

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateId(): string {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Active filter count helper (pure function for use in selectors and tests)
// ---------------------------------------------------------------------------

/**
 * Counts the number of active filter dimensions.
 *
 * Rules:
 * - searchQuery counts as 1 when non-empty
 * - selectedTags counts as 1 when any tag is selected
 * - selectedFolders counts as 1 when any folder is selected
 * - dateRange counts as 1 when either from or to is set
 * - selectedLinkTypes counts as 1 when any type is selected
 * - showOrphans = false counts as 1 (the default true is not a "filter")
 */
export function computeActiveFilterCount(state: GraphFilterState): number {
  let count = 0;
  if (state.searchQuery.trim().length > 0) count++;
  if (state.selectedTags.length > 0) count++;
  if (state.selectedFolders.length > 0) count++;
  if (state.dateRange.from !== null || state.dateRange.to !== null) count++;
  if (state.selectedLinkTypes.length > 0) count++;
  if (!state.showOrphans) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Helper: recomputes activeFilterCount and merges it into the next state.
// Used inside every action that mutates filter state.
// ---------------------------------------------------------------------------

function withCount<T extends Partial<GraphFilterState>>(
  current: GraphFilterStore,
  patch: T,
): T & { activeFilterCount: number } {
  const merged: GraphFilterState = {
    searchQuery: 'searchQuery' in patch ? (patch.searchQuery as string) : current.searchQuery,
    selectedTags: 'selectedTags' in patch ? (patch.selectedTags as string[]) : current.selectedTags,
    selectedFolders:
      'selectedFolders' in patch ? (patch.selectedFolders as string[]) : current.selectedFolders,
    dateRange: 'dateRange' in patch ? (patch.dateRange as DateRange) : current.dateRange,
    selectedLinkTypes:
      'selectedLinkTypes' in patch
        ? (patch.selectedLinkTypes as LinkType[])
        : current.selectedLinkTypes,
    showOrphans: 'showOrphans' in patch ? (patch.showOrphans as boolean) : current.showOrphans,
  };
  return { ...patch, activeFilterCount: computeActiveFilterCount(merged) };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphFilterStore = create<GraphFilterStore>()(
  persist(
    (set, get) => ({
      // --- Initial live state ---
      ...DEFAULT_FILTER_STATE,

      // --- Derived count (kept in sync by every mutating action) ---
      activeFilterCount: 0,

      // --- Persisted presets ---
      savedFilterPresets: [],

      // --- Actions ---

      setSearchQuery(query: string): void {
        set((s) => withCount(s, { searchQuery: query }));
      },

      setSelectedTags(tags: string[]): void {
        set((s) => withCount(s, { selectedTags: tags }));
      },

      toggleTag(tag: string): void {
        set((s) => {
          const selectedTags = s.selectedTags.includes(tag)
            ? s.selectedTags.filter((t) => t !== tag)
            : [...s.selectedTags, tag];
          return withCount(s, { selectedTags });
        });
      },

      setSelectedFolders(folders: string[]): void {
        set((s) => withCount(s, { selectedFolders: folders }));
      },

      toggleFolder(folder: string): void {
        set((s) => {
          const selectedFolders = s.selectedFolders.includes(folder)
            ? s.selectedFolders.filter((f) => f !== folder)
            : [...s.selectedFolders, folder];
          return withCount(s, { selectedFolders });
        });
      },

      setDateRange(range: DateRange): void {
        set((s) => withCount(s, { dateRange: range }));
      },

      setSelectedLinkTypes(types: LinkType[]): void {
        set((s) => withCount(s, { selectedLinkTypes: types }));
      },

      toggleLinkType(type: LinkType): void {
        set((s) => {
          const selectedLinkTypes = s.selectedLinkTypes.includes(type)
            ? s.selectedLinkTypes.filter((t) => t !== type)
            : [...s.selectedLinkTypes, type];
          return withCount(s, { selectedLinkTypes });
        });
      },

      setShowOrphans(show: boolean): void {
        set((s) => withCount(s, { showOrphans: show }));
      },

      clearAllFilters(): void {
        set({ ...DEFAULT_FILTER_STATE, activeFilterCount: 0 });
      },

      applyFilterState(state: GraphFilterState): void {
        set({
          searchQuery: state.searchQuery,
          selectedTags: state.selectedTags,
          selectedFolders: state.selectedFolders,
          dateRange: state.dateRange,
          selectedLinkTypes: state.selectedLinkTypes,
          showOrphans: state.showOrphans,
          activeFilterCount: computeActiveFilterCount(state),
        });
      },

      savePreset(name: string): string {
        const trimmed = name.trim() || 'Untitled preset';
        const s = get();
        const snapshot: GraphFilterState = {
          searchQuery: s.searchQuery,
          selectedTags: [...s.selectedTags],
          selectedFolders: [...s.selectedFolders],
          dateRange: { ...s.dateRange },
          selectedLinkTypes: [...s.selectedLinkTypes],
          showOrphans: s.showOrphans,
        };

        // Update existing preset with the same name if found
        const existing = s.savedFilterPresets.find((p) => p.name === trimmed);
        if (existing) {
          const updated: FilterPreset = { ...existing, filters: snapshot, savedAt: Date.now() };
          set((state) => ({
            savedFilterPresets: state.savedFilterPresets.map((p) =>
              p.id === existing.id ? updated : p,
            ),
          }));
          return existing.id;
        }

        const id = generateId();
        const preset: FilterPreset = { id, name: trimmed, filters: snapshot, savedAt: Date.now() };
        set((state) => ({
          savedFilterPresets: [...state.savedFilterPresets, preset],
        }));
        return id;
      },

      deletePreset(id: string): void {
        set((s) => ({
          savedFilterPresets: s.savedFilterPresets.filter((p) => p.id !== id),
        }));
      },

      loadPreset(id: string): void {
        const preset = get().savedFilterPresets.find((p) => p.id === id);
        if (!preset) return;
        get().applyFilterState(preset.filters);
      },
    }),
    {
      name: 'notesaner-graph-filter-presets',
      // Only persist saved presets — live filter state resets on page reload.
      partialize: (state) => ({ savedFilterPresets: state.savedFilterPresets }),
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

/** Returns the current live filter state snapshot (all filter fields). */
export function selectFilterState(store: GraphFilterStore): GraphFilterState {
  return {
    searchQuery: store.searchQuery,
    selectedTags: store.selectedTags,
    selectedFolders: store.selectedFolders,
    dateRange: store.dateRange,
    selectedLinkTypes: store.selectedLinkTypes,
    showOrphans: store.showOrphans,
  };
}

/** Returns all saved presets sorted newest-first. */
export function selectPresetList(store: GraphFilterStore): FilterPreset[] {
  return [...store.savedFilterPresets].sort((a, b) => b.savedAt - a.savedAt);
}
