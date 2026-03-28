'use client';

/**
 * KanbanColumn — a droppable column with a header and a list of sortable cards.
 *
 * Responsibilities:
 * - Render the column header (title, color accent, card count, WIP indicator)
 * - Act as a droppable container via useDroppable
 * - Render an ordered list of KanbanCard components inside SortableContext
 * - Show a "Add card" button at the bottom of each column
 */

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { KanbanColumn as KanbanColumnData, KanbanCard as KanbanCardData } from './kanban-data';
import { KanbanCard } from './KanbanCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KanbanColumnProps {
  column: KanbanColumnData;
  cards: KanbanCardData[];
  /** Whether a drag is currently hovering over this column. */
  isOver?: boolean;
  /** Called when the user wants to open a note. */
  onCardOpen: (noteId: string) => void;
  /** Called when the user clicks "+ Add card" in this column. */
  onAddCard: (columnId: string) => void;
}

// ---------------------------------------------------------------------------
// WIP indicator
// ---------------------------------------------------------------------------

interface WipIndicatorProps {
  count: number;
  limit: number;
}

function WipIndicator({ count, limit }: WipIndicatorProps) {
  const exceeded = count > limit;
  return (
    <span
      className={[
        'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        exceeded
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-muted text-muted-foreground',
      ].join(' ')}
      title={exceeded ? `WIP limit exceeded (${count}/${limit})` : `WIP limit: ${limit}`}
    >
      {count}/{limit}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KanbanColumn({
  column,
  cards,
  isOver = false,
  onCardOpen,
  onAddCard,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  const cardIds = cards.map((c) => c.noteId);
  const wipExceeded =
    column.wipLimit !== undefined && column.wipLimit > 0 && cards.length > column.wipLimit;

  return (
    <div
      className={[
        'flex h-full min-w-[280px] max-w-[320px] flex-col rounded-lg border bg-muted/30',
        'transition-colors duration-150',
        isOver ? 'bg-primary/5 border-primary/40' : '',
        wipExceeded ? 'border-red-300 dark:border-red-700' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between gap-2 rounded-t-lg border-b border-border px-3 py-2.5"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Color dot */}
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
            aria-hidden="true"
          />
          {/* Title */}
          <h3 className="truncate text-sm font-semibold text-foreground">{column.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Card count */}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {cards.length}
          </span>

          {/* WIP limit badge */}
          {column.wipLimit !== undefined && column.wipLimit > 0 && (
            <WipIndicator count={cards.length} limit={column.wipLimit} />
          )}
        </div>
      </div>

      {/* Scrollable card list */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 overflow-y-auto p-2',
          // Minimum height so empty columns are still droppable targets.
          'min-h-[120px]',
        ].join(' ')}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {cards.map((card) => (
              <KanbanCard key={card.noteId} card={card} onOpen={onCardOpen} />
            ))}

            {/* Visible drop placeholder when dragging over an empty column */}
            {cards.length === 0 && isOver && (
              <div className="h-16 rounded-md border-2 border-dashed border-primary/30 bg-primary/5" />
            )}

            {cards.length === 0 && !isOver && (
              <p className="py-4 text-center text-xs text-muted-foreground">No cards</p>
            )}
          </div>
        </SortableContext>
      </div>

      {/* Add card button */}
      <div className="border-t border-border px-2 py-2">
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className={[
            'flex w-full items-center justify-center gap-1.5 rounded-md',
            'px-3 py-1.5 text-xs text-muted-foreground',
            'hover:bg-muted hover:text-foreground transition-colors duration-150',
          ].join(' ')}
        >
          {/* Plus icon */}
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          Add card
        </button>
      </div>
    </div>
  );
}
