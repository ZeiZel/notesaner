'use client';

/**
 * KanbanFilters — toolbar for filtering and sorting cards on the board.
 *
 * Provides:
 * - Title search input
 * - Priority multi-select toggles (low / medium / high / urgent)
 * - Assignee dropdown (derived from cards currently on the board)
 * - Tag filter (derived from cards currently on the board)
 * - Due-before date picker
 * - Sort field + direction selector
 * - "Clear all" shortcut
 */

import { useState } from 'react';
import type {
  KanbanFilters as KanbanFiltersType,
  KanbanSort,
  KanbanPriority,
  CardSortField,
  SortDirection,
} from './kanban-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KanbanFiltersProps {
  filters: KanbanFiltersType;
  sort: KanbanSort;
  /** All unique assignee names present on the board. */
  availableAssignees: string[];
  /** All unique tags present on the board. */
  availableTags: string[];
  onFiltersChange: (filters: Partial<KanbanFiltersType>) => void;
  onSortChange: (sort: KanbanSort) => void;
  onClearFilters: () => void;
  /** Total card count — shown in the info strip. */
  totalCards: number;
  /** Card count after filters are applied. */
  visibleCards: number;
}

// ---------------------------------------------------------------------------
// Priority options
// ---------------------------------------------------------------------------

const PRIORITIES: { value: KanbanPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

const SORT_FIELDS: { value: CardSortField; label: string }[] = [
  { value: 'order', label: 'Manual order' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'updatedAt', label: 'Last updated' },
];

// ---------------------------------------------------------------------------
// Pill toggle button
// ---------------------------------------------------------------------------

function PillToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-muted-foreground hover:border-primary hover:text-primary',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KanbanFilters({
  filters,
  sort,
  availableAssignees,
  availableTags,
  onFiltersChange,
  onSortChange,
  onClearFilters,
  totalCards,
  visibleCards,
}: KanbanFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters =
    filters.searchQuery.length > 0 ||
    filters.assignees.length > 0 ||
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.dueBefore !== undefined;

  function togglePriority(priority: KanbanPriority) {
    const current = filters.priorities;
    const next = current.includes(priority)
      ? current.filter((p) => p !== priority)
      : [...current, priority];
    onFiltersChange({ priorities: next });
  }

  function toggleAssignee(name: string) {
    const current = filters.assignees;
    const next = current.includes(name) ? current.filter((a) => a !== name) : [...current, name];
    onFiltersChange({ assignees: next });
  }

  function toggleTag(tag: string) {
    const current = filters.tags;
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    onFiltersChange({ tags: next });
  }

  function handleSortFieldChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onSortChange({ ...sort, field: e.target.value as CardSortField });
  }

  function handleSortDirectionToggle() {
    const next: SortDirection = sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ ...sort, direction: next });
  }

  return (
    <div className="border-b border-border bg-card px-4 py-2">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex items-center">
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="absolute left-2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
            placeholder="Search cards..."
            aria-label="Search cards by title"
            className="h-7 w-44 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Priority pills */}
        <div className="flex items-center gap-1">
          {PRIORITIES.map(({ value, label }) => (
            <PillToggle
              key={value}
              active={filters.priorities.includes(value)}
              onClick={() => togglePriority(value)}
            >
              {label}
            </PillToggle>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort selector */}
        <div className="flex items-center gap-1">
          <select
            value={sort.field}
            onChange={handleSortFieldChange}
            aria-label="Sort field"
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_FIELDS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Direction toggle */}
          <button
            type="button"
            onClick={handleSortDirectionToggle}
            aria-label={`Sort ${sort.direction === 'asc' ? 'ascending' : 'descending'}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            {sort.direction === 'asc' ? (
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M8 2.75a.75.75 0 0 1 .75.75v8.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.5A.75.75 0 0 1 8 2.75Z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M8 13.25a.75.75 0 0 1-.75-.75V3.81L5.03 6.03a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06L8.75 3.81v8.69A.75.75 0 0 1 8 13.25Z" />
              </svg>
            )}
          </button>
        </div>

        {/* Advanced filter toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className={[
            'flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors',
            showAdvanced || hasActiveFilters
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M1.5 3.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .39.813L9.5 9.6V13.5a.5.5 0 0 1-.777.416l-3-2A.5.5 0 0 1 5.5 11.5V9.6L1.61 4.313A.5.5 0 0 1 1.5 3.5z" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
              !
            </span>
          )}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showAdvanced && (
        <div className="mt-2 flex flex-wrap gap-4 rounded-md border border-border bg-muted/20 p-3">
          {/* Assignees */}
          {availableAssignees.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assignee
              </p>
              <div className="flex flex-wrap gap-1">
                {availableAssignees.map((name) => (
                  <PillToggle
                    key={name}
                    active={filters.assignees.includes(name)}
                    onClick={() => toggleAssignee(name)}
                  >
                    {name}
                  </PillToggle>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tag
              </p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <PillToggle
                    key={tag}
                    active={filters.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                  </PillToggle>
                ))}
              </div>
            </div>
          )}

          {/* Due before */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Due before
            </p>
            <input
              type="date"
              value={filters.dueBefore ?? ''}
              onChange={(e) => onFiltersChange({ dueBefore: e.target.value || undefined })}
              aria-label="Filter cards due before this date"
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {filters.dueBefore && (
              <button
                type="button"
                onClick={() => onFiltersChange({ dueBefore: undefined })}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              >
                x
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info strip */}
      <div className="mt-1.5 flex items-center justify-end">
        <span className="text-[10px] text-muted-foreground">
          {visibleCards === totalCards
            ? `${totalCards} cards`
            : `${visibleCards} of ${totalCards} cards`}
        </span>
      </div>
    </div>
  );
}
