'use client';

/**
 * GraphFilter — Filter panel for the workspace graph view.
 *
 * Sections:
 * - Folders: checkbox list with note counts
 * - Tags: checkbox list with node counts
 * - Link depth: slider (1-5 hops)
 * - Date range: from/to date pickers
 * - Link types: multi-select pill buttons
 * - Orphan toggle: show/hide unconnected nodes
 * - Filter presets: save, load, delete named presets
 *
 * All filter values are read from and written to useWorkspaceGraphStore.
 * The component renders inline or as a collapsible sidebar panel.
 *
 * No useEffect for derived state — filter counts and active state are
 * computed by the store on every action.
 */

import { useState, useCallback } from 'react';
import type { LinkType } from '@notesaner/contracts';
import { cn } from '@/shared/lib/utils';
import { useWorkspaceGraphStore, selectGraphPresets } from '@/shared/stores/graph-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagOption {
  slug: string;
  count: number;
}

export interface FolderOption {
  name: string;
  count: number;
}

export interface GraphFilterProps {
  /** Available tags with node counts (derived from graph data). */
  availableTags: TagOption[];
  /** Available folders with note counts (derived from graph data). */
  availableFolders: FolderOption[];
  /** Whether the panel is open. */
  isOpen?: boolean;
  /** Called when the panel open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Additional CSS class applied to the root container. */
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
  badge,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground"
      aria-expanded={expanded}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/10 px-1 text-[9px] font-bold text-primary">
            {badge}
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={cn('h-3 w-3 transition-transform duration-150', expanded && 'rotate-180')}
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

function CheckboxItem({
  label,
  checked,
  onChange,
  count,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
        aria-label={`Filter by ${label}`}
      />
      {icon}
      <span className="flex-1 truncate text-xs text-foreground">{label}</span>
      <span className="shrink-0 text-[10px] text-foreground-muted tabular-nums">{count}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphFilter({
  availableTags,
  availableFolders,
  isOpen = true,
  onOpenChange,
  className,
}: GraphFilterProps) {
  // Store state
  const selectedTags = useWorkspaceGraphStore((s) => s.selectedTags);
  const selectedFolders = useWorkspaceGraphStore((s) => s.selectedFolders);
  const dateRange = useWorkspaceGraphStore((s) => s.dateRange);
  const selectedLinkTypes = useWorkspaceGraphStore((s) => s.selectedLinkTypes);
  const showOrphans = useWorkspaceGraphStore((s) => s.showOrphans);
  const linkDepth = useWorkspaceGraphStore((s) => s.linkDepth);
  const activeFilterCount = useWorkspaceGraphStore((s) => s.activeFilterCount);
  const savedPresets = useWorkspaceGraphStore(selectGraphPresets);

  // Store actions
  const toggleTag = useWorkspaceGraphStore((s) => s.toggleTag);
  const toggleFolder = useWorkspaceGraphStore((s) => s.toggleFolder);
  const setDateRange = useWorkspaceGraphStore((s) => s.setDateRange);
  const toggleLinkType = useWorkspaceGraphStore((s) => s.toggleLinkType);
  const setShowOrphans = useWorkspaceGraphStore((s) => s.setShowOrphans);
  const setLinkDepth = useWorkspaceGraphStore((s) => s.setLinkDepth);
  const clearAllFilters = useWorkspaceGraphStore((s) => s.clearAllFilters);
  const savePreset = useWorkspaceGraphStore((s) => s.savePreset);
  const deletePreset = useWorkspaceGraphStore((s) => s.deletePreset);
  const loadPreset = useWorkspaceGraphStore((s) => s.loadPreset);

  // Section expanded state
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [depthExpanded, setDepthExpanded] = useState(true);
  const [dateExpanded, setDateExpanded] = useState(false);
  const [linkTypesExpanded, setLinkTypesExpanded] = useState(true);
  const [presetsExpanded, setPresetsExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleDateFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateRange({ ...dateRange, from: e.target.value || null });
    },
    [dateRange, setDateRange],
  );

  const handleDateToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateRange({ ...dateRange, to: e.target.value || null });
    },
    [dateRange, setDateRange],
  );

