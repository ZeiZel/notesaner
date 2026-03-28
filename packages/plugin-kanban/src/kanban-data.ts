/**
 * Kanban data utilities.
 *
 * Parses note frontmatter into a typed KanbanBoard structure and provides
 * helper functions for filtering and sorting cards.
 *
 * Frontmatter schema expected on the board note:
 *
 * ```yaml
 * kanban:
 *   columns:
 *     - id: backlog
 *       title: Backlog
 *       color: "#94a3b8"
 *       wipLimit: 10
 *     - id: in-progress
 *       title: In Progress
 *       color: "#3b82f6"
 *       wipLimit: 3
 *     - id: done
 *       title: Done
 *       color: "#10b981"
 * ```
 *
 * Cards are notes in the workspace whose frontmatter contains:
 * ```yaml
 * kanban_board: <board-note-id>
 * kanban_column: <column-id>
 * assignee: alice
 * due_date: "2025-12-31"
 * priority: high    # low | medium | high | urgent
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Priority levels for a kanban card. */
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';

/** A single column definition parsed from the board note frontmatter. */
export interface KanbanColumn {
  /** Stable identifier used by cards to reference this column. */
  id: string;
  /** Human-readable column title. */
  title: string;
  /**
   * Optional hex color for the column header accent.
   * Defaults to a neutral slate tone when absent.
   */
  color: string;
  /**
   * Optional Work-In-Progress limit.
   * When defined and > 0, the column header shows a warning when exceeded.
   * undefined or 0 means no limit.
   */
  wipLimit?: number;
}

/** A Kanban card derived from a note's frontmatter and metadata. */
export interface KanbanCard {
  /** Note ID — stable across renames. */
  noteId: string;
  /** Note file path (relative to workspace root). */
  path: string;
  /** Note title extracted from frontmatter `title` field or filename. */
  title: string;
  /** Which column this card belongs to. Matches KanbanColumn.id. */
  columnId: string;
  /** Optional assignee name or username. */
  assignee?: string;
  /** Optional ISO date string (YYYY-MM-DD). */
  dueDate?: string;
  /** Card priority. Defaults to 'medium' when absent. */
  priority: KanbanPriority;
  /** Card position within its column (lower = higher). Defaults to 0. */
  order: number;
  /** Tags copied from the note's frontmatter tags array. */
  tags: string[];
  /** ISO timestamp — used for default sorting. */
  updatedAt: string;
}

/** Full board structure returned by parseBoardFrontmatter / buildBoard. */
export interface KanbanBoard {
  /** Note ID of the note that defines the board (holds column definitions). */
  boardNoteId: string;
  /** Ordered list of columns as defined in the board note's frontmatter. */
  columns: KanbanColumn[];
  /**
   * All cards belonging to this board, indexed by column ID.
   * Columns that have no cards are present with an empty array.
   */
  cardsByColumn: Record<string, KanbanCard[]>;
}

// ---------------------------------------------------------------------------
// Filter / sort types
// ---------------------------------------------------------------------------

/** Direction for sort operations. */
export type SortDirection = 'asc' | 'desc';

/** Fields that cards can be sorted by. */
export type CardSortField = 'title' | 'dueDate' | 'priority' | 'order' | 'updatedAt';

/** Active filter state for the board. */
export interface KanbanFilters {
  /** Substring filter applied to card titles (case-insensitive). Empty = no filter. */
  searchQuery: string;
  /** Show only cards assigned to these assignees. Empty = show all. */
  assignees: string[];
  /** Show only cards with these priorities. Empty = show all. */
  priorities: KanbanPriority[];
  /** Show only cards with at least one of these tags. Empty = show all. */
  tags: string[];
  /**
   * Show only cards whose due date is on or before this ISO date.
   * Undefined = no due-date filter.
   */
  dueBefore?: string;
}

/** Sort configuration for cards. */
export interface KanbanSort {
  field: CardSortField;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Priority ordering (for sort comparisons)
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<KanbanPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Coerces an unknown frontmatter value to a string, returning undefined when
 * the value is absent or not string-representable.
 */
function toString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value || undefined;
  return String(value) || undefined;
}

/**
 * Parses a raw frontmatter priority value into a typed KanbanPriority.
 * Defaults to 'medium' for unrecognised values.
 */
