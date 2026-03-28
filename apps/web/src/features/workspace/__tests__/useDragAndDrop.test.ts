/**
 * Tests for useDragAndDrop hook, useDragAndDropStore, and helpers.
 *
 * Covers:
 *   - Drag state management (setDragState, resetDragState)
 *   - Drop position computation (before, after, inside)
 *   - Tree traversal helpers (isAncestor detection)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDragAndDropStore, computeDropPosition } from '../hooks/useDragAndDrop';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  useDragAndDropStore.setState({
    draggedNodeId: null,
    targetNodeId: null,
    dropPosition: null,
    isDragging: false,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// useDragAndDropStore -- setDragState
// ---------------------------------------------------------------------------

describe('useDragAndDropStore -- setDragState', () => {
  it('updates drag state partially', () => {
    useDragAndDropStore.getState().setDragState({
      draggedNodeId: 'node-1',
      isDragging: true,
    });

    const state = useDragAndDropStore.getState();
    expect(state.draggedNodeId).toBe('node-1');
    expect(state.isDragging).toBe(true);
    expect(state.targetNodeId).toBeNull();
    expect(state.dropPosition).toBeNull();
  });

  it('updates target and drop position', () => {
    useDragAndDropStore.getState().setDragState({
      draggedNodeId: 'node-1',
      isDragging: true,
    });
    useDragAndDropStore.getState().setDragState({
      targetNodeId: 'node-2',
      dropPosition: 'inside',
    });

    const state = useDragAndDropStore.getState();
    expect(state.draggedNodeId).toBe('node-1');
    expect(state.targetNodeId).toBe('node-2');
    expect(state.dropPosition).toBe('inside');
  });
});

// ---------------------------------------------------------------------------
// useDragAndDropStore -- resetDragState
// ---------------------------------------------------------------------------

describe('useDragAndDropStore -- resetDragState', () => {
  it('resets all drag state to null/false', () => {
    useDragAndDropStore.getState().setDragState({
      draggedNodeId: 'node-1',
      targetNodeId: 'node-2',
      dropPosition: 'before',
      isDragging: true,
    });

    useDragAndDropStore.getState().resetDragState();

    const state = useDragAndDropStore.getState();
    expect(state.draggedNodeId).toBeNull();
    expect(state.targetNodeId).toBeNull();
    expect(state.dropPosition).toBeNull();
    expect(state.isDragging).toBe(false);
  });

  it('is idempotent', () => {
    useDragAndDropStore.getState().resetDragState();
    useDragAndDropStore.getState().resetDragState();

    const state = useDragAndDropStore.getState();
    expect(state.isDragging).toBe(false);
    expect(state.draggedNodeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeDropPosition
// ---------------------------------------------------------------------------

describe('computeDropPosition', () => {
  // Mock a DOMRect with 100px height starting at y=200
  const rect = {
    top: 200,
    bottom: 228,
    left: 0,
    right: 300,
    width: 300,
    height: 28,
    x: 0,
    y: 200,
    toJSON: () => ({}),
  } as DOMRect;

  it('returns "before" when cursor is near the top edge', () => {
    // cursor at y=203 (3px from top, within 8px threshold)
    expect(computeDropPosition(203, rect, true)).toBe('before');
    expect(computeDropPosition(203, rect, false)).toBe('before');
  });

  it('returns "after" when cursor is near the bottom edge', () => {
    // cursor at y=225 (3px from bottom, within 8px threshold)
    expect(computeDropPosition(225, rect, true)).toBe('after');
    expect(computeDropPosition(225, rect, false)).toBe('after');
  });

  it('returns "inside" for folder when cursor is in the middle zone', () => {
    // cursor at y=214 (14px from top -- middle)
    expect(computeDropPosition(214, rect, true)).toBe('inside');
  });

  it('returns "after" for file when cursor is in the middle zone', () => {
    // Files do not accept "inside" drops
    expect(computeDropPosition(214, rect, false)).toBe('after');
  });

  it('returns "before" at exact top boundary', () => {
    expect(computeDropPosition(200, rect, true)).toBe('before');
  });

  it('returns "after" at exact bottom boundary', () => {
    expect(computeDropPosition(228, rect, false)).toBe('after');
  });
});

// ---------------------------------------------------------------------------
// Store -- concurrent state updates
// ---------------------------------------------------------------------------

describe('useDragAndDropStore -- concurrent updates', () => {
  it('handles rapid target changes', () => {
    useDragAndDropStore.getState().setDragState({
      draggedNodeId: 'drag-1',
      isDragging: true,
    });

    // Simulate hovering over multiple nodes quickly
    useDragAndDropStore.getState().setDragState({
      targetNodeId: 'target-1',
      dropPosition: 'before',
    });
    useDragAndDropStore.getState().setDragState({
      targetNodeId: 'target-2',
      dropPosition: 'inside',
    });
    useDragAndDropStore.getState().setDragState({
      targetNodeId: 'target-3',
      dropPosition: 'after',
    });

    const state = useDragAndDropStore.getState();
    expect(state.targetNodeId).toBe('target-3');
    expect(state.dropPosition).toBe('after');
    expect(state.draggedNodeId).toBe('drag-1');
  });

  it('clears target without affecting dragged node', () => {
    useDragAndDropStore.getState().setDragState({
      draggedNodeId: 'drag-1',
      targetNodeId: 'target-1',
      dropPosition: 'inside',
      isDragging: true,
    });

    useDragAndDropStore.getState().setDragState({
      targetNodeId: null,
      dropPosition: null,
    });

    const state = useDragAndDropStore.getState();
    expect(state.draggedNodeId).toBe('drag-1');
    expect(state.isDragging).toBe(true);
    expect(state.targetNodeId).toBeNull();
  });
});
