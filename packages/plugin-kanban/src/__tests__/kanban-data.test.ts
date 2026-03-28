/**
 * Tests for kanban-data utilities.
 *
 * Covers:
 * - parseBoardColumns — frontmatter parsing for column definitions
 * - parseCardFromFrontmatter — card extraction from note frontmatter
 * - buildBoard — distributing cards into columns
 * - filterCards — all filter dimensions
 * - sortCards — all sort fields and directions
 * - moveCard — cross-column and same-column moves with order recalculation
 * - collectAssignees / collectTags — unique value aggregation
 */

import { describe, it, expect } from 'vitest';
import {
  parseBoardColumns,
  parseCardFromFrontmatter,
  buildBoard,
  filterCards,
  sortCards,
  moveCard,
  collectAssignees,
  collectTags,
} from '../kanban-data';
import type { KanbanCard, KanbanFilters, KanbanSort } from '../kanban-data';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOARD_NOTE_ID = 'board-001';

const COLUMNS_FRONTMATTER = {
  kanban: {
    columns: [
      { id: 'backlog', title: 'Backlog', color: '#94a3b8', wipLimit: 10 },
      { id: 'in-progress', title: 'In Progress', color: '#3b82f6', wipLimit: 3 },
      { id: 'done', title: 'Done', color: '#10b981' },
    ],
  },
};

