'use client';

/**
 * NoteActions — context menu for note-level operations.
 *
 * Renders a dropdown menu with actions: Duplicate, Copy to Folder, Move to Folder.
 * Opens a FolderPickerDialog for copy/move operations.
 *
 * Design:
 *   - No useEffect: all state is managed via event handlers.
 *   - Folder picker dialog is rendered inline, controlled by local state.
 *   - Integrates with useNoteActions hook for API calls.
 */

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import { useNoteActions } from '../hooks/useNoteActions';
import { FolderPickerDialog } from './FolderPickerDialog';
import type { NoteDto } from '@notesaner/contracts';
import { useFavoritesStore } from '@/shared/stores/favorites-store';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteActionsProps {
  note: NoteDto;
  workspaceId: string;
  /** Called when a note action succeeds. */
  onSuccess?: (note: NoteDto) => void;
  /** Called when a note action fails. */
  onError?: (error: unknown) => void;
  /** Additional CSS classes for the trigger button. */
  className?: string;
}

type FolderPickerMode = 'copy' | 'move' | null;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function DuplicateIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M1.5 3.25a2.25 2.25 0 013-2.122V1A2.25 2.25 0 016.75 3.25v.894l.57-.57a.75.75 0 011.06 1.06L6.56 6.456a.75.75 0 01-1.06 0L3.68 4.634a.75.75 0 011.06-1.06l.51.51V3.25a.75.75 0 00-1.5 0v.5a.75.75 0 01-1.5 0v-.5zM8.75 8A.75.75 0 009.5 7.25h4.75a.75.75 0 010 1.5H9.5A.75.75 0 018.75 8zm0 3a.75.75 0 01.75-.75h4.75a.75.75 0 010 1.5H9.5a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M8 1.25l1.75 3.55 3.92.57-2.84 2.77.67 3.9L8 10.18l-3.5 1.86.67-3.9L2.33 5.37l3.92-.57L8 1.25z" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 4.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 4.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Menu item
// ---------------------------------------------------------------------------

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function MenuItem({ icon, label, onClick, disabled, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors',
        'focus-visible:outline-none focus-visible:bg-accent',
        disabled && 'pointer-events-none opacity-40',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NoteActions({
  note,
  workspaceId,
  onSuccess,
  onError,
  className,
}: NoteActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderPickerMode, setFolderPickerMode] = useState<FolderPickerMode>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { duplicateNote, copyToFolder, moveToFolder, isPending } = useNoteActions(workspaceId, {
    onSuccess: (resultNote) => {
      setIsOpen(false);
      onSuccess?.(resultNote);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  const isFavorite = useFavoritesStore((s) => s.favorites.some((f) => f.noteId === note.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const syncFavoritesToServer = useFavoritesStore((s) => s.syncToServer);
  const token = useAuthStore((s) => s.accessToken);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleToggleFavorite = useCallback(() => {
    setIsOpen(false);
    toggleFavorite(note.id, note.title, note.path);
    if (token) {
      syncFavoritesToServer(token);
    }
  }, [note, toggleFavorite, syncFavoritesToServer, token]);

  const handleDuplicate = useCallback(() => {
    setIsOpen(false);
    duplicateNote(note);
  }, [duplicateNote, note]);

  const handleCopyToFolder = useCallback(() => {
    setIsOpen(false);
    setFolderPickerMode('copy');
  }, []);

  const handleMoveToFolder = useCallback(() => {
    setIsOpen(false);
    setFolderPickerMode('move');
  }, []);

  const handleFolderSelect = useCallback(
    (folderPath: string) => {
      if (folderPickerMode === 'copy') {
        copyToFolder(note, folderPath);
      } else if (folderPickerMode === 'move') {
        moveToFolder(note, folderPath);
      }
      setFolderPickerMode(null);
    },
    [folderPickerMode, copyToFolder, moveToFolder, note],
  );

  const handleFolderPickerClose = useCallback(() => {
    setFolderPickerMode(null);
  }, []);

  // Close menu when clicking outside
  const handleBackdropClick = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }, []);

  return (
    <>
      <div className="relative">
        {/* Trigger button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Note actions"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
        >
          <EllipsisIcon />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            {/* Invisible backdrop to close menu */}
            <div className="fixed inset-0 z-40" onClick={handleBackdropClick} aria-hidden="true" />

            <div
              ref={menuRef}
              role="menu"
              aria-label="Note actions menu"
              onKeyDown={handleMenuKeyDown}
              className={cn(
                'absolute right-0 top-full z-50 mt-1 w-48',
                'rounded-md border bg-popover p-1 shadow-md',
                'animate-in fade-in-0 zoom-in-95',
              )}
            >
              <MenuItem
                icon={<StarIcon />}
                label={isFavorite ? 'Unfavorite' : 'Add to favorites'}
                onClick={handleToggleFavorite}
              />
              <div className="my-1 h-px bg-border" role="separator" />
              <MenuItem
                icon={<DuplicateIcon />}
                label="Duplicate"
                onClick={handleDuplicate}
                disabled={isPending}
              />
              <MenuItem
                icon={<CopyIcon />}
                label="Copy to folder..."
                onClick={handleCopyToFolder}
                disabled={isPending}
              />
              <div className="my-1 h-px bg-border" role="separator" />
              <MenuItem
                icon={<MoveIcon />}
                label="Move to folder..."
                onClick={handleMoveToFolder}
                disabled={isPending}
              />
            </div>
          </>
        )}
      </div>

      {/* Folder picker dialog */}
      {folderPickerMode !== null && (
        <FolderPickerDialog
          workspaceId={workspaceId}
          title={folderPickerMode === 'copy' ? 'Copy to folder' : 'Move to folder'}
          confirmLabel={folderPickerMode === 'copy' ? 'Copy here' : 'Move here'}
          excludePath={note.path}
          onSelect={handleFolderSelect}
          onClose={handleFolderPickerClose}
        />
      )}
    </>
  );
}
