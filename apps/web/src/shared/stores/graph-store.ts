/**
 * graph-store — Zustand store for workspace-level graph filter and search state.
 *
 * This store bridges the web app's workspace with the plugin-graph package.
 * It stores the graph filter state used by GraphFilter and GraphSearch
 * components in the workspace feature layer.
 *
 * Differences from plugin-graph's useGraphFilterStore:
 * - This store is workspace-scoped (lives in shared/stores)
 * - Adds link depth filter for controlling BFS neighborhood depth
 * - Adds highlighted node tracking for search integration
 * - Re-exports compatible types for use by workspace components
 *
 * Persistence: localStorage key `notesaner-workspace-graph-filters`.
 * Only savedPresets and linkDepth are persisted.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { LinkType } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An inclusive date range for filtering by note creation date. */
export interface GraphDateRange {
  /** ISO 8601 date string (YYYY-MM-DD), inclusive lower bound. Null = unbounded. */
  from: string | null;
  /** ISO 8601 date string (YYYY-MM-DD), inclusive upper bound. Null = unbounded. */
  to: string | null;
}

/** Full filter state for the workspace graph. */
export interface WorkspaceGraphFilters {
  /** Text query for searching/highlighting nodes. */
  searchQuery: string;
  /** Tag slugs that nodes must have to be visible. Empty = all. */
  selectedTags: string[];
  /** Folder paths that nodes must belong to. Empty = all. */
  selectedFolders: string[];
  /** Date range filter on note creation date. */
  dateRange: GraphDateRange;
  /** Link types to show. Empty = all. */
  selectedLinkTypes: LinkType[];
  /** Whether orphan nodes are visible. */
  showOrphans: boolean;
  /** BFS link depth for neighborhood view (1-5). */
  linkDepth: number;
}

/** A node that matches the current search query, for highlighting in the graph. */
export interface HighlightedNode {
  id: string;
  title: string;
  path: string;
}

/** Named filter preset. */
export interface GraphFilterPreset {
  id: string;
  name: string;
  filters: WorkspaceGraphFilters;
  savedAt: number;
}

/** Full store shape. */
export interface WorkspaceGraphStore extends WorkspaceGraphFilters {
  /** Number of active filter dimensions. */
  activeFilterCount: number;
  /** Node IDs that match the current search query (for highlighting). */
  highlightedNodeIds: string[];
  /** Saved filter presets. */
  savedPresets: GraphFilterPreset[];

