'use client';

/**
 * DraggableTreeItem -- wrapper for file explorer tree items that adds
 * drag-and-drop capabilities for reordering and moving files/folders.
 *
 * Visual indicators:
 *   - Drop target highlighting (blue ring when hovering a valid target)
 *   - Insertion line between items (thin line above/below for before/after)
 *   - Folder expansion highlight (background change when dropping into folder)
 *   - Dragged item ghost opacity
 *
 * Uses HTML5 Drag and Drop API via the useDragAndDrop hook, which is
 * consistent with how the rest of the workspace DnD operates.
 *
 * @module features/workspace/components/DraggableTreeItem
 */

import { type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { useDragAndDropStore } from '../hooks/useDragAndDrop';
import type { ItemDragHandlers } from '../hooks/useDragAndDrop';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraggableTreeItemProps {
  /** Unique ID of the tree node. */
  nodeId: string;
  /** Whether this node is a folder. */
  isFolder: boolean;
  /** Nesting depth for indentation (0 = root). */
  depth: number;
  /** The tree row content to render inside the draggable wrapper. */
  children: ReactNode;
  /** Drag event handlers from useDragAndDrop.getItemDragHandlers(). */
  dragHandlers: ItemDragHandlers;
  /** Whether this node is currently selected. */
  isSelected?: boolean;
}

// ---------------------------------------------------------------------------
// Insertion line indicator
// ---------------------------------------------------------------------------

function InsertionLine({ position }: { position: 'before' | 'after' }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full bg-primary',
        position === 'before' ? '-top-px' : '-bottom-px',
      )}
      aria-hidden="true"
    >
      {/* Circle indicator at the left end of the line */}
      <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full border-2 border-primary bg-background" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DraggableTreeItem({
  nodeId,
  isFolder,
  depth,
  children,
  dragHandlers,
  isSelected = false,
}: DraggableTreeItemProps) {
  // Read drag state from the store
  const isDragging = useDragAndDropStore((s) => s.draggedNodeId === nodeId);
  const isDropTarget = useDragAndDropStore((s) => s.targetNodeId === nodeId);
  const dropPosition = useDragAndDropStore((s) =>
    s.targetNodeId === nodeId ? s.dropPosition : null,
  );
  const isAnyDragging = useDragAndDropStore((s) => s.isDragging);

  // Determine visual state
  const showInsertBefore = isDropTarget && dropPosition === 'before';
  const showInsertAfter = isDropTarget && dropPosition === 'after';
  const showFolderHighlight = isDropTarget && dropPosition === 'inside' && isFolder;

  return (
    <div
      className={cn(
        'relative transition-opacity',
        // Ghost effect on the dragged item
        isDragging && 'opacity-40',
        // Subtle dimming of non-target items during drag
        isAnyDragging && !isDragging && !isDropTarget && 'opacity-80',
      )}
      {...dragHandlers}
      data-tree-item-id={nodeId}
      data-is-folder={isFolder}
      data-depth={depth}
      aria-selected={isSelected}
    >
      {/* Insertion line: before */}
      {showInsertBefore && <InsertionLine position="before" />}

      {/* Main content wrapper with drop target highlight */}
      <div
        className={cn(
          'relative rounded-sm transition-colors',
          // Folder highlight when dropping inside
          showFolderHighlight && 'bg-primary/10 ring-1 ring-inset ring-primary/30',
          // Subtle highlight for before/after drops
          isDropTarget && !showFolderHighlight && 'bg-accent/50',
        )}
      >
        {children}
      </div>

      {/* Insertion line: after */}
      {showInsertAfter && <InsertionLine position="after" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DropZoneRoot — optional root-level drop zone for dropping items at the
// top level of the file tree (outside any folder).
// ---------------------------------------------------------------------------

export interface DropZoneRootProps {
  /** Children content (the file tree). */
  children: ReactNode;
  /** Called when a file is dropped at the root level. */
  onDropAtRoot?: (nodeId: string) => void;
  /** Additional CSS class. */
  className?: string;
}

export function DropZoneRoot({ children, onDropAtRoot, className }: DropZoneRootProps) {
  const isAnyDragging = useDragAndDropStore((s) => s.isDragging);

  function handleDragOver(e: React.DragEvent) {
    if (!isAnyDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('application/x-notesaner-node');
    if (nodeId) {
      useDragAndDropStore.getState().resetDragState();
      onDropAtRoot?.(nodeId);
    }
  }

  return (
    <div className={cn('relative', className)} onDragOver={handleDragOver} onDrop={handleDrop}>
      {children}

      {/* Bottom drop zone for moving items to root level */}
      {isAnyDragging && <div className="h-8 w-full" aria-hidden="true" />}
    </div>
  );
}
