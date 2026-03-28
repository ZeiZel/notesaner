'use client';

/**
 * LinkTypeContextMenu
 *
 * A context menu that appears on right-click of a wiki link node in the editor,
 * allowing the user to set or clear the Zettelkasten relationship type.
 *
 * Usage:
 *   Wrap the editor's wiki link node with this component. The menu is activated
 *   on right-click (contextmenu event) on any element with `data-wiki-link` or
 *   `data-node-view-wrapper` containing a wiki link.
 *
 *   More typically, you would trigger this programmatically from the editor's
 *   event handlers when the user right-clicks on a wikiLink node.
 *
 * Props:
 *   - editor: the TipTap Editor instance
 *   - workspaceId: current workspace for loading available types
 *   - onClose: called when the menu is dismissed
 *   - position: { x, y } screen coordinates for menu placement
 *
 * The component fetches available relationship types from the API and renders
 * a type picker. Selecting a type calls:
 *   1. editor.commands.setWikiLinkType(slug) — updates the in-editor node
 *   2. The TypedWikiLink extension's onSetRelationshipType callback
 *      (which should call PATCH /workspaces/:wid/note-links/:lid/type on the API)
 *
 * Visual distinction:
 *   Each type is shown with its color swatch. The selected type has a checkmark.
 *   "No type" is always available to clear the annotation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Editor } from '@tiptap/core';
import { useAuthStore } from '@/shared/stores/auth-store';
import { apiClient } from '@/shared/api/client';
import { BUILT_IN_RELATIONSHIP_TYPES, type RelationshipTypeDef } from '@notesaner/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A link relationship type as returned by the backend API.
 * Mirrors LinkRelationshipTypeDto from the server.
 */
interface LinkRelationshipTypeDto {
  id: string;
  workspaceId: string | null;
  slug: string;
  label: string;
  color: string;
  description: string | null;
  isBuiltIn: boolean;
}

export interface LinkTypeContextMenuProps {
  editor: Editor;
  workspaceId: string;
  /** Current relationship type slug set on the selected wiki link node, if any. */
  currentTypeSlug: string | null;
  /** Screen coordinates for positioning the menu. */
  position: { x: number; y: number };
  /** Called after the menu is closed (by selection or dismiss). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// API fetcher
// ---------------------------------------------------------------------------

async function fetchLinkTypes(
  token: string,
  workspaceId: string,
): Promise<LinkRelationshipTypeDto[]> {
  return apiClient.get<LinkRelationshipTypeDto[]>(`/api/workspaces/${workspaceId}/link-types`, {
    token,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOutside();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, onOutside]);
}

/**
 * Adjusts the menu position to stay within the viewport.
 */
function clampToViewport(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: x + menuWidth > vw ? Math.max(0, x - menuWidth) : x,
    y: y + menuHeight > vh ? Math.max(0, y - menuHeight) : y,
  };
}

// ---------------------------------------------------------------------------
// Type option row
// ---------------------------------------------------------------------------

interface TypeOptionProps {
  label: string;
  color: string;
  description: string | null;
  isSelected: boolean;
  isNone?: boolean;
  onClick: () => void;
}

function TypeOption({
  label,
  color,
  description,
  isSelected,
  isNone = false,
  onClick,
}: TypeOptionProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-checked={isSelected}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-fast hover:bg-background-hover focus:bg-background-hover focus:outline-none"
    >
      {/* Color swatch or empty slot for "No type" */}
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: isNone ? 'transparent' : color }}
        aria-hidden="true"
      />

      {/* Label + optional description */}
      <span className="flex flex-1 flex-col">
        <span className="font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-2xs text-foreground-muted leading-snug">{description}</span>
        )}
      </span>

      {/* Selected checkmark */}
      {isSelected && (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="shrink-0 text-primary"
          aria-label="Selected"
        >
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LinkTypeContextMenu({
  editor,
  workspaceId,
  currentTypeSlug,
  position,
  onClose,
}: LinkTypeContextMenuProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  // Close on outside click or Escape
  useOutsideClick(menuRef, onClose);

  // Adjust position after render (once we know menu dimensions)
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setAdjustedPos(clampToViewport(position.x, position.y, rect.width, rect.height));
  }, [position]);

  // Fetch available relationship types
  const {
    data: linkTypes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['link-types', workspaceId],
    queryFn: () => fetchLinkTypes(accessToken ?? '', workspaceId),
    enabled: !!accessToken && !!workspaceId,
    staleTime: 5 * 60_000, // 5 minutes — types rarely change
  });

  // Use API types when available, fall back to built-in constants
  const availableTypes: RelationshipTypeDef[] =
    linkTypes?.map((t) => ({
      slug: t.slug,
      label: t.label,
      color: t.color,
      description: t.description ?? '',
    })) ?? BUILT_IN_RELATIONSHIP_TYPES.map((t) => ({ ...t }));

  const handleSelectType = useCallback(
    (slug: string | null) => {
      // Update the in-editor node attribute
      editor.commands.setWikiLinkType(slug);
      onClose();
    },
    [editor, onClose],
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Set link relationship type"
      className="fixed z-[var(--ns-z-dropdown)] min-w-[14rem] w-max rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {/* Menu header */}
      <div
        role="presentation"
        className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-muted"
      >
        Link relationship type
      </div>

      <div role="separator" className="-mx-1 my-1 h-px bg-border" />

      {/* "No type" option — clears the annotation */}
      <TypeOption
        label="No type"
        color="transparent"
        description={null}
        isSelected={currentTypeSlug === null}
        isNone
        onClick={() => handleSelectType(null)}
      />

      <div role="separator" className="-mx-1 my-1 h-px bg-border" />

      {/* Type list */}
      {isLoading && (
        <div className="flex items-center justify-center py-3">
          <div
            className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary"
            aria-label="Loading types"
          />
        </div>
      )}

      {isError && <p className="px-2 py-1.5 text-xs text-destructive">Failed to load types</p>}

      {!isLoading && !isError && (
        <div className="max-h-[18rem] overflow-y-auto">
          {availableTypes.map((type) => (
            <TypeOption
              key={type.slug}
              label={type.label}
              color={type.color}
              description={type.description ?? null}
              isSelected={currentTypeSlug === type.slug}
              onClick={() => handleSelectType(type.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

LinkTypeContextMenu.displayName = 'LinkTypeContextMenu';
