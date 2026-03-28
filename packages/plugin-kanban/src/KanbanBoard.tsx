'use client';

/**
 * KanbanBoard — the root board component.
 *
 * Responsibilities:
 * - Renders all columns side by side in a horizontal scroll container.
 * - Wraps columns in DndContext (from @dnd-kit/core) for drag-and-drop.
 * - Handles DragStart / DragOver / DragEnd events.
 * - Shows the DragOverlay with a card clone during an active drag.
 * - Delegates card-move persistence to the `onCardMove` callback prop.
 * - Delegates note-open navigation to the `onCardOpen` callback prop.
 * - Delegates "add card" (create new note) to the `onAddCard` callback prop.
 */

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { KanbanBoard as KanbanBoardData, KanbanCard as KanbanCardData } from './kanban-data';
import { collectAssignees, collectTags } from './kanban-data';
import { useKanbanStore } from './kanban-store';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCardOverlay } from './KanbanCard';
import { KanbanFilters } from './KanbanFilters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardMovePayload {
  /** The note ID of the card that was moved. */
  cardId: string;
  /** Column ID before the move. */
  fromColumnId: string;
  /** Column ID after the move. */
  toColumnId: string;
  /** Zero-based index in the target column after the move. */
  targetIndex: number;
}

export interface KanbanBoardProps {
  /**
   * The initial board data. The component manages optimistic updates
   * internally via the Zustand store once the board is seeded.
   */
  board: KanbanBoardData;

  /**
   * Called after a successful drag-drop card move.
   * Callers must persist the change by updating the card note's frontmatter
   * (kanban_column, kanban_order fields).
   */
  onCardMove: (payload: CardMovePayload) => void | Promise<void>;

  /**
   * Called when the user clicks a card title or otherwise requests to open
   * the underlying note in the editor.
   */
  onCardOpen: (noteId: string) => void;

  /**
   * Called when the user clicks "+ Add card" in a column.
   * The host should create a new note with the appropriate frontmatter
   * pre-populated (kanban_column = columnId, kanban_board = board.boardNoteId).
   */
  onAddCard: (columnId: string) => void;

