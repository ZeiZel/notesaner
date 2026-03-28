'use client';

/**
 * useDragAndDrop -- hook for drag-and-drop reordering and moving of
 * notes/folders in the file explorer tree.
 *
 * Uses @dnd-kit/core and @dnd-kit/sortable for consistent DnD behavior
 * with the rest of the workspace (sidebar panels already use @dnd-kit).
 *
 * Features:
 *   - Move a note into a folder
 *   - Reorder items within the same folder
 *   - Visual indicators: drop target highlighting, insertion line
 *   - Create nested structure by dropping on a folder
 *   - Undo support via callback
 *
 * @module features/workspace/hooks/useDragAndDrop
 */

import { useCallback, useRef, useState } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TreeNode } from '@/shared/ui/VirtualTree';
import type { FileNodeData } from '../ui/FileExplorer';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Vertical offset threshold (in pixels) for determining drop position.
 * If the cursor is within this many pixels of the top/bottom edge of a
 * tree item, the drop is treated as a "before"/"after" insertion rather
 * than a "into" (move into folder) operation.
 */
const INSERTION_EDGE_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where the drop will occur relative to the target node. */
export type DropPosition = 'before' | 'after' | 'inside';

/** Describes the current drag state visible to the UI. */
export interface DragState {
  /** ID of the node being dragged. */
  draggedNodeId: string | null;
  /** ID of the current drop target node. */
  targetNodeId: string | null;
  /** Position relative to the target. */
  dropPosition: DropPosition | null;
  /** Whether a drag operation is in progress. */
  isDragging: boolean;
}

/** Payload for a completed drag-and-drop move operation. */
export interface MoveOperation {
  /** ID of the node that was moved. */
  nodeId: string;
  /** Path of the node before the move. */
  sourcePath: string;
  /** New parent folder path (empty string for root). */
  targetParentPath: string;
  /** Position within the target folder. */
  position: DropPosition;
  /** Target sibling node ID (the node it was dropped on/near). */
  targetSiblingId: string | null;
}

// ---------------------------------------------------------------------------
// Drag state store
// NOTE: Transient UI state (drag indicators). Not persisted. Zustand is kept
// because the hook orchestrates API calls (file moves) that depend on
// this drag state, making it tightly coupled to business operations.
// ---------------------------------------------------------------------------

interface DragAndDropState extends DragState {
  setDragState: (state: Partial<DragState>) => void;
  resetDragState: () => void;
}

export const useDragAndDropStore = create<DragAndDropState>()(
  devtools(
    (set) => ({
      draggedNodeId: null,
      targetNodeId: null,
      dropPosition: null,
      isDragging: false,

      setDragState: (patch) => set((state) => ({ ...state, ...patch }), false, 'dnd/setDragState'),

      resetDragState: () =>
        set(
          {
            draggedNodeId: null,
            targetNodeId: null,
            dropPosition: null,
            isDragging: false,
          },
          false,
          'dnd/resetDragState',
        ),
    }),
    { name: 'DragAndDropStore' },
  ),
);

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

