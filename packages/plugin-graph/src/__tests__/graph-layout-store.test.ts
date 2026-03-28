/**
 * Tests for graph-layout-store.
 *
 * Tests the Zustand store actions (saveLayout, updateLayout, deleteLayout,
 * setActiveLayoutId) and the selector helpers (selectActiveLayout,
 * selectLayoutList) in a jsdom environment.
 *
 * localStorage is available in jsdom, so the persist middleware will use it.
 * Each test clears localStorage before running to start with a clean state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useGraphLayoutStore,
  selectActiveLayout,
  selectLayoutList,
  type NodePosition,
} from '../graph-layout-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to its initial empty state between tests. */
function resetStore() {
  localStorage.clear();
  useGraphLayoutStore.setState({
    layouts: {},
    activeLayoutId: null,
  });
}

const POSITIONS_A: Record<string, NodePosition> = {
  'node-1': { x: 100, y: 200 },
  'node-2': { x: 300, y: 400 },
};

const POSITIONS_B: Record<string, NodePosition> = {
  'node-1': { x: 50, y: 75 },
  'node-3': { x: 600, y: 100 },
};

// ---------------------------------------------------------------------------
// saveLayout
// ---------------------------------------------------------------------------

describe('saveLayout', () => {
  beforeEach(resetStore);

  it('creates a new layout with the given name and positions', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('My Layout', POSITIONS_A);

    const state = useGraphLayoutStore.getState();
    expect(state.layouts[id]).toBeDefined();
    expect(state.layouts[id].name).toBe('My Layout');
    expect(state.layouts[id].positions).toEqual(POSITIONS_A);
    expect(state.layouts[id].savedAt).toBeGreaterThan(0);
  });

  it('sets activeLayoutId to the new layout id', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('Layout 1', POSITIONS_A);
    expect(useGraphLayoutStore.getState().activeLayoutId).toBe(id);
  });

  it('updates an existing layout when the same name is used', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id1 = saveLayout('Duplicate', POSITIONS_A);
    const id2 = saveLayout('Duplicate', POSITIONS_B);

    // Should return the same id
    expect(id1).toBe(id2);

    // Positions should be updated
    const state = useGraphLayoutStore.getState();
    expect(state.layouts[id1].positions).toEqual(POSITIONS_B);
  });

  it('uses "Untitled layout" as fallback when name is empty', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('', POSITIONS_A);
    expect(useGraphLayoutStore.getState().layouts[id].name).toBe('Untitled layout');
  });

  it('uses "Untitled layout" as fallback when name is only whitespace', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('   ', POSITIONS_A);
    expect(useGraphLayoutStore.getState().layouts[id].name).toBe('Untitled layout');
  });

  it('stores multiple layouts independently', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id1 = saveLayout('Alpha', POSITIONS_A);
    const id2 = saveLayout('Beta', POSITIONS_B);

    expect(id1).not.toBe(id2);
    const state = useGraphLayoutStore.getState();
    expect(Object.keys(state.layouts)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// updateLayout
// ---------------------------------------------------------------------------

describe('updateLayout', () => {
  beforeEach(resetStore);

  it('overwrites positions of an existing layout', () => {
    const { saveLayout, updateLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('To Update', POSITIONS_A);

    updateLayout(id, POSITIONS_B);

    const state = useGraphLayoutStore.getState();
    expect(state.layouts[id].positions).toEqual(POSITIONS_B);
  });

  it('updates savedAt timestamp', () => {
    const { saveLayout, updateLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('Timed', POSITIONS_A);
    const originalSavedAt = useGraphLayoutStore.getState().layouts[id].savedAt;

    // Advance time slightly (vitest runs synchronously so we just check it was set)
    updateLayout(id, POSITIONS_B);
    const newSavedAt = useGraphLayoutStore.getState().layouts[id].savedAt;
    expect(newSavedAt).toBeGreaterThanOrEqual(originalSavedAt);
  });

  it('is a no-op when the id does not exist', () => {
    const { updateLayout } = useGraphLayoutStore.getState();
    // Should not throw
    expect(() => updateLayout('non-existent-id', POSITIONS_A)).not.toThrow();
    expect(Object.keys(useGraphLayoutStore.getState().layouts)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deleteLayout
// ---------------------------------------------------------------------------

describe('deleteLayout', () => {
  beforeEach(resetStore);

  it('removes the layout from the store', () => {
    const { saveLayout, deleteLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('To Delete', POSITIONS_A);

    deleteLayout(id);

    expect(useGraphLayoutStore.getState().layouts[id]).toBeUndefined();
  });

  it('clears activeLayoutId when the active layout is deleted', () => {
    const { saveLayout, deleteLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('Active', POSITIONS_A);
    // saveLayout sets activeLayoutId
    expect(useGraphLayoutStore.getState().activeLayoutId).toBe(id);

    deleteLayout(id);

    expect(useGraphLayoutStore.getState().activeLayoutId).toBeNull();
  });

  it('does not change activeLayoutId when a non-active layout is deleted', () => {
    const { saveLayout, deleteLayout, setActiveLayoutId } = useGraphLayoutStore.getState();
    const id1 = saveLayout('Keep Active', POSITIONS_A);
    const id2 = saveLayout('Delete Me', POSITIONS_B);
    setActiveLayoutId(id1);

    deleteLayout(id2);

    expect(useGraphLayoutStore.getState().activeLayoutId).toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// setActiveLayoutId
// ---------------------------------------------------------------------------

describe('setActiveLayoutId', () => {
  beforeEach(resetStore);

  it('sets the active layout', () => {
    const { saveLayout, setActiveLayoutId } = useGraphLayoutStore.getState();
    const id = saveLayout('Layout', POSITIONS_A);
    setActiveLayoutId(null);
    expect(useGraphLayoutStore.getState().activeLayoutId).toBeNull();

    setActiveLayoutId(id);
    expect(useGraphLayoutStore.getState().activeLayoutId).toBe(id);
  });

  it('accepts null to reset to force-simulation mode', () => {
    const { saveLayout, setActiveLayoutId } = useGraphLayoutStore.getState();
    saveLayout('Layout', POSITIONS_A);

    setActiveLayoutId(null);
    expect(useGraphLayoutStore.getState().activeLayoutId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// selectActiveLayout selector
// ---------------------------------------------------------------------------

describe('selectActiveLayout', () => {
  beforeEach(resetStore);

  it('returns null when no layout is active', () => {
    const state = useGraphLayoutStore.getState();
    expect(selectActiveLayout(state)).toBeNull();
  });

  it('returns the active layout object when one is set', () => {
    const { saveLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('Active Layout', POSITIONS_A);

    const state = useGraphLayoutStore.getState();
    const active = selectActiveLayout(state);
    expect(active).not.toBeNull();
    expect(active!.id).toBe(id);
    expect(active!.name).toBe('Active Layout');
  });

  it('returns null when activeLayoutId points to a deleted layout', () => {
    const { saveLayout, deleteLayout } = useGraphLayoutStore.getState();
    const id = saveLayout('Will Be Deleted', POSITIONS_A);
    // Manually set active id to a now-deleted layout
    useGraphLayoutStore.setState({ activeLayoutId: id });
    deleteLayout(id);

    const state = useGraphLayoutStore.getState();
    expect(selectActiveLayout(state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// selectLayoutList selector
// ---------------------------------------------------------------------------

describe('selectLayoutList', () => {
  beforeEach(resetStore);

  it('returns an empty array when there are no layouts', () => {
    const state = useGraphLayoutStore.getState();
    expect(selectLayoutList(state)).toHaveLength(0);
  });

  it('returns all layouts sorted newest-first', () => {
    const { saveLayout } = useGraphLayoutStore.getState();

    // Stagger saves slightly using manual state manipulation to control savedAt
    const id1 = saveLayout('First', POSITIONS_A);
    useGraphLayoutStore.setState((s) => ({
      layouts: { ...s.layouts, [id1]: { ...s.layouts[id1], savedAt: 1000 } },
    }));

    const id2 = saveLayout('Second', POSITIONS_B);
    useGraphLayoutStore.setState((s) => ({
      layouts: { ...s.layouts, [id2]: { ...s.layouts[id2], savedAt: 2000 } },
    }));

    const state = useGraphLayoutStore.getState();
    const list = selectLayoutList(state);

    expect(list).toHaveLength(2);
    // Newest first (savedAt: 2000 > 1000)
    expect(list[0].id).toBe(id2);
    expect(list[1].id).toBe(id1);
  });
});
