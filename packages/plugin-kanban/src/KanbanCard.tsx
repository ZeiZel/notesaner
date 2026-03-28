'use client';

/**
 * KanbanCard — a draggable card representing a single note.
 *
 * Displays:
 * - Note title (links to the note)
 * - Priority badge
 * - Assignee (when set)
 * - Due date (with overdue highlight when past today)
 * - Tags (up to 3, rest truncated)
 *
 * Drag behaviour is provided by @dnd-kit/sortable via useSortable.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanCard as KanbanCardData, KanbanPriority } from './kanban-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KanbanCardProps {
  card: KanbanCardData;
  /** Called when the user clicks the card title to navigate to the note. */
  onOpen: (noteId: string) => void;
  /** Whether the card is in its drag-overlay clone (disables pointer events). */
  isOverlay?: boolean;
}

// ---------------------------------------------------------------------------
// Priority label + color helpers
// ---------------------------------------------------------------------------

const PRIORITY_LABEL: Record<KanbanPriority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_CLASSES: Record<KanbanPriority, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ---------------------------------------------------------------------------
// Due date helper
// ---------------------------------------------------------------------------

function formatDueDate(isoDate: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  const overdue = due < today;

  // Format as "Jan 15" for readability
  const label = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return { label, overdue };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KanbanCard({ card, onOpen, isOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.noteId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group relative rounded-md border bg-card shadow-sm',
        'hover:border-primary/40 hover:shadow-md',
        'transition-all duration-150 ease-in-out',
        isDragging && !isOverlay ? 'cursor-grabbing' : 'cursor-grab',
        isOverlay ? 'pointer-events-none rotate-1 shadow-lg ring-2 ring-primary/30' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...attributes}
      {...listeners}
    >
      <div className="p-3">
        {/* Priority badge + title row */}
        <div className="mb-1.5 flex items-start gap-2">
          {/* Priority badge */}
          <span
            className={[
              'mt-px shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none',
              PRIORITY_CLASSES[card.priority],
            ].join(' ')}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>

          {/* Title — clicking navigates to the note */}
          <button
            type="button"
            onPointerDown={(e) => {
              // Prevent drag from firing when the user intends a click.
              // Let the event bubble; dnd-kit will distinguish click vs drag.
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(card.noteId);
            }}
            className={[
              'min-w-0 flex-1 text-left text-sm font-medium leading-snug text-foreground',
              'hover:text-primary hover:underline underline-offset-2',
              'transition-colors',
            ].join(' ')}
          >
            {card.title || 'Untitled'}
          </button>
        </div>

        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary"
              >
                #{tag}
              </span>
            ))}
            {card.tags.length > 3 && (
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                +{card.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: assignee + due date */}
        {(card.assignee || card.dueDate) && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
            {/* Assignee */}
            {card.assignee ? (
              <div className="flex items-center gap-1 min-w-0">
                {/* Avatar-like initial badge */}
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold uppercase text-primary"
                  aria-hidden="true"
                >
                  {card.assignee.charAt(0)}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{card.assignee}</span>
              </div>
            ) : (
              <div />
            )}

            {/* Due date */}
            {card.dueDate &&
              (() => {
                const { label, overdue } = formatDueDate(card.dueDate);
                return (
                  <div
                    className={[
                      'flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      overdue
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                    title={overdue ? 'Overdue' : undefined}
                  >
                    {/* Calendar icon */}
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-2.5 w-2.5"
                      aria-hidden="true"
                    >
                      <path d="M4.75 1a.75.75 0 0 1 .75.75V3h5V1.75a.75.75 0 0 1 1.5 0V3h1.25c.69 0 1.25.56 1.25 1.25v9.5c0 .69-.56 1.25-1.25 1.25H2.75C2.06 15 1.5 14.44 1.5 13.75v-9.5C1.5 3.56 2.06 3 2.75 3H4V1.75A.75.75 0 0 1 4.75 1ZM3 6.5v7.25c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6.5H3Z" />
                    </svg>
                    {label}
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay card (rendered by DragOverlay during active drag)
// ---------------------------------------------------------------------------

export function KanbanCardOverlay({ card, onOpen }: Omit<KanbanCardProps, 'isOverlay'>) {
  return <KanbanCard card={card} onOpen={onOpen} isOverlay />;
}