  // --- Actions ---

  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setSelectedFolders: (folders: string[]) => void;
  toggleFolder: (folder: string) => void;
  setDateRange: (range: GraphDateRange) => void;
  setSelectedLinkTypes: (types: LinkType[]) => void;
  toggleLinkType: (type: LinkType) => void;
  setShowOrphans: (show: boolean) => void;
  setLinkDepth: (depth: number) => void;
  setHighlightedNodeIds: (ids: string[]) => void;
  clearAllFilters: () => void;
  applyFilters: (filters: WorkspaceGraphFilters) => void;
  savePreset: (name: string) => string;
  deletePreset: (id: string) => void;
  loadPreset: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: WorkspaceGraphFilters = {
  searchQuery: '',
  selectedTags: [],
  selectedFolders: [],
  dateRange: { from: null, to: null },
  selectedLinkTypes: [],
  showOrphans: true,
  linkDepth: 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Counts the number of active filter dimensions.
 */
export function computeActiveFilterCount(filters: WorkspaceGraphFilters): number {
  let count = 0;
  if (filters.searchQuery.trim().length > 0) count++;
  if (filters.selectedTags.length > 0) count++;
  if (filters.selectedFolders.length > 0) count++;
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) count++;
  if (filters.selectedLinkTypes.length > 0) count++;
  if (!filters.showOrphans) count++;
  if (filters.linkDepth !== DEFAULT_FILTERS.linkDepth) count++;
  return count;
}

function recount(
  current: WorkspaceGraphStore,
  patch: Partial<WorkspaceGraphFilters>,
): { activeFilterCount: number } {
  const merged: WorkspaceGraphFilters = {
    searchQuery: patch.searchQuery ?? current.searchQuery,
    selectedTags: patch.selectedTags ?? current.selectedTags,
    selectedFolders: patch.selectedFolders ?? current.selectedFolders,
    dateRange: patch.dateRange ?? current.dateRange,
    selectedLinkTypes: patch.selectedLinkTypes ?? current.selectedLinkTypes,
    showOrphans: patch.showOrphans ?? current.showOrphans,
    linkDepth: patch.linkDepth ?? current.linkDepth,
  };
  return { activeFilterCount: computeActiveFilterCount(merged) };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceGraphStore = create<WorkspaceGraphStore>()(
  devtools(
    persist(
      (set, get) => ({
        // --- Initial state ---
        ...DEFAULT_FILTERS,
        activeFilterCount: 0,
        highlightedNodeIds: [],
        savedPresets: [],

        // --- Actions ---

        setSearchQuery(query: string): void {
          set(
            (s) => ({ searchQuery: query, ...recount(s, { searchQuery: query }) }),
            false,
            'graphStore/setSearchQuery',
          );
        },

        setSelectedTags(tags: string[]): void {
          set(
            (s) => ({ selectedTags: tags, ...recount(s, { selectedTags: tags }) }),
            false,
            'graphStore/setSelectedTags',
          );
        },

        toggleTag(tag: string): void {
          set(
            (s) => {
              const selectedTags = s.selectedTags.includes(tag)
                ? s.selectedTags.filter((t) => t !== tag)
                : [...s.selectedTags, tag];
              return { selectedTags, ...recount(s, { selectedTags }) };
            },
            false,
            'graphStore/toggleTag',
          );
        },

        setSelectedFolders(folders: string[]): void {
          set(
            (s) => ({ selectedFolders: folders, ...recount(s, { selectedFolders: folders }) }),
            false,
            'graphStore/setSelectedFolders',
          );
        },

        toggleFolder(folder: string): void {
          set(
            (s) => {
              const selectedFolders = s.selectedFolders.includes(folder)
                ? s.selectedFolders.filter((f) => f !== folder)
                : [...s.selectedFolders, folder];
              return { selectedFolders, ...recount(s, { selectedFolders }) };
            },
            false,
            'graphStore/toggleFolder',
          );
        },

        setDateRange(range: GraphDateRange): void {
          set(
            (s) => ({ dateRange: range, ...recount(s, { dateRange: range }) }),
            false,
            'graphStore/setDateRange',
          );
        },

        setSelectedLinkTypes(types: LinkType[]): void {
          set(
            (s) => ({ selectedLinkTypes: types, ...recount(s, { selectedLinkTypes: types }) }),
            false,
            'graphStore/setSelectedLinkTypes',
          );
        },

        toggleLinkType(type: LinkType): void {
          set(
            (s) => {
              const selectedLinkTypes = s.selectedLinkTypes.includes(type)
                ? s.selectedLinkTypes.filter((t) => t !== type)
                : [...s.selectedLinkTypes, type];
              return { selectedLinkTypes, ...recount(s, { selectedLinkTypes }) };
            },
            false,
            'graphStore/toggleLinkType',
          );
        },

        setShowOrphans(show: boolean): void {
          set(
            (s) => ({ showOrphans: show, ...recount(s, { showOrphans: show }) }),
            false,
            'graphStore/setShowOrphans',
          );
        },

        setLinkDepth(depth: number): void {
          const clamped = Math.max(1, Math.min(5, depth));
          set(
            (s) => ({ linkDepth: clamped, ...recount(s, { linkDepth: clamped }) }),
            false,
            'graphStore/setLinkDepth',
          );
        },

        setHighlightedNodeIds(ids: string[]): void {
          set({ highlightedNodeIds: ids }, false, 'graphStore/setHighlightedNodeIds');
        },

        clearAllFilters(): void {
          set(
            {
              ...DEFAULT_FILTERS,
              activeFilterCount: 0,
              highlightedNodeIds: [],
            },
            false,
            'graphStore/clearAllFilters',
          );
        },

        applyFilters(filters: WorkspaceGraphFilters): void {
          set(
            {
              ...filters,
              activeFilterCount: computeActiveFilterCount(filters),
            },
            false,
            'graphStore/applyFilters',
          );
        },

        savePreset(name: string): string {
          const trimmed = name.trim() || 'Untitled preset';
          const s = get();
          const snapshot: WorkspaceGraphFilters = {
            searchQuery: s.searchQuery,
            selectedTags: [...s.selectedTags],
            selectedFolders: [...s.selectedFolders],
            dateRange: { ...s.dateRange },
            selectedLinkTypes: [...s.selectedLinkTypes],
            showOrphans: s.showOrphans,
            linkDepth: s.linkDepth,
          };

          const existing = s.savedPresets.find((p) => p.name === trimmed);
          if (existing) {
            const updated: GraphFilterPreset = {
              ...existing,
              filters: snapshot,
              savedAt: Date.now(),
            };
            set(
              (state) => ({
                savedPresets: state.savedPresets.map((p) => (p.id === existing.id ? updated : p)),
              }),
              false,
              'graphStore/savePreset',
            );
            return existing.id;
          }

          const id = generateId();
          const preset: GraphFilterPreset = {
            id,
            name: trimmed,
            filters: snapshot,
            savedAt: Date.now(),
          };
          set(
            (state) => ({ savedPresets: [...state.savedPresets, preset] }),
            false,
            'graphStore/savePreset',
          );
          return id;
        },

        deletePreset(id: string): void {
          set(
            (s) => ({ savedPresets: s.savedPresets.filter((p) => p.id !== id) }),
            false,
            'graphStore/deletePreset',
          );
        },

        loadPreset(id: string): void {
          const preset = get().savedPresets.find((p) => p.id === id);
          if (!preset) return;
          get().applyFilters(preset.filters);
        },
      }),
      {
        name: 'notesaner-workspace-graph-filters',
        partialize: (state) => ({
          savedPresets: state.savedPresets,
          linkDepth: state.linkDepth,
        }),
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
    { name: 'WorkspaceGraphStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Returns the current live filter state snapshot. */
export function selectGraphFilters(store: WorkspaceGraphStore): WorkspaceGraphFilters {
  return {
    searchQuery: store.searchQuery,
    selectedTags: store.selectedTags,
    selectedFolders: store.selectedFolders,
    dateRange: store.dateRange,
    selectedLinkTypes: store.selectedLinkTypes,
    showOrphans: store.showOrphans,
    linkDepth: store.linkDepth,
  };
}

/** Returns saved presets sorted newest-first. */
export function selectGraphPresets(store: WorkspaceGraphStore): GraphFilterPreset[] {
  return [...store.savedPresets].sort((a, b) => b.savedAt - a.savedAt);
}
