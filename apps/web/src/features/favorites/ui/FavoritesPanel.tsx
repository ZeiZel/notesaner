'use client';

/**
 * FavoritesPanel — sidebar panel content for favorites and recently opened notes.
 *
 * Renders:
 *   1. Favorites section: drag-to-reorder list of starred notes
 *   2. Recently Opened section: collapsible, auto-populated list
 *
 * Design:
 *   - No useEffect for data: state is read from Zustand stores.
 *   - Drag-to-reorder uses @dnd-kit (already in the project for sidebar panels).
 *   - Right-click context menu for "Unfavorite" action.
 *   - Note title, truncated folder path, and relative time displayed.
 */

import { useCallback, useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip } from 'antd';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime, truncate } from '@/shared/lib/utils';
import { useFavoritesStore, type FavoriteEntry } from '@/shared/stores/favorites-store';
import { useRecentStore, type RecentNoteEntry } from '@/shared/stores/recent-store';
import { useTabStore } from '@/shared/stores/tab-store';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function StarFilledIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0 text-warning"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 1.25l1.75 3.55 3.92.57-2.84 2.77.67 3.9L8 10.18l-3.5 1.86.67-3.9L2.33 5.37l3.92-.57L8 1.25z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0 text-sidebar-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 3.5a.5.5 0 00-1 0V8a.5.5 0 00.252.434l2.5 1.5a.5.5 0 00.496-.868L8 7.71V3.5z" />
      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn(
        'h-3 w-3 shrink-0 text-sidebar-muted transition-transform duration-fast',
        expanded ? 'rotate-90' : '',
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-2.5 w-2.5 text-sidebar-muted/40"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="11" cy="12" r="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract folder path from a full file path, truncated. */
function getFolderPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 1) return '';
  const folder = parts.slice(0, -1).join('/');
  return truncate(folder, 30);
}

// ---------------------------------------------------------------------------
// SortableFavoriteItem — individual draggable favorite row
// ---------------------------------------------------------------------------

interface SortableFavoriteItemProps {
  entry: FavoriteEntry;
  onOpen: (noteId: string, title: string, path: string) => void;
  onRemove: (noteId: string) => void;
}