function parsePriority(value: unknown): KanbanPriority {
  const VALID: KanbanPriority[] = ['low', 'medium', 'high', 'urgent'];
  const str = toString(value)?.toLowerCase();
  return (VALID.find((p) => p === str) ?? 'medium') as KanbanPriority;
}

/**
 * Parses the raw frontmatter `tags` value into a string array.
 * Accepts a YAML sequence (string[]) or a comma-separated string.
 */
function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Validates that a raw column object has the required `id` and `title` fields.
 */
function isRawColumn(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['id'] === 'string' &&
    typeof (value as Record<string, unknown>)['title'] === 'string'
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses the board note's frontmatter into an ordered list of KanbanColumns.
 *
 * Returns an empty array when the frontmatter does not contain a valid
 * `kanban.columns` sequence.
 *
 * @param frontmatter - Raw frontmatter object from the board note.
 */
export function parseBoardColumns(frontmatter: Record<string, unknown>): KanbanColumn[] {
  const kanban = frontmatter['kanban'];
  if (typeof kanban !== 'object' || kanban === null) return [];

  const rawColumns = (kanban as Record<string, unknown>)['columns'];
  if (!Array.isArray(rawColumns)) return [];

  return rawColumns.filter(isRawColumn).map((raw, index) => ({
    id: raw['id'] as string,
    title: raw['title'] as string,
    color: toString(raw['color']) ?? DEFAULT_COLUMN_COLORS[index % DEFAULT_COLUMN_COLORS.length],
    wipLimit:
      typeof raw['wipLimit'] === 'number' && raw['wipLimit'] > 0 ? raw['wipLimit'] : undefined,
  }));
}

/** Fallback palette when a column definition omits a color. */
const DEFAULT_COLUMN_COLORS = [
  '#94a3b8', // slate
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
];

/**
 * Parses a note's frontmatter into a KanbanCard when the note is part of a
 * Kanban board (i.e. has a `kanban_board` field).
 *
 * Returns `null` when the note is not a kanban card or required fields are
 * missing.
 *
 * @param noteId   - The note's stable ID.
 * @param path     - The note's file path.
 * @param title    - The note title (from frontmatter `title` or filename).
 * @param fm       - Raw frontmatter object.
 * @param updatedAt - ISO timestamp for sorting fallback.
 */
export function parseCardFromFrontmatter(
  noteId: string,
  path: string,
  title: string,
  fm: Record<string, unknown>,
  updatedAt: string,
): KanbanCard | null {
  const columnId = toString(fm['kanban_column']);
  if (!columnId) return null;

  return {
    noteId,
    path,
    title,
    columnId,
    assignee: toString(fm['assignee']),
    dueDate: toString(fm['due_date']),
    priority: parsePriority(fm['priority']),
    order: typeof fm['kanban_order'] === 'number' ? fm['kanban_order'] : 0,
    tags: parseTags(fm['tags']),
    updatedAt,
  };
}

/**
 * Builds a KanbanBoard from a set of columns and an unordered list of cards.
 *
 * Cards are distributed into their respective columns and sorted by `order`
 * (ascending) as a stable default. Columns with no cards appear with an
 * empty array so callers can always iterate over all columns without
 * null-checking individual keys.
 *
 * @param boardNoteId - ID of the note that holds column definitions.
 * @param columns     - Parsed column definitions.
 * @param cards       - All parsed cards belonging to this board.
 */
export function buildBoard(
  boardNoteId: string,
  columns: KanbanColumn[],
  cards: KanbanCard[],
): KanbanBoard {
  const cardsByColumn: Record<string, KanbanCard[]> = {};

  // Initialise with empty arrays so every column has an entry.
  for (const col of columns) {
    cardsByColumn[col.id] = [];
  }

  // Distribute cards; unknown column IDs are ignored.
  for (const card of cards) {
    if (cardsByColumn[card.columnId]) {
      cardsByColumn[card.columnId].push(card);
    }
  }

  // Sort each column's cards by order ascending.
  for (const colId of Object.keys(cardsByColumn)) {
    cardsByColumn[colId].sort((a, b) => a.order - b.order);
  }

  return { boardNoteId, columns, cardsByColumn };
}

// ---------------------------------------------------------------------------
// Filtering and sorting
// ---------------------------------------------------------------------------

/**
 * Applies the given filters to a list of cards, returning only the cards
 * that match all active filter criteria.
 */
export function filterCards(cards: KanbanCard[], filters: KanbanFilters): KanbanCard[] {
  return cards.filter((card) => {
    // Title search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!card.title.toLowerCase().includes(q)) return false;
    }

    // Assignee filter
    if (filters.assignees.length > 0) {
      if (!card.assignee || !filters.assignees.includes(card.assignee)) {
        return false;
      }
    }

    // Priority filter
    if (filters.priorities.length > 0) {
      if (!filters.priorities.includes(card.priority)) return false;
    }

    // Tag filter — card must have at least one of the selected tags
    if (filters.tags.length > 0) {
      const hasTag = filters.tags.some((t) => card.tags.includes(t));
      if (!hasTag) return false;
    }

    // Due-before filter
    if (filters.dueBefore) {
      if (!card.dueDate) return false;
      if (card.dueDate > filters.dueBefore) return false;
    }

    return true;
  });
}