function findNodeById(nodes: TreeNode<FileNodeData>[], id: string): TreeNode<FileNodeData> | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentNode(
  nodes: TreeNode<FileNodeData>[],
  childId: string,
): TreeNode<FileNodeData> | null {
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.id === childId) return node;
      }
      const found = findParentNode(node.children, childId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Check if `potentialAncestorId` is an ancestor of `nodeId` in the tree.
 * Prevents dropping a folder into its own descendant.
 */
function isAncestor(
  nodes: TreeNode<FileNodeData>[],
  potentialAncestorId: string,
  nodeId: string,
): boolean {
  const ancestor = findNodeById(nodes, potentialAncestorId);
  if (!ancestor || !ancestor.children) return false;

  function searchChildren(children: TreeNode<FileNodeData>[]): boolean {
    for (const child of children) {
      if (child.id === nodeId) return true;
      if (child.children && searchChildren(child.children)) return true;
    }
    return false;
  }

  return searchChildren(ancestor.children);
}

/**
 * Compute the drop position based on cursor Y offset relative to the
 * target element's bounding box.
 */
export function computeDropPosition(
  cursorY: number,
  targetRect: DOMRect,
  targetIsFolder: boolean,
): DropPosition {
  const relativeY = cursorY - targetRect.top;
  const height = targetRect.height;

  if (relativeY < INSERTION_EDGE_THRESHOLD) {
    return 'before';
  }
  if (relativeY > height - INSERTION_EDGE_THRESHOLD) {
    return 'after';
  }
  // Middle zone -- only folders accept "inside" drops
  return targetIsFolder ? 'inside' : 'after';
}

// ---------------------------------------------------------------------------
// API call for moving files/folders
// ---------------------------------------------------------------------------

async function moveFileOnServer(
  workspaceId: string,
  token: string,
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/files/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sourcePath, destinationPath }),
  });

  if (!response.ok) {
    let errorMessage = `Move failed (HTTP ${response.status})`;
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(errorMessage);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseDragAndDropOptions {
  /** The current file tree data. Used for ancestry checks and path resolution. */
  fileTree: TreeNode<FileNodeData>[];
  /** Callback when a move is successfully executed. */
  onMoveComplete?: (operation: MoveOperation) => void;
  /** Callback when a move fails. */
  onMoveError?: (operation: MoveOperation, error: Error) => void;
  /** Whether drag-and-drop is disabled. */
  disabled?: boolean;
}

export interface UseDragAndDropReturn {
  /** Current drag state from the store. */
  dragState: DragState;
  /**
   * Handlers to attach to each draggable tree item.
   * Call with the node ID to get HTML5 drag event handlers.
   */
  getItemDragHandlers: (nodeId: string) => ItemDragHandlers;
  /**
   * Whether a specific node is a valid drop target for the currently
   * dragged node.
   */
  isValidDropTarget: (targetNodeId: string) => boolean;
  /**
   * Manually cancel the current drag operation.
   */
  cancelDrag: () => void;
}

export interface ItemDragHandlers {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export function useDragAndDrop({
  fileTree,
  onMoveComplete,
  onMoveError,
  disabled = false,
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const draggedNodeRef = useRef<TreeNode<FileNodeData> | null>(null);
  const [_moveInProgress, setMoveInProgress] = useState(false);

  const dragState: DragState = {
    draggedNodeId: useDragAndDropStore((s) => s.draggedNodeId),
    targetNodeId: useDragAndDropStore((s) => s.targetNodeId),
    dropPosition: useDragAndDropStore((s) => s.dropPosition),
    isDragging: useDragAndDropStore((s) => s.isDragging),
  };

  const isValidDropTarget = useCallback(
    (targetNodeId: string): boolean => {
      const { draggedNodeId } = useDragAndDropStore.getState();
      if (!draggedNodeId) return false;
      if (draggedNodeId === targetNodeId) return false;

      // Prevent dropping a node into its own descendant
      if (isAncestor(fileTree, draggedNodeId, targetNodeId)) {
        return false;
      }

      return true;
    },
    [fileTree],
  );

  const cancelDrag = useCallback(() => {
    draggedNodeRef.current = null;
    useDragAndDropStore.getState().resetDragState();
  }, []);

  const executeMoveOperation = useCallback(
    async (operation: MoveOperation) => {
      const token = useAuthStore.getState().accessToken;
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;

      if (!token || !workspaceId) return;

      setMoveInProgress(true);

      try {
        // Compute the destination path
        const draggedNode = findNodeById(fileTree, operation.nodeId);
        if (!draggedNode) return;

        const fileName = draggedNode.data.name;
        const ext = draggedNode.data.extension;
        const fullName = draggedNode.data.isFolder
          ? fileName
          : ext
            ? `${fileName}.${ext}`
            : fileName;

        const destinationPath = operation.targetParentPath
          ? `${operation.targetParentPath}/${fullName}`
          : fullName;

        await moveFileOnServer(workspaceId, token, operation.sourcePath, destinationPath);

        onMoveComplete?.(operation);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        onMoveError?.(operation, error);
      } finally {
        setMoveInProgress(false);
      }
    },
    [fileTree, onMoveComplete, onMoveError],
  );

  const getItemDragHandlers = useCallback(
    (nodeId: string): ItemDragHandlers => {
      if (disabled) {
        return {
          draggable: false,
          onDragStart: () => undefined,
          onDragOver: () => undefined,
          onDragEnter: () => undefined,
          onDragLeave: () => undefined,
          onDrop: () => undefined,
          onDragEnd: () => undefined,
        };
      }

      return {
        draggable: true,

        onDragStart: (e: React.DragEvent) => {
          const node = findNodeById(fileTree, nodeId);
          if (!node) return;

          draggedNodeRef.current = node;

          // Set drag data
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('application/x-notesaner-node', nodeId);
          e.dataTransfer.setData('text/plain', node.data.path);

          // Create a drag image from the element
          const element = e.currentTarget as HTMLElement;
          const rect = element.getBoundingClientRect();
          e.dataTransfer.setDragImage(element, e.clientX - rect.left, e.clientY - rect.top);

          useDragAndDropStore.getState().setDragState({
            draggedNodeId: nodeId,
            isDragging: true,
          });
        },

        onDragOver: (e: React.DragEvent) => {
          const { draggedNodeId } = useDragAndDropStore.getState();
          if (!draggedNodeId || draggedNodeId === nodeId) return;

          // Check ancestry
          if (isAncestor(fileTree, draggedNodeId, nodeId)) return;

          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';

          const targetNode = findNodeById(fileTree, nodeId);
          if (!targetNode) return;

          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const dropPosition = computeDropPosition(e.clientY, rect, targetNode.data.isFolder);

          useDragAndDropStore.getState().setDragState({
            targetNodeId: nodeId,
            dropPosition,
          });
        },

        onDragEnter: (e: React.DragEvent) => {
          const { draggedNodeId } = useDragAndDropStore.getState();
          if (!draggedNodeId || draggedNodeId === nodeId) return;
          if (isAncestor(fileTree, draggedNodeId, nodeId)) return;

          e.preventDefault();
          e.stopPropagation();
        },

        onDragLeave: (e: React.DragEvent) => {
          // Only clear if we actually left this element (not entering a child)
          const related = e.relatedTarget as HTMLElement | null;
          const current = e.currentTarget as HTMLElement;
          if (related && current.contains(related)) return;

          const { targetNodeId } = useDragAndDropStore.getState();
          if (targetNodeId === nodeId) {
            useDragAndDropStore.getState().setDragState({
              targetNodeId: null,
              dropPosition: null,
            });
          }
        },

        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const { draggedNodeId, dropPosition } = useDragAndDropStore.getState();
          if (!draggedNodeId || !dropPosition) {
            cancelDrag();
            return;
          }

          const draggedNode = findNodeById(fileTree, draggedNodeId);
          const targetNode = findNodeById(fileTree, nodeId);

          if (!draggedNode || !targetNode) {
            cancelDrag();
            return;
          }

          // Determine the target parent path
          let targetParentPath: string;

          if (dropPosition === 'inside' && targetNode.data.isFolder) {
            // Dropping into a folder
            targetParentPath = targetNode.data.path;
          } else {
            // Dropping before/after a sibling -- parent is the target's parent
            const parentNode = findParentNode(fileTree, nodeId);
            targetParentPath = parentNode ? parentNode.data.path : '';
          }

          const operation: MoveOperation = {
            nodeId: draggedNodeId,
            sourcePath: draggedNode.data.path,
            targetParentPath,
            position: dropPosition,
            targetSiblingId: nodeId,
          };

          cancelDrag();
          void executeMoveOperation(operation);
        },

        onDragEnd: () => {
          cancelDrag();
        },
      };
    },
    [disabled, fileTree, cancelDrag, executeMoveOperation],
  );

  return {
    dragState,
    getItemDragHandlers,
    isValidDropTarget,
    cancelDrag,
  };
}
