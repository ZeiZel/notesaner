'use client';

/**
 * FilterBreadcrumbs — horizontal pill row showing active graph filters.
 *
 * Each active filter dimension is shown as a removable pill.  A "Clear all"
 * button is shown when any filter is active.  An optional filter count badge
 * summarises the total number of active dimensions.
 *
 * The component is fully controlled: callers wire it to useGraphFilterStore.
 */

import { useCallback } from 'react';
import type { LinkType } from '@notesaner/contracts';
import type { DateRange } from './graph-filter-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterBreadcrumbsProps {
  /** Active search query string. Empty string = no pill shown. */
  searchQuery: string;
  /** Active tag slugs. */
  selectedTags: string[];
  /** Active folder names. */
  selectedFolders: string[];
  /** Active date range. */
  dateRange: DateRange;
  /** Active link types. */
  selectedLinkTypes: LinkType[];
  /** Whether orphan nodes are hidden (showOrphans = false means "Hide orphans" pill is shown). */
  showOrphans: boolean;
  /** Total active filter count (drives the badge). */
  activeFilterCount: number;
  /** Called to clear the search query. */
  onClearSearch: () => void;
  /** Called to remove a single tag from the selection. */
  onRemoveTag: (tag: string) => void;
  /** Called to remove a single folder from the selection. */
  onRemoveFolder: (folder: string) => void;
  /** Called to clear the date range (set both bounds to null). */
  onClearDateRange: () => void;
  /** Called to remove a single link type from the selection. */
  onRemoveLinkType: (type: LinkType) => void;
  /** Called to reset the orphan toggle to true (show orphans = no filter). */
  onClearOrphanFilter: () => void;
  /** Called to clear all filters at once. */
  onClearAll: () => void;
  /** Additional CSS class name applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal Pill component
// ---------------------------------------------------------------------------

interface PillProps {
  label: string;
  onRemove: () => void;
  color?: string;
}

function FilterPill({ label, onRemove, color }: PillProps) {
  return (
    <span
      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
      style={
        color ? { borderColor: `${color}40`, backgroundColor: `${color}18`, color } : undefined
      }
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-primary/20 focus:outline-none"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Link type colors
// ---------------------------------------------------------------------------

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  WIKI: '#6366f1',
  MARKDOWN: '#10b981',
  EMBED: '#f59e0b',
  BLOCK_REF: '#ec4899',
};

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  WIKI: 'Wiki',
  MARKDOWN: 'Markdown',
  EMBED: 'Embed',
  BLOCK_REF: 'Block ref',
};

// ---------------------------------------------------------------------------
// Helper: format date range label
// ---------------------------------------------------------------------------

function formatDateRangeLabel(range: DateRange): string {
  if (range.from && range.to) return `${range.from} – ${range.to}`;
  if (range.from) return `From ${range.from}`;
  if (range.to) return `Until ${range.to}`;
  return '';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilterBreadcrumbs({
  searchQuery,
  selectedTags,
  selectedFolders,
  dateRange,
  selectedLinkTypes,
  showOrphans,
  activeFilterCount,
  onClearSearch,
  onRemoveTag,
  onRemoveFolder,
  onClearDateRange,
  onRemoveLinkType,
  onClearOrphanFilter,
  onClearAll,
  className,
}: FilterBreadcrumbsProps) {
  const hasDateFilter = dateRange.from !== null || dateRange.to !== null;
  const hasHiddenOrphans = !showOrphans;

  // Nothing to show when no filters are active
  if (activeFilterCount === 0) return null;

  const dateLabel = formatDateRangeLabel(dateRange);

  return (
    <div
      className={['flex flex-wrap items-center gap-1.5', className ?? ''].join(' ')}
      aria-label="Active filters"
      role="region"
    >
      {/* Filter count badge */}
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
        aria-label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
      >
        {activeFilterCount}
      </span>

      {/* Search query pill */}
      {searchQuery.trim().length > 0 && (
        <FilterPill label={`"${searchQuery.trim()}"`} onRemove={onClearSearch} />
      )}

      {/* Tag pills */}
      {selectedTags.map((tag) => (
        <FilterPill
          key={`tag:${tag}`}
          label={`#${tag}`}
          onRemove={() => onRemoveTag(tag)}
          color="#8b5cf6"
        />
      ))}

      {/* Folder pills */}
      {selectedFolders.map((folder) => (
        <FilterPill
          key={`folder:${folder}`}
          label={`/${folder}`}
          onRemove={() => onRemoveFolder(folder)}
          color="#f59e0b"
        />
      ))}

      {/* Date range pill */}
      {hasDateFilter && (
        <FilterPill label={dateLabel} onRemove={onClearDateRange} color="#14b8a6" />
      )}

      {/* Link type pills */}
      {selectedLinkTypes.map((type) => (
        <FilterPill
          key={`link:${type}`}
          label={LINK_TYPE_LABELS[type]}
          onRemove={() => onRemoveLinkType(type)}
          color={LINK_TYPE_COLORS[type]}
        />
      ))}

      {/* Orphan filter pill */}
      {hasHiddenOrphans && (
        <FilterPill label="No orphans" onRemove={onClearOrphanFilter} color="#94a3b8" />
      )}

      {/* Clear all button */}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-[10px] text-foreground-muted underline underline-offset-1 hover:text-foreground"
        aria-label="Clear all filters"
      >
        Clear all
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convenience hook: derive FilterBreadcrumbs props from the store
// ---------------------------------------------------------------------------

/**
 * Returns handler callbacks for FilterBreadcrumbs that are wired to the
 * provided store action functions.  Use this in a parent component to avoid
 * boilerplate.
 *
 * Example:
 *   const handlers = useFilterBreadcrumbHandlers(store);
 *   <FilterBreadcrumbs {...handlers} {...filterValues} />
 */
export function useFilterBreadcrumbHandlers(actions: {
  setSearchQuery: (q: string) => void;
  toggleTag: (t: string) => void;
  toggleFolder: (f: string) => void;
  setDateRange: (r: DateRange) => void;
  toggleLinkType: (t: LinkType) => void;
  setShowOrphans: (v: boolean) => void;
  clearAllFilters: () => void;
}) {
  const onClearSearch = useCallback(() => actions.setSearchQuery(''), [actions]);
  const onRemoveTag = useCallback((tag: string) => actions.toggleTag(tag), [actions]);
  const onRemoveFolder = useCallback((folder: string) => actions.toggleFolder(folder), [actions]);
  const onClearDateRange = useCallback(
    () => actions.setDateRange({ from: null, to: null }),
    [actions],
  );
  const onRemoveLinkType = useCallback((type: LinkType) => actions.toggleLinkType(type), [actions]);
  const onClearOrphanFilter = useCallback(() => actions.setShowOrphans(true), [actions]);
  const onClearAll = useCallback(() => actions.clearAllFilters(), [actions]);

  return {
    onClearSearch,
    onRemoveTag,
    onRemoveFolder,
    onClearDateRange,
    onRemoveLinkType,
    onClearOrphanFilter,
    onClearAll,
  };
}
