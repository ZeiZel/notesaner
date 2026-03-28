'use client';

/**
 * GraphFilterPanel — collapsible sidebar filter panel for the knowledge graph.
 *
 * Sections:
 * - Tags: checkbox list with node counts
 * - Folders: collapsible tree of top-level folder names
 * - Date range: from / to date pickers
 * - Link type: multi-select pill buttons (WIKI, MARKDOWN, EMBED, BLOCK_REF)
 * - Orphan toggle: show/hide nodes with no connections
 *
 * The panel is controlled: all filter values come from props and mutations are
 * reported via callbacks.  Consumers should wire this to useGraphFilterStore.
 */

import { useState, useCallback } from 'react';
import type { LinkType } from '@notesaner/contracts';
import type { DateRange } from './graph-filter-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagOption {
  slug: string;
  /** Node count for this tag across the full (unfiltered) graph. */
  count: number;
}

export interface FolderOption {
  /** Top-level folder name / path segment. */
  name: string;
  /** Number of notes in this folder. */
  count: number;
}

export interface GraphFilterPanelProps {
  /** Available tags with node counts. */
  availableTags: TagOption[];
  /** Available folders with note counts. */
  availableFolders: FolderOption[];
  /** Currently selected tag slugs. */
  selectedTags: string[];
  /** Called when a tag is toggled. */
  onToggleTag: (tag: string) => void;
  /** Currently selected folder names. */
  selectedFolders: string[];
  /** Called when a folder is toggled. */
  onToggleFolder: (folder: string) => void;
  /** Currently active date range. */
  dateRange: DateRange;
  /** Called when the date range changes. */
  onDateRangeChange: (range: DateRange) => void;
  /** Currently selected link types. */
  selectedLinkTypes: LinkType[];
  /** Called when a link type is toggled. */
  onToggleLinkType: (type: LinkType) => void;
  /** Whether orphan nodes are shown. */
  showOrphans: boolean;
  /** Called when the orphan toggle changes. */
  onShowOrphansChange: (show: boolean) => void;
  /** Additional CSS class name applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINK_TYPE_OPTIONS: { type: LinkType; label: string; color: string }[] = [
  { type: 'WIKI', label: 'Wiki', color: '#6366f1' },
  { type: 'MARKDOWN', label: 'Markdown', color: '#10b981' },
  { type: 'EMBED', label: 'Embed', color: '#f59e0b' },
  { type: 'BLOCK_REF', label: 'Block ref', color: '#ec4899' },
];

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground"
      aria-expanded={expanded}
    >
      <span>{label}</span>
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={['h-3 w-3 transition-transform duration-150', expanded ? 'rotate-180' : ''].join(
          ' ',
        )}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphFilterPanel({
  availableTags,
  availableFolders,
  selectedTags,
  onToggleTag,
  selectedFolders,
  onToggleFolder,
  dateRange,
  onDateRangeChange,
  selectedLinkTypes,
  onToggleLinkType,
  showOrphans,
  onShowOrphansChange,
  className,
}: GraphFilterPanelProps) {
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [dateExpanded, setDateExpanded] = useState(true);
  const [linkTypesExpanded, setLinkTypesExpanded] = useState(true);

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateRangeChange({ ...dateRange, from: e.target.value || null });
    },
    [dateRange, onDateRangeChange],
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateRangeChange({ ...dateRange, to: e.target.value || null });
    },
    [dateRange, onDateRangeChange],
  );

  return (
    <div
      className={[
        'flex flex-col gap-0.5 rounded-md border border-border bg-card/95 p-3 shadow-md backdrop-blur',
        className ?? '',
      ].join(' ')}
      aria-label="Graph filters"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Tags section                                                         */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Tags"
        expanded={tagsExpanded}
        onToggle={() => setTagsExpanded((v) => !v)}
      />
      {tagsExpanded && (
        <div className="mb-1 max-h-40 overflow-y-auto">
          {availableTags.length === 0 ? (
            <p className="py-1 text-[11px] text-foreground-muted">No tags found</p>
          ) : (
            <ul className="space-y-0.5" role="group" aria-label="Tag filters">
              {availableTags.map(({ slug, count }) => {
                const checked = selectedTags.includes(slug);
                return (
                  <li key={slug}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleTag(slug)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                        aria-label={`Filter by tag ${slug}`}
                      />
                      <span className="flex-1 truncate text-xs text-foreground">#{slug}</span>
                      <span className="shrink-0 text-[10px] text-foreground-muted tabular-nums">
                        {count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Folders section                                                      */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Folders"
        expanded={foldersExpanded}
        onToggle={() => setFoldersExpanded((v) => !v)}
      />
      {foldersExpanded && (
        <div className="mb-1 max-h-40 overflow-y-auto">
          {availableFolders.length === 0 ? (
            <p className="py-1 text-[11px] text-foreground-muted">No folders found</p>
          ) : (
            <ul className="space-y-0.5" role="group" aria-label="Folder filters">
              {availableFolders.map(({ name, count }) => {
                const checked = selectedFolders.includes(name);
                return (
                  <li key={name}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleFolder(name)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                        aria-label={`Filter by folder ${name}`}
                      />
                      {/* Folder icon */}
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-3 w-3 shrink-0 text-foreground-muted"
                        aria-hidden="true"
                      >
                        <path d="M1.75 3A1.75 1.75 0 0 0 0 4.75v7.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0 0 16 12.25v-7a1.75 1.75 0 0 0-1.75-1.75H7.94l-1.22-1.22A.75.75 0 0 0 6.19 2H1.75ZM1.5 4.75a.25.25 0 0 1 .25-.25H6l1.22 1.22c.14.14.33.22.53.22H14.25a.25.25 0 0 1 .25.25v7a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25v-7.5Z" />
                      </svg>
                      <span className="flex-1 truncate text-xs text-foreground">{name}</span>
                      <span className="shrink-0 text-[10px] text-foreground-muted tabular-nums">
                        {count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Date range section                                                   */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Date created"
        expanded={dateExpanded}
        onToggle={() => setDateExpanded((v) => !v)}
      />
      {dateExpanded && (
        <div className="mb-1 flex flex-col gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-foreground-muted">From</span>
            <input
              type="date"
              value={dateRange.from ?? ''}
              onChange={handleFromChange}
              aria-label="Filter from date"
              className="h-7 rounded border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-foreground-muted">To</span>
            <input
              type="date"
              value={dateRange.to ?? ''}
              onChange={handleToChange}
              aria-label="Filter to date"
              className="h-7 rounded border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Link type section                                                    */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Link type"
        expanded={linkTypesExpanded}
        onToggle={() => setLinkTypesExpanded((v) => !v)}
      />
      {linkTypesExpanded && (
        <div className="mb-1 flex flex-wrap gap-1" role="group" aria-label="Link type filters">
          {LINK_TYPE_OPTIONS.map(({ type, label, color }) => {
            const active = selectedLinkTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggleLinkType(type)}
                aria-pressed={active}
                style={
                  active
                    ? { backgroundColor: color, color: '#fff', borderColor: color }
                    : { borderColor: color, color }
                }
                className={[
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  active ? '' : 'hover:opacity-80',
                ].join(' ')}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: active ? '#fff' : color }}
                  aria-hidden="true"
                />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Orphan toggle                                                        */}
      {/* ------------------------------------------------------------------ */}
      <label className="mt-0.5 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={showOrphans}
          onChange={(e) => onShowOrphansChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
          aria-label="Show orphan notes (notes with no connections)"
        />
        <span className="text-xs text-foreground">Show orphan notes</span>
      </label>
    </div>
  );
}