function makeCard(overrides: Partial<KanbanCard> = {}): KanbanCard {
  return {
    noteId: 'note-001',
    path: 'notes/task.md',
    title: 'My Task',
    columnId: 'backlog',
    assignee: undefined,
    dueDate: undefined,
    priority: 'medium',
    order: 0,
    tags: [],
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseBoardColumns
// ---------------------------------------------------------------------------

describe('parseBoardColumns', () => {
  it('parses valid column definitions', () => {
    const columns = parseBoardColumns(COLUMNS_FRONTMATTER);

    expect(columns).toHaveLength(3);
    expect(columns[0]).toMatchObject({
      id: 'backlog',
      title: 'Backlog',
      color: '#94a3b8',
      wipLimit: 10,
    });
    expect(columns[1]).toMatchObject({ id: 'in-progress', title: 'In Progress', wipLimit: 3 });
    expect(columns[2]).toMatchObject({ id: 'done', title: 'Done' });
    expect(columns[2].wipLimit).toBeUndefined();
  });

  it('returns empty array when kanban key is missing', () => {
    expect(parseBoardColumns({})).toEqual([]);
  });

  it('returns empty array when columns is not an array', () => {
    expect(parseBoardColumns({ kanban: { columns: 'not-array' } })).toEqual([]);
  });

  it('skips column entries that are missing id or title', () => {
    const fm = {
      kanban: {
        columns: [
          { id: 'backlog', title: 'Backlog' },
          { title: 'No ID' }, // missing id
          { id: 'no-title' }, // missing title
        ],
      },
    };
    const columns = parseBoardColumns(fm);
    expect(columns).toHaveLength(1);
    expect(columns[0].id).toBe('backlog');
  });

  it('uses a fallback color palette when color is absent', () => {
    const fm = {
      kanban: {
        columns: [
          { id: 'col-1', title: 'Column 1' },
          { id: 'col-2', title: 'Column 2' },
        ],
      },
    };
    const columns = parseBoardColumns(fm);
    expect(columns[0].color).toMatch(/^#/);
    expect(columns[1].color).toMatch(/^#/);
  });

  it('ignores wipLimit values of 0 or negative', () => {
    const fm = {
      kanban: {
        columns: [{ id: 'col', title: 'Col', wipLimit: 0 }],
      },
    };
    const [col] = parseBoardColumns(fm);
    expect(col.wipLimit).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseCardFromFrontmatter
// ---------------------------------------------------------------------------

describe('parseCardFromFrontmatter', () => {
  it('parses a fully populated card frontmatter', () => {
    const fm = {
      kanban_column: 'in-progress',
      assignee: 'alice',
      due_date: '2025-12-31',
      priority: 'high',
      kanban_order: 2,
      tags: ['feature', 'api'],
    };

    const card = parseCardFromFrontmatter(
      'note-xyz',
      'projects/api.md',
      'API Redesign',
      fm,
      '2025-06-01T10:00:00.000Z',
    );

    expect(card).not.toBeNull();
    expect(card!.noteId).toBe('note-xyz');
    expect(card!.path).toBe('projects/api.md');
    expect(card!.title).toBe('API Redesign');
    expect(card!.columnId).toBe('in-progress');
    expect(card!.assignee).toBe('alice');
    expect(card!.dueDate).toBe('2025-12-31');
    expect(card!.priority).toBe('high');
    expect(card!.order).toBe(2);
    expect(card!.tags).toEqual(['feature', 'api']);
    expect(card!.updatedAt).toBe('2025-06-01T10:00:00.000Z');
  });

  it('returns null when kanban_column is absent', () => {
    const result = parseCardFromFrontmatter('note-1', 'a.md', 'Title', {}, '2025-01-01T00:00:00Z');
    expect(result).toBeNull();
  });

  it('defaults priority to medium when not specified', () => {
    const fm = { kanban_column: 'backlog' };
    const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
    expect(card!.priority).toBe('medium');
  });

  it('defaults order to 0 when kanban_order is not a number', () => {
    const fm = { kanban_column: 'backlog', kanban_order: 'not-a-number' };
    const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
    expect(card!.order).toBe(0);
  });

  it('normalises unknown priority values to medium', () => {
    const fm = { kanban_column: 'backlog', priority: 'critical' };
    const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
    expect(card!.priority).toBe('medium');
  });

  it('parses all valid priority values', () => {
    const priorities = ['low', 'medium', 'high', 'urgent'] as const;
    for (const p of priorities) {
      const fm = { kanban_column: 'backlog', priority: p };
      const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
      expect(card!.priority).toBe(p);
    }
  });

  it('accepts comma-separated tags string', () => {
    const fm = { kanban_column: 'backlog', tags: 'bug, feature , dx' };
    const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
    expect(card!.tags).toEqual(['bug', 'feature', 'dx']);
  });

  it('handles empty string kanban_column as null (returns null)', () => {
    const fm = { kanban_column: '' };
    const card = parseCardFromFrontmatter('n', 'p', 't', fm, '2025-01-01T00:00:00Z');
    expect(card).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildBoard
// ---------------------------------------------------------------------------

describe('buildBoard', () => {
  it('distributes cards into their respective columns', () => {
    const columns = parseBoardColumns(COLUMNS_FRONTMATTER);
    const cards = [
      makeCard({ noteId: 'a', columnId: 'backlog', order: 1 }),
      makeCard({ noteId: 'b', columnId: 'backlog', order: 0 }),
      makeCard({ noteId: 'c', columnId: 'in-progress', order: 0 }),
    ];

    const board = buildBoard(BOARD_NOTE_ID, columns, cards);

    expect(board.boardNoteId).toBe(BOARD_NOTE_ID);
    expect(board.cardsByColumn['backlog']).toHaveLength(2);
    expect(board.cardsByColumn['in-progress']).toHaveLength(1);
    expect(board.cardsByColumn['done']).toHaveLength(0);
  });

  it('sorts each column by order ascending', () => {
    const columns = parseBoardColumns(COLUMNS_FRONTMATTER);
    const cards = [
      makeCard({ noteId: 'x', columnId: 'backlog', order: 3 }),
      makeCard({ noteId: 'y', columnId: 'backlog', order: 1 }),
      makeCard({ noteId: 'z', columnId: 'backlog', order: 2 }),
    ];

    const board = buildBoard(BOARD_NOTE_ID, columns, cards);
    const ids = board.cardsByColumn['backlog'].map((c) => c.noteId);
    expect(ids).toEqual(['y', 'z', 'x']);
  });

  it('drops cards whose columnId does not match any column', () => {
    const columns = parseBoardColumns(COLUMNS_FRONTMATTER);
    const cards = [makeCard({ noteId: 'orphan', columnId: 'nonexistent' })];

    const board = buildBoard(BOARD_NOTE_ID, columns, cards);
    const allCards = Object.values(board.cardsByColumn).flat();
    expect(allCards).toHaveLength(0);
  });

  it('initialises all columns even when they have no cards', () => {
    const columns = parseBoardColumns(COLUMNS_FRONTMATTER);
    const board = buildBoard(BOARD_NOTE_ID, columns, []);
    expect(Object.keys(board.cardsByColumn)).toEqual(['backlog', 'in-progress', 'done']);
  });
});

// ---------------------------------------------------------------------------
// filterCards
// ---------------------------------------------------------------------------

describe('filterCards', () => {
  const cards: KanbanCard[] = [
    makeCard({
      noteId: '1',
      title: 'Fix auth bug',
      priority: 'high',
      assignee: 'alice',
      tags: ['bug', 'auth'],
      dueDate: '2025-06-01',
    }),
    makeCard({
      noteId: '2',
      title: 'Add dark mode',
      priority: 'medium',
      assignee: 'bob',
      tags: ['feature', 'ui'],
      dueDate: '2025-12-31',
    }),
    makeCard({ noteId: '3', title: 'Refactor API', priority: 'low', tags: ['dx'] }),
    makeCard({
      noteId: '4',
      title: 'Performance improvements',
      priority: 'urgent',
      assignee: 'alice',
      tags: ['perf'],
    }),
  ];

  const emptyFilters: KanbanFilters = {
    searchQuery: '',
    assignees: [],
    priorities: [],
    tags: [],
  };

  it('returns all cards when no filters are active', () => {
    expect(filterCards(cards, emptyFilters)).toHaveLength(4);
  });

  it('filters by search query (case-insensitive)', () => {
    const result = filterCards(cards, { ...emptyFilters, searchQuery: 'auth' });
    expect(result.map((c) => c.noteId)).toEqual(['1']);
  });

  it('filters by single priority', () => {
    const result = filterCards(cards, { ...emptyFilters, priorities: ['high'] });
    expect(result.map((c) => c.noteId)).toEqual(['1']);
  });

  it('filters by multiple priorities', () => {
    const result = filterCards(cards, { ...emptyFilters, priorities: ['high', 'urgent'] });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.noteId).sort()).toEqual(['1', '4']);
  });

  it('filters by assignee', () => {
    const result = filterCards(cards, { ...emptyFilters, assignees: ['alice'] });
    expect(result.map((c) => c.noteId).sort()).toEqual(['1', '4']);
  });

  it('filters by tags (any match)', () => {
    const result = filterCards(cards, { ...emptyFilters, tags: ['auth', 'dx'] });
    expect(result.map((c) => c.noteId).sort()).toEqual(['1', '3']);
  });

  it('filters by dueBefore date', () => {
    const result = filterCards(cards, { ...emptyFilters, dueBefore: '2025-07-01' });
    expect(result.map((c) => c.noteId)).toEqual(['1']);
  });

  it('excludes cards without a due date when dueBefore is set', () => {
    const result = filterCards(cards, { ...emptyFilters, dueBefore: '2099-12-31' });
    const resultIds = result.map((c) => c.noteId);
    expect(resultIds).not.toContain('3'); // no dueDate
    expect(resultIds).not.toContain('4'); // no dueDate
  });

  it('combines multiple filters with AND logic', () => {
    const result = filterCards(cards, {
      ...emptyFilters,
      assignees: ['alice'],
      priorities: ['high'],
    });
    expect(result.map((c) => c.noteId)).toEqual(['1']);
  });

  it('returns empty array when no cards match', () => {
    const result = filterCards(cards, { ...emptyFilters, searchQuery: 'zzz-no-match' });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sortCards
// ---------------------------------------------------------------------------

describe('sortCards', () => {
  const cards: KanbanCard[] = [
    makeCard({
      noteId: 'b',
      title: 'Beta',
      priority: 'high',
      order: 2,
      dueDate: '2025-06-15',
      updatedAt: '2025-01-02T00:00:00Z',
    }),
    makeCard({
      noteId: 'a',
      title: 'Alpha',
      priority: 'low',
      order: 1,
      dueDate: '2025-01-10',
      updatedAt: '2025-01-01T00:00:00Z',
    }),
    makeCard({
      noteId: 'c',
      title: 'Gamma',
      priority: 'urgent',
      order: 3,
      dueDate: '2025-12-01',
      updatedAt: '2025-01-03T00:00:00Z',
    }),
  ];

  it('sorts by title ascending', () => {
    const sort: KanbanSort = { field: 'title', direction: 'asc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title descending', () => {
    const sort: KanbanSort = { field: 'title', direction: 'desc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by dueDate ascending', () => {
    const sort: KanbanSort = { field: 'dueDate', direction: 'asc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by dueDate descending', () => {
    const sort: KanbanSort = { field: 'dueDate', direction: 'desc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by priority ascending (low → urgent)', () => {
    const sort: KanbanSort = { field: 'priority', direction: 'asc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by priority descending (urgent → low)', () => {
    const sort: KanbanSort = { field: 'priority', direction: 'desc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by manual order ascending', () => {
    const sort: KanbanSort = { field: 'order', direction: 'asc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by updatedAt ascending', () => {
    const sort: KanbanSort = { field: 'updatedAt', direction: 'asc' };
    const result = sortCards(cards, sort);
    expect(result.map((c) => c.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('places cards without a dueDate at the end regardless of sort direction', () => {
    const mixed: KanbanCard[] = [
      makeCard({ noteId: 'no-date', dueDate: undefined }),
      makeCard({ noteId: 'has-date', dueDate: '2025-01-01' }),
    ];
    const ascResult = sortCards(mixed, { field: 'dueDate', direction: 'asc' });
    expect(ascResult[ascResult.length - 1].noteId).toBe('no-date');

    const descResult = sortCards(mixed, { field: 'dueDate', direction: 'desc' });
    expect(descResult[descResult.length - 1].noteId).toBe('no-date');
  });

  it('does not mutate the original array', () => {
    const original = [...cards];
    sortCards(cards, { field: 'title', direction: 'desc' });
    expect(cards).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// moveCard
// ---------------------------------------------------------------------------

describe('moveCard', () => {
  function makeBoard() {
    return {
      backlog: [
        makeCard({ noteId: 'a', order: 0 }),
        makeCard({ noteId: 'b', order: 1 }),
        makeCard({ noteId: 'c', order: 2 }),
      ],
      'in-progress': [makeCard({ noteId: 'd', columnId: 'in-progress', order: 0 })],
      done: [] as KanbanCard[],
    };
  }

  it('moves a card to another column at the specified index', () => {
    const board = makeBoard();
    const next = moveCard(board, 'a', 'in-progress', 0);

    expect(next['backlog'].map((c) => c.noteId)).not.toContain('a');
    expect(next['in-progress'][0].noteId).toBe('a');
    expect(next['in-progress'][0].columnId).toBe('in-progress');
  });

  it('recalculates order values after move', () => {
    const board = makeBoard();
    const next = moveCard(board, 'a', 'done', 0);

    expect(next['done'][0].order).toBe(0);
    // Remaining backlog cards should have contiguous order values
    next['backlog'].forEach((card, i) => {
      expect(card.order).toBe(i);
    });
  });

  it('moves a card within the same column', () => {
    const board = makeBoard();
    // Move 'c' (index 2) to index 0 within backlog
    const next = moveCard(board, 'c', 'backlog', 0);

    expect(next['backlog'].map((c) => c.noteId)).toEqual(['c', 'a', 'b']);
    expect(next['backlog'][0].order).toBe(0);
    expect(next['backlog'][1].order).toBe(1);
    expect(next['backlog'][2].order).toBe(2);
  });

  it('appends to end when targetIndex exceeds column length', () => {
    const board = makeBoard();
    const next = moveCard(board, 'a', 'done', 999);

    expect(next['done'][0].noteId).toBe('a');
  });

  it('returns the original map unchanged when card is not found', () => {
    const board = makeBoard();
    const next = moveCard(board, 'nonexistent', 'backlog', 0);
    // Same structure — cards unchanged
    expect(next['backlog'].map((c) => c.noteId)).toEqual(board['backlog'].map((c) => c.noteId));
  });

  it('does not mutate the input map', () => {
    const board = makeBoard();
    const originalBacklogIds = board['backlog'].map((c) => c.noteId);
    moveCard(board, 'a', 'done', 0);
    expect(board['backlog'].map((c) => c.noteId)).toEqual(originalBacklogIds);
  });
});

// ---------------------------------------------------------------------------
// collectAssignees / collectTags
// ---------------------------------------------------------------------------

describe('collectAssignees', () => {
  it('returns sorted unique assignees', () => {
    const cards = [
      makeCard({ assignee: 'charlie' }),
      makeCard({ assignee: 'alice' }),
      makeCard({ assignee: 'alice' }),
      makeCard({ assignee: undefined }),
    ];
    expect(collectAssignees(cards)).toEqual(['alice', 'charlie']);
  });

  it('returns empty array when no assignees present', () => {
    expect(collectAssignees([makeCard()])).toEqual([]);
  });
});

describe('collectTags', () => {
  it('returns sorted unique tags across all cards', () => {
    const cards = [
      makeCard({ tags: ['bug', 'auth'] }),
      makeCard({ tags: ['feature', 'auth'] }),
      makeCard({ tags: [] }),
    ];
    expect(collectTags(cards)).toEqual(['auth', 'bug', 'feature']);
  });

  it('returns empty array when no tags present', () => {
    expect(collectTags([makeCard()])).toEqual([]);
  });
});