  const handleSavePreset = useCallback(() => {
    if (presetName.trim()) {
      savePreset(presetName.trim());
      setPresetName('');
    }
  }, [presetName, savePreset]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange?.(true)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-border bg-card/95 p-2 shadow-sm backdrop-blur hover:bg-accent/50',
          className,
        )}
        aria-label="Open graph filters"
      >
        {/* Filter icon */}
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3.5 w-3.5 text-foreground-muted"
          aria-hidden="true"
        >
          <path d="M1 3.5A.5.5 0 0 1 1.5 3h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 3.5Zm2 3A.5.5 0 0 1 3.5 6h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6.5Zm2 3A.5.5 0 0 1 5.5 9h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 9.5Zm2 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5Z" />
        </svg>
        {activeFilterCount > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex w-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-card/95 p-3 shadow-md backdrop-blur',
        className,
      )}
      aria-label="Graph filters"
    >
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[11px] font-semibold text-foreground">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[10px] text-foreground-muted underline underline-offset-1 hover:text-foreground"
              aria-label="Clear all filters"
            >
              Clear
            </button>
          )}
          {onOpenChange && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close filter panel"
              className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:bg-accent hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Folders section                                                      */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Folders"
        expanded={foldersExpanded}
        onToggle={() => setFoldersExpanded((v) => !v)}
        badge={selectedFolders.length}
      />
      {foldersExpanded && (
        <div className="mb-1 max-h-36 overflow-y-auto">
          {availableFolders.length === 0 ? (
            <p className="py-1 text-[11px] text-foreground-muted">No folders found</p>
          ) : (
            <ul className="space-y-0.5" role="group" aria-label="Folder filters">
              {availableFolders.map(({ name, count }) => (
                <li key={name}>
                  <CheckboxItem
                    label={name}
                    checked={selectedFolders.includes(name)}
                    onChange={() => toggleFolder(name)}
                    count={count}
                    icon={
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-3 w-3 shrink-0 text-foreground-muted"
                        aria-hidden="true"
                      >
                        <path d="M1.75 3A1.75 1.75 0 0 0 0 4.75v7.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0 0 16 12.25v-7a1.75 1.75 0 0 0-1.75-1.75H7.94l-1.22-1.22A.75.75 0 0 0 6.19 2H1.75ZM1.5 4.75a.25.25 0 0 1 .25-.25H6l1.22 1.22c.14.14.33.22.53.22H14.25a.25.25 0 0 1 .25.25v7a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25v-7.5Z" />
                      </svg>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tags section                                                         */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Tags"
        expanded={tagsExpanded}
        onToggle={() => setTagsExpanded((v) => !v)}
        badge={selectedTags.length}
      />
      {tagsExpanded && (
        <div className="mb-1 max-h-36 overflow-y-auto">
          {availableTags.length === 0 ? (
            <p className="py-1 text-[11px] text-foreground-muted">No tags found</p>
          ) : (
            <ul className="space-y-0.5" role="group" aria-label="Tag filters">
              {availableTags.map(({ slug, count }) => (
                <li key={slug}>
                  <CheckboxItem
                    label={`#${slug}`}
                    checked={selectedTags.includes(slug)}
                    onChange={() => toggleTag(slug)}
                    count={count}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Link depth section                                                   */}
      {/* ------------------------------------------------------------------ */}
      <SectionHeader
        label="Link depth"
        expanded={depthExpanded}
        onToggle={() => setDepthExpanded((v) => !v)}
      />
      {depthExpanded && (
        <div className="mb-1 flex items-center gap-2 px-1">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={linkDepth}
            onChange={(e) => setLinkDepth(Number(e.target.value))}
            aria-label="Link depth (hops)"
            className="h-1 flex-1 cursor-pointer accent-primary"
          />
          <span className="w-4 text-center text-[11px] font-semibold text-foreground tabular-nums">
            {linkDepth}
          </span>
          <span className="text-[10px] text-foreground-muted">hops</span>
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
              onChange={handleDateFromChange}
              aria-label="Filter from date"
              className="h-7 rounded border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-foreground-muted">To</span>
            <input
              type="date"
              value={dateRange.to ?? ''}
              onChange={handleDateToChange}
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
        badge={selectedLinkTypes.length}
      />
      {linkTypesExpanded && (
        <div className="mb-1 flex flex-wrap gap-1" role="group" aria-label="Link type filters">
          {LINK_TYPE_OPTIONS.map(({ type, label, color }) => {
            const active = selectedLinkTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleLinkType(type)}
                aria-pressed={active}
                style={
                  active
                    ? { backgroundColor: color, color: '#fff', borderColor: color }
                    : { borderColor: color, color }
                }
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  !active && 'hover:opacity-80',
                )}
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
          onChange={(e) => setShowOrphans(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
          aria-label="Show orphan notes (notes with no connections)"
        />
        <span className="text-xs text-foreground">Show orphan notes</span>
      </label>

      {/* ------------------------------------------------------------------ */}
      {/* Filter presets                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-1 border-t border-border pt-1">
        <SectionHeader
          label="Presets"
          expanded={presetsExpanded}
          onToggle={() => setPresetsExpanded((v) => !v)}
        />
        {presetsExpanded && (
          <div className="flex flex-col gap-1.5">
            {/* Save preset input */}
            <div className="flex gap-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                }}
                placeholder="Preset name..."
                className="h-6 flex-1 rounded border border-border bg-card px-2 text-[11px] text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="New preset name"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:opacity-30 transition-colors"
                aria-label="Save current filters as preset"
              >
                Save
              </button>
            </div>

            {/* Preset list */}
            {savedPresets.length === 0 ? (
              <p className="py-1 text-[10px] text-foreground-muted">No saved presets</p>
            ) : (
              <ul className="space-y-0.5">
                {savedPresets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadPreset(preset.id)}
                      className="flex-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] text-foreground hover:bg-accent/50"
                      title={`Load preset: ${preset.name}`}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(preset.id)}
                      aria-label={`Delete preset: ${preset.name}`}
                      className="flex h-4 w-4 items-center justify-center rounded text-foreground-muted/50 hover:bg-accent hover:text-foreground"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                      >
                        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