function SortableFavoriteItem({ entry, onOpen, onRemove }: SortableFavoriteItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.noteId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleUnfavorite = useCallback(() => {
    setShowContextMenu(false);
    onRemove(entry.noteId);
  }, [entry.noteId, onRemove]);

  const handleClick = useCallback(() => {
    onOpen(entry.noteId, entry.title, entry.path);
  }, [entry, onOpen]);

  const folderPath = getFolderPath(entry.path);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-1 rounded-sm px-1 py-1 transition-colors',
          'hover:bg-sidebar-accent',
          isDragging && 'opacity-50',
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="flex h-4 w-3 cursor-grab items-center justify-center opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>

        {/* Star icon */}
        <StarFilledIcon />

        {/* Content — clickable to open */}
        <button
          type="button"
          onClick={handleClick}
          className="flex min-w-0 flex-1 flex-col gap-0 text-left"
        >
          <span className="truncate text-xs text-sidebar-foreground">{entry.title}</span>
          {folderPath && (
            <span className="truncate text-[10px] text-sidebar-muted">{folderPath}</span>
          )}
        </button>

        {/* Remove button (hover) */}
        <Tooltip title="Remove from favorites" placement="right">
          <button
            type="button"
            onClick={() => onRemove(entry.noteId)}
            aria-label="Remove from favorites"
            className="flex h-4 w-4 items-center justify-center rounded-sm text-sidebar-muted opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="fixed z-50 w-40 rounded-md border bg-popover p-1 shadow-md"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleUnfavorite}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 1.25l1.75 3.55 3.92.57-2.84 2.77.67 3.9L8 10.18l-3.5 1.86.67-3.9L2.33 5.37l3.92-.57L8 1.25z" />
              </svg>
              Unfavorite
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RecentNoteItem — simple row for recently opened notes
// ---------------------------------------------------------------------------

interface RecentNoteItemProps {
  entry: RecentNoteEntry;
  onOpen: (noteId: string, title: string, path: string) => void;
}

function RecentNoteItem({ entry, onOpen }: RecentNoteItemProps) {
  const handleClick = useCallback(() => {
    onOpen(entry.noteId, entry.title, entry.path);
  }, [entry, onOpen]);

  const folderPath = getFolderPath(entry.path);
  const timeAgo = formatRelativeTime(entry.openedAt);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full items-center gap-1.5 rounded-sm px-1 py-1 text-left transition-colors hover:bg-sidebar-accent"
    >
      <ClockIcon />
      <div className="flex min-w-0 flex-1 flex-col gap-0">
        <span className="truncate text-xs text-sidebar-foreground">{entry.title}</span>
        <div className="flex items-center gap-1.5">
          {folderPath && (
            <span className="truncate text-[10px] text-sidebar-muted">{folderPath}</span>
          )}
          <span className="shrink-0 text-[10px] text-sidebar-muted/70">{timeAgo}</span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FavoritesPanel() {
  const favorites = useFavoritesStore((s) => s.favorites);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const reorderFavorite = useFavoritesStore((s) => s.reorderFavorite);
  const syncToServer = useFavoritesStore((s) => s.syncToServer);
  const recentNotes = useRecentStore((s) => s.recentNotes);
  const openTab = useTabStore((s) => s.openTab);
  const token = useAuthStore((s) => s.accessToken);

  const [recentExpanded, setRecentExpanded] = useState(true);

  // DnD sensors for reordering favorites
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const favoriteIds = useMemo(() => favorites.map((f) => f.noteId), [favorites]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = favorites.findIndex((f) => f.noteId === String(active.id));
      const toIndex = favorites.findIndex((f) => f.noteId === String(over.id));

      if (fromIndex >= 0 && toIndex >= 0) {
        reorderFavorite(fromIndex, toIndex);
        if (token) {
          syncToServer(token);
        }
      }
    },
    [favorites, reorderFavorite, syncToServer, token],
  );

  const handleOpenNote = useCallback(
    (noteId: string, title: string, path: string) => {
      openTab({ noteId, title, path });
    },
    [openTab],
  );

  const handleRemoveFavorite = useCallback(
    (noteId: string) => {
      removeFavorite(noteId);
      if (token) {
        syncToServer(token);
      }
    },
    [removeFavorite, syncToServer, token],
  );

  const hasFavorites = favorites.length > 0;
  const hasRecent = recentNotes.length > 0;

  return (
    <div className="space-y-3">
      {/* --- Favorites section --- */}
      <div>
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Favorites
          </span>
          {hasFavorites && (
            <span className="text-[10px] text-sidebar-muted/70">{favorites.length}</span>
          )}
        </div>

        {hasFavorites ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={favoriteIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5" role="list" aria-label="Favorite notes">
                {favorites.map((entry) => (
                  <SortableFavoriteItem
                    key={entry.noteId}
                    entry={entry}
                    onOpen={handleOpenNote}
                    onRemove={handleRemoveFavorite}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="px-1 py-3 text-center">
            <p className="text-[10px] text-sidebar-muted">
              No favorites yet. Star a note to pin it here.
            </p>
          </div>
        )}
      </div>

      {/* --- Recently Opened section --- */}
      <div>
        <button
          type="button"
          onClick={() => setRecentExpanded((prev) => !prev)}
          className="mb-1 flex w-full items-center gap-1 px-1 text-left"
          aria-expanded={recentExpanded}
        >
          <ChevronIcon expanded={recentExpanded} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Recently Opened
          </span>
          {hasRecent && (
            <span className="ml-auto text-[10px] text-sidebar-muted/70">{recentNotes.length}</span>
          )}
        </button>

        {recentExpanded &&
          (hasRecent ? (
            <div className="space-y-0.5" role="list" aria-label="Recently opened notes">
              {recentNotes.map((entry) => (
                <RecentNoteItem key={entry.noteId} entry={entry} onOpen={handleOpenNote} />
              ))}
            </div>
          ) : (
            <div className="px-1 py-3 text-center">
              <p className="text-[10px] text-sidebar-muted">No recently opened notes.</p>
            </div>
          ))}
      </div>
    </div>
  );
}
