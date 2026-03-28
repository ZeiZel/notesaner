'use client';

/**
 * FavoriteToggleButton — star icon button to toggle a note as favorite.
 *
 * Used in:
 *   - Note header toolbar
 *   - Note context menu
 *   - Anywhere a quick favorite toggle is needed
 *
 * Design:
 *   - No useEffect: state is derived from the favorites store.
 *   - Toggle is handled in the click event handler.
 *   - Server sync is fire-and-forget after each toggle.
 */

import { useCallback } from 'react';
import { Tooltip } from 'antd';
import { cn } from '@/shared/lib/utils';
import { useFavoritesStore, MAX_FAVORITES } from '@/shared/stores/favorites-store';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FavoriteToggleButtonProps {
  /** The note ID to toggle. */
  noteId: string;
  /** The note title (needed when adding to favorites). */
  title: string;
  /** The note file path (needed when adding to favorites). */
  path: string;
  /** Button size variant. */
  size?: 'sm' | 'md';
  /** Additional CSS classes. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function StarOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d="M8 1.25l1.75 3.55 3.92.57-2.84 2.77.67 3.9L8 10.18l-3.5 1.86.67-3.9L2.33 5.37l3.92-.57L8 1.25z" />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 1.25l1.75 3.55 3.92.57-2.84 2.77.67 3.9L8 10.18l-3.5 1.86.67-3.9L2.33 5.37l3.92-.57L8 1.25z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FavoriteToggleButton({
  noteId,
  title,
  path,
  size = 'md',
  className,
}: FavoriteToggleButtonProps) {
  const isFavorite = useFavoritesStore((s) => s.favorites.some((f) => f.noteId === noteId));
  const favoritesCount = useFavoritesStore((s) => s.favorites.length);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const syncToServer = useFavoritesStore((s) => s.syncToServer);
  const token = useAuthStore((s) => s.accessToken);

  const isFull = !isFavorite && favoritesCount >= MAX_FAVORITES;

  const handleClick = useCallback(() => {
    if (isFull) return;
    toggleFavorite(noteId, title, path);
    if (token) {
      syncToServer(token);
    }
  }, [noteId, title, path, isFull, toggleFavorite, syncToServer, token]);

  const sizeClasses = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const tooltipText = isFavorite
    ? 'Remove from favorites'
    : isFull
      ? `Favorites full (max ${MAX_FAVORITES})`
      : 'Add to favorites';

  return (
    <Tooltip title={tooltipText} placement="bottom">
      <button
        type="button"
        onClick={handleClick}
        disabled={isFull}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
        className={cn(
          'flex items-center justify-center rounded-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isFavorite
            ? 'text-warning hover:text-warning/80'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          isFull && !isFavorite && 'pointer-events-none opacity-40',
          sizeClasses,
          className,
        )}
      >
        {isFavorite ? (
          <StarFilledIcon className={iconSize} />
        ) : (
          <StarOutlineIcon className={iconSize} />
        )}
      </button>
    </Tooltip>
  );
}
