'use client';

/**
 * NoteList — virtualized list of notes for tag/folder views.
 *
 * Uses VirtualList to efficiently render large collections of notes.
 * Supports dynamic heights for section headings vs note items.
 *
 * Use cases:
 *   - All notes in a folder
 *   - Notes tagged with a specific tag
 *   - Recently modified notes
 *   - Bookmarked notes
 */

import { useCallback, useRef, type ReactNode } from 'react';
import { VirtualList, type VirtualListHandle } from '@/shared/lib/VirtualList';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteListItem {
  id: string;
  title: string;
  path: string;
  /** Preview snippet or first line of content. */
  preview?: string;
  /** Last modified timestamp (ISO string). */
  updatedAt: string;
  /** Tags attached to this note. */
  tags?: string[];
  /** Whether this note is a section heading (e.g. folder divider). */
  isHeading?: boolean;
  /** Heading text (when isHeading is true). */
  headingText?: string;
}

export interface NoteListProps {
  /** Notes to display (may include heading items). */
  items: NoteListItem[];
  /** Currently active/selected note ID. */
  activeNoteId?: string | null;
  /** Called when a note is clicked. */
  onNoteClick: (noteId: string) => void;
  /** Called when scroll reaches the bottom (load more). */
  onReachEnd?: () => void;
  /** Empty state component. */
  emptyState?: ReactNode;
  /** Container className. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Heading row
// ---------------------------------------------------------------------------

function HeadingRow({ item }: { item: NoteListItem }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {item.headingText ?? item.title}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note row
// ---------------------------------------------------------------------------

function NoteRow({
  item,
  isActive,
  onClick,
}: {
  item: NoteListItem;
  isActive: boolean;
  onClick: (id: string) => void;
}) {
  const updatedLabel = formatRelative(item.updatedAt);

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${item.title || 'Untitled'}, modified ${updatedLabel}`}
      className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent ${
        isActive ? 'bg-accent text-accent-foreground' : 'text-foreground'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{item.title || 'Untitled'}</span>
        <span className="shrink-0 text-xs text-foreground-muted">{updatedLabel}</span>
      </div>
      {item.preview && (
        <span className="line-clamp-1 text-xs text-foreground-secondary">{item.preview}</span>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-primary-muted/40 px-1.5 py-0 text-2xs text-primary"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-2xs text-foreground-muted">+{item.tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = new Date(iso).getTime() - Date.now();
  const diffMinutes = Math.round(diff / 60_000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NoteList({
  items,
  activeNoteId,
  onNoteClick,
  onReachEnd,
  emptyState,
  className,
}: NoteListProps) {
  const listRef = useRef<VirtualListHandle>(null);

  const renderItem = useCallback(
    (item: NoteListItem) => {
      if (item.isHeading) {
        return <HeadingRow item={item} />;
      }
      return <NoteRow item={item} isActive={item.id === activeNoteId} onClick={onNoteClick} />;
    },
    [activeNoteId, onNoteClick],
  );

  const getItemKey = useCallback((item: NoteListItem) => item.id, []);

  // Estimate size: headings are shorter, notes are taller
  const estimateSize = 60;

  return (
    <VirtualList<NoteListItem>
      ref={listRef}
      items={items}
      estimateSize={estimateSize}
      getItemKey={getItemKey}
      renderItem={renderItem}
      overscan={5}
      onReachEnd={onReachEnd}
      reachEndThreshold={200}
      className={className}
      aria-label="Notes"
      emptyState={
        emptyState ?? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-foreground-muted">No notes found</p>
          </div>
        )
      }
    />
  );
}