/**
 * Sorts a list of cards according to the given sort configuration.
 *
 * Returns a new array — does not mutate the input.
 */
export function sortCards(cards: KanbanCard[], sort: KanbanSort): KanbanCard[] {
  return [...cards].sort((a, b) => {
    let cmp = 0;

    switch (sort.field) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;

      case 'dueDate':
        // Cards without a due date sort to the end regardless of direction.
        if (!a.dueDate && !b.dueDate) {
          cmp = 0;
          break;
        }
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        cmp = a.dueDate.localeCompare(b.dueDate);
        break;

      case 'priority':
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;

      case 'order':
        cmp = a.order - b.order;
        break;

      case 'updatedAt':
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
    }

    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Card move helpers
// ---------------------------------------------------------------------------

/**
 * Produces an updated cards-by-column map after moving a card to a new
 * column, inserting it at the given index.
 *
 * This is a pure function — it does not mutate the input map.
 *
 * @param cardsByColumn - Current column → cards mapping.
 * @param cardId        - noteId of the card being moved.
 * @param targetColumnId - Column the card is being moved into.
 * @param targetIndex    - Zero-based index within the target column.
 * @returns Updated cardsByColumn with recalculated `order` values.
 */
export function moveCard(
  cardsByColumn: Record<string, KanbanCard[]>,
  cardId: string,
  targetColumnId: string,
  targetIndex: number,
): Record<string, KanbanCard[]> {
  // Deep-clone to avoid mutating the original.
  const next: Record<string, KanbanCard[]> = {};
  for (const [colId, cards] of Object.entries(cardsByColumn)) {
    next[colId] = [...cards];
  }

  // Find and remove the card from its current column.
  let movingCard: KanbanCard | undefined;
  for (const colId of Object.keys(next)) {
    const idx = next[colId].findIndex((c) => c.noteId === cardId);
    if (idx !== -1) {
      [movingCard] = next[colId].splice(idx, 1);
      break;
    }
  }

  if (!movingCard) return cardsByColumn; // card not found — no-op

  // Insert into the target column at the desired index.
  const updatedCard: KanbanCard = {
    ...movingCard,
    columnId: targetColumnId,
  };

  if (!next[targetColumnId]) {
    next[targetColumnId] = [];
  }

  next[targetColumnId].splice(
    Math.max(0, Math.min(targetIndex, next[targetColumnId].length)),
    0,
    updatedCard,
  );

  // Recalculate `order` for all cards in the affected columns so order values
  // stay contiguous (useful for persisting back to frontmatter).
  for (const colId of Object.keys(next)) {
    next[colId] = next[colId].map((card, i) => ({ ...card, order: i }));
  }

  return next;
}

// ---------------------------------------------------------------------------
// Utility: collect all unique assignees / tags across cards
// ---------------------------------------------------------------------------

/** Returns all unique non-empty assignee values across the given cards. */
export function collectAssignees(cards: KanbanCard[]): string[] {
  const set = new Set<string>();
  for (const card of cards) {
    if (card.assignee) set.add(card.assignee);
  }
  return Array.from(set).sort();
}

/** Returns all unique tags across the given cards. */
export function collectTags(cards: KanbanCard[]): string[] {
  const set = new Set<string>();
  for (const card of cards) {
    for (const tag of card.tags) set.add(tag);
  }
  return Array.from(set).sort();
}
