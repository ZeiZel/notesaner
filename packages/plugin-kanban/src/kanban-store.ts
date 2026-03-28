/**
 * Zustand store for Kanban board state.
 *
 * Responsibilities:
 * - Hold the current board (columns + cards).
 * - Hold active filter and sort configuration.
 * - Expose actions for card moves and board mutations.
 *
 * The store does NOT talk to the API directly. The host component is
 * responsible for fetching notes, building the board via `buildBoard`,
 * and seeding the store. API writes (persisting a moved card's frontmatter)
 * are also delegated to the host via the `onCardMove` callback prop of
 * KanbanBoard.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { KanbanBoard, KanbanCard, KanbanFilters, KanbanSort } from './kanban-data';
import { moveCard as moveCardHelper, filterCards, sortCards } from './kanban-data';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface KanbanState {
  /** The active board, or null when not yet loaded. */
  board: KanbanBoard | null;

  /** Whether the board is loading for the first time. */
  isLoading: boolean;

  /** Error message when the board failed to load. */
  error: string | null;

  /** Active filter criteria. */
  filters: KanbanFilters;

  /** Active sort configuration. */
  sort: KanbanSort;

  /** Whether a drag operation is currently in progress. */
  isDragging: boolean;

  /** The noteId of the card currently being dragged, if any. */
  draggingCardId: string | null;

  /** The column ID that the drag is currently hovering over, if any. */
  dragOverColumnId: string | null;
}

// ---------------------------------------------------------------------------
// Actions shape
// ---------------------------------------------------------------------------

export interface KanbanActions {
  /** Replace the full board (called after a data fetch). */
  setBoard(board: KanbanBoard): void;

  /** Set the loading state. */
  setLoading(loading: boolean): void;

  /** Set the error state. Clears the board. */
  setError(error: string): void;

  /** Clear any error and loading states. */
  clearError(): void;

  /**
   * Move a card to a new column at the given index.
   * Updates the in-memory board immediately (optimistic update).
   * The caller is responsible for persisting the change to the backend.
   */
  moveCard(cardId: string, targetColumnId: string, targetIndex: number): void;

  /** Update the filter criteria. */
  setFilters(filters: Partial<KanbanFilters>): void;

  /** Reset all filters to their default empty state. */
  clearFilters(): void;

  /** Update the sort configuration. */
  setSort(sort: KanbanSort): void;

  /** Notify the store that a drag has started. */
  startDrag(cardId: string): void;

  /** Notify the store that the drag is hovering over a column. */
  setDragOverColumn(columnId: string | null): void;

  /** Notify the store that the drag has ended (regardless of outcome). */
  endDrag(): void;

  /**
   * Returns the filtered + sorted cards for a given column.
   * Computed on demand to avoid storing derived data in state.
   */
  getColumnCards(columnId: string): KanbanCard[];
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: KanbanFilters = {
  searchQuery: '',
  assignees: [],
  priorities: [],
  tags: [],
  dueBefore: undefined,
};

const DEFAULT_SORT: KanbanSort = {
  field: 'order',
  direction: 'asc',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      board: null,
      isLoading: false,
      error: null,
      filters: { ...DEFAULT_FILTERS },
      sort: { ...DEFAULT_SORT },
      isDragging: false,
      draggingCardId: null,
      dragOverColumnId: null,

      // ---------------------------------------------------------------------------
      // Board actions
      // ---------------------------------------------------------------------------

      setBoard(board) {
        set({ board, isLoading: false, error: null }, false, 'setBoard');
      },

      setLoading(loading) {
        set({ isLoading: loading }, false, 'setLoading');
      },

      setError(error) {
        set({ error, isLoading: false }, false, 'setError');
      },

      clearError() {
        set({ error: null, isLoading: false }, false, 'clearError');
      },

      // ---------------------------------------------------------------------------
      // Card move
      // ---------------------------------------------------------------------------

      moveCard(cardId, targetColumnId, targetIndex) {
        const { board } = get();
        if (!board) return;

        const nextCardsByColumn = moveCardHelper(
          board.cardsByColumn,
          cardId,
          targetColumnId,
          targetIndex,
        );

        set(
          {
            board: {
              ...board,
              cardsByColumn: nextCardsByColumn,
            },
          },
          false,
          'moveCard',
        );
      },

      // ---------------------------------------------------------------------------
      // Filters / sort
      // ---------------------------------------------------------------------------

      setFilters(partial) {
        set((state) => ({ filters: { ...state.filters, ...partial } }), false, 'setFilters');
      },

      clearFilters() {
        set({ filters: { ...DEFAULT_FILTERS } }, false, 'clearFilters');
      },

      setSort(sort) {
        set({ sort }, false, 'setSort');
      },

      // ---------------------------------------------------------------------------
      // Drag state
      // ---------------------------------------------------------------------------

      startDrag(cardId) {
        set(
          { isDragging: true, draggingCardId: cardId, dragOverColumnId: null },
          false,
          'startDrag',
        );
      },

      setDragOverColumn(columnId) {
        set({ dragOverColumnId: columnId }, false, 'setDragOverColumn');
      },

      endDrag() {
        set({ isDragging: false, draggingCardId: null, dragOverColumnId: null }, false, 'endDrag');
      },

      // ---------------------------------------------------------------------------
      // Derived: cards for a column with filters + sort applied
      // ---------------------------------------------------------------------------

      getColumnCards(columnId) {
        const { board, filters, sort } = get();
        if (!board) return [];

        const raw = board.cardsByColumn[columnId] ?? [];
        const filtered = filterCards(raw, filters);
        return sortCards(filtered, sort);
      },
    }),
    { name: 'kanban-store' },
  ),
);