  /** Optional CSS class applied to the root wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: find a card by noteId across all columns
// ---------------------------------------------------------------------------

function findCard(
  cardsByColumn: Record<string, KanbanCardData[]>,
  cardId: string,
): { card: KanbanCardData; columnId: string } | null {
  for (const [columnId, cards] of Object.entries(cardsByColumn)) {
    const card = cards.find((c) => c.noteId === cardId);
    if (card) return { card, columnId };
  }
  return null;
}

/**
 * Determines whether a dnd-kit active ID belongs to a card (note) or a
 * column. Column IDs are non-UUID strings like "backlog", card IDs are
 * UUIDs (or any string that doesn't match a column id).
 */
function resolveDropTarget(
  overId: string,
  columnIds: Set<string>,
  cardsByColumn: Record<string, KanbanCardData[]>,
): { targetColumnId: string; targetIndex: number } | null {
  // Dropping directly onto a column header / empty column area
  if (columnIds.has(overId)) {
    const colCards = cardsByColumn[overId] ?? [];
    return { targetColumnId: overId, targetIndex: colCards.length };
  }

  // Dropping onto a card — insert before that card
  for (const [colId, cards] of Object.entries(cardsByColumn)) {
    const idx = cards.findIndex((c) => c.noteId === overId);
    if (idx !== -1) {
      return { targetColumnId: colId, targetIndex: idx };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Board component
// ---------------------------------------------------------------------------

/**
 * KanbanBoard renders the full board from a pre-built KanbanBoardData object.
 *
 * It seeds the Zustand store on first render and keeps it in sync when the
 * `board` prop changes (e.g. after a background refresh from the host).
 */
export function KanbanBoard({
  board: boardProp,
  onCardMove,
  onCardOpen,
  onAddCard,
  className,
}: KanbanBoardProps) {
  // ---------------------------------------------------------------------------
  // Store
  // ---------------------------------------------------------------------------

  const {
    board,
    filters,
    sort,
    isDragging,
    draggingCardId,
    dragOverColumnId,
    setBoard,
    moveCard,
    setFilters,
    clearFilters,
    setSort,
    startDrag,
    setDragOverColumn,
    endDrag,
    getColumnCards,
  } = useKanbanStore();

  // Seed the store when the board prop changes.
  // Using a ref to avoid seeding on every render without useEffect.
  const prevBoardIdRef = { current: board?.boardNoteId };
  if (
    board === null ||
    prevBoardIdRef.current !== boardProp.boardNoteId ||
    board.boardNoteId !== boardProp.boardNoteId
  ) {
    setBoard(boardProp);
  }

  const activeBoard = board ?? boardProp;

  // ---------------------------------------------------------------------------
  // Derived metadata for filters
  // ---------------------------------------------------------------------------

  const allCards = useMemo(() => {
    return Object.values(activeBoard.cardsByColumn).flat();
  }, [activeBoard.cardsByColumn]);

  const availableAssignees = useMemo(() => collectAssignees(allCards), [allCards]);
  const availableTags = useMemo(() => collectTags(allCards), [allCards]);
  const totalCards = allCards.length;

  const visibleCards = useMemo(() => {
    return activeBoard.columns.reduce((sum, col) => sum + getColumnCards(col.id).length, 0);
  }, [activeBoard.columns, getColumnCards]);

  // ---------------------------------------------------------------------------
  // The card currently being dragged (for DragOverlay rendering)
  // ---------------------------------------------------------------------------

  const draggingCard = useMemo<KanbanCardData | null>(() => {
    if (!draggingCardId) return null;
    return findCard(activeBoard.cardsByColumn, draggingCardId)?.card ?? null;
  }, [draggingCardId, activeBoard.cardsByColumn]);

  // Column IDs as a Set for quick look-up inside dnd handlers
  const columnIds = useMemo(
    () => new Set(activeBoard.columns.map((c) => c.id)),
    [activeBoard.columns],
  );

  // ---------------------------------------------------------------------------
  // dnd-kit sensors
  // ---------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require a small movement before starting a drag, so card title
        // button clicks still register without triggering a drag.
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ---------------------------------------------------------------------------
  // Drag event handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      startDrag(String(event.active.id));
    },
    [startDrag],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setDragOverColumn(null);
        return;
      }

      const overId = String(over.id);

      // When hovering over a column directly
      if (columnIds.has(overId)) {
        setDragOverColumn(overId);
        return;
      }

      // When hovering over another card — resolve to its column
      const result = findCard(activeBoard.cardsByColumn, overId);
      setDragOverColumn(result?.columnId ?? null);
    },
    [columnIds, activeBoard.cardsByColumn, setDragOverColumn],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      endDrag();

      if (!over) return;

      const cardId = String(active.id);
      const overId = String(over.id);

      if (cardId === overId) return; // dropped on itself — no move

      const source = findCard(activeBoard.cardsByColumn, cardId);
      if (!source) return;

      const dropTarget = resolveDropTarget(overId, columnIds, activeBoard.cardsByColumn);

      if (!dropTarget) return;

      const { targetColumnId, targetIndex } = dropTarget;

      // Optimistic update
      moveCard(cardId, targetColumnId, targetIndex);

      // Notify host to persist
      void onCardMove({
        cardId,
        fromColumnId: source.columnId,
        toColumnId: targetColumnId,
        targetIndex,
      });
    },
    [activeBoard.cardsByColumn, columnIds, endDrag, moveCard, onCardMove],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={['flex h-full flex-col overflow-hidden bg-background', className ?? ''].join(' ')}
    >
      {/* Filter toolbar */}
      <KanbanFilters
        filters={filters}
        sort={sort}
        availableAssignees={availableAssignees}
        availableTags={availableTags}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onClearFilters={clearFilters}
        totalCards={totalCards}
        visibleCards={visibleCards}
      />

      {/* Columns scroll area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {activeBoard.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={getColumnCards(column.id)}
              isOver={dragOverColumnId === column.id && isDragging}
              onCardOpen={onCardOpen}
              onAddCard={onAddCard}
            />
          ))}

          {activeBoard.columns.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No columns defined</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    kanban.columns
                  </code>{' '}
                  list to the board note&apos;s frontmatter.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Drag overlay — renders a floating clone of the dragged card */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {draggingCard ? <KanbanCardOverlay card={draggingCard} onOpen={onCardOpen} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
