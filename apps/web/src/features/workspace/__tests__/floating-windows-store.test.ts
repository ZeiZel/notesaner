/**
 * Tests for floating-windows-store.ts
 *
 * Covers:
 *   - openWindow — creates a window with defaults, returns an ID
 *   - openWindow — uses provided position / size
 *   - openWindow — staggers default positions for multiple windows
 *   - closeWindow — removes the target window
 *   - closeWindow — no-op for unknown ID
 *   - updatePosition — updates position, clamps to viewport bounds
 *   - updatePosition — snaps to edges within threshold
 *   - updateSize — updates size, clamps to minimum dimensions
 *   - focusWindow — assigns highest z-index, increments nextZIndex
 *   - toggleMinimize — toggles isMinimized, clears isMaximized
 *   - toggleMaximize — toggles isMaximized, clears isMinimized
 *   - closeAllWindows — empties the windows array
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useFloatingWindowsStore,
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  SNAP_EDGE_THRESHOLD,
} from '../model/floating-windows-store';

// ---------------------------------------------------------------------------
// Suppress localStorage warnings from zustand persist in test environment
// ---------------------------------------------------------------------------

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  useFloatingWindowsStore.setState({ windows: [], nextZIndex: 100 });
}

function openTestWindow(title = 'Test Window', contentType = 'editor') {
  return useFloatingWindowsStore.getState().openWindow({ title, contentType });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// openWindow
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — openWindow', () => {
  it('adds a window to the list and returns a unique ID', () => {
    const id = openTestWindow();
    const { windows } = useFloatingWindowsStore.getState();

    expect(windows).toHaveLength(1);
    expect(windows[0]!.id).toBe(id);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('sets title and contentType from payload', () => {
    const id = openTestWindow('My Panel', 'outline');
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.title).toBe('My Panel');
    expect(win.contentType).toBe('outline');
  });

  it('uses DEFAULT_WINDOW_SIZE when no size is provided', () => {
    const id = openTestWindow();
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.size.width).toBe(DEFAULT_WINDOW_SIZE.width);
    expect(win.size.height).toBe(DEFAULT_WINDOW_SIZE.height);
  });

  it('uses provided size', () => {
    const id = useFloatingWindowsStore.getState().openWindow({
      title: 'Custom Size',
      contentType: 'editor',
      size: { width: 800, height: 500 },
    });
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.size.width).toBe(800);
    expect(win.size.height).toBe(500);
  });

  it('uses provided position', () => {
    const id = useFloatingWindowsStore.getState().openWindow({
      title: 'Positioned',
      contentType: 'editor',
      position: { x: 200, y: 150 },
    });
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.position.x).toBe(200);
    expect(win.position.y).toBe(150);
  });

  it('opens with isMinimized and isMaximized false', () => {
    const id = openTestWindow();
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.isMinimized).toBe(false);
    expect(win.isMaximized).toBe(false);
  });

  it('assigns an increasing z-index to each new window', () => {
    // Record zIndex of the first window
    const id1 = openTestWindow('A');
    const z1 = useFloatingWindowsStore.getState().windows.find((w) => w.id === id1)!.zIndex;

    const id2 = openTestWindow('B');
    const z2 = useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!.zIndex;

    expect(z2).toBeGreaterThan(z1);
  });

  it('staggers default positions for consecutive windows', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');
    const { windows } = useFloatingWindowsStore.getState();

    const w1 = windows.find((w) => w.id === id1)!;
    const w2 = windows.find((w) => w.id === id2)!;

    // Second window should have a different position than the first
    const samePos = w1.position.x === w2.position.x && w1.position.y === w2.position.y;
    expect(samePos).toBe(false);
  });

  it('forwards contentProps to the window', () => {
    const id = useFloatingWindowsStore.getState().openWindow({
      title: 'Props Test',
      contentType: 'editor',
      contentProps: { noteId: 'note-42' },
    });
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.contentProps).toEqual({ noteId: 'note-42' });
  });

  it('defaults contentProps to an empty object when not provided', () => {
    const id = openTestWindow();
    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;

    expect(win.contentProps).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// closeWindow
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — closeWindow', () => {
  it('removes the window with the given ID', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().closeWindow(id);

    expect(useFloatingWindowsStore.getState().windows).toHaveLength(0);
  });

  it('only removes the target window when multiple are open', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');
    const id3 = openTestWindow('C');

    useFloatingWindowsStore.getState().closeWindow(id2);

    const { windows } = useFloatingWindowsStore.getState();
    expect(windows).toHaveLength(2);
    expect(windows.find((w) => w.id === id1)).toBeDefined();
    expect(windows.find((w) => w.id === id2)).toBeUndefined();
    expect(windows.find((w) => w.id === id3)).toBeDefined();
  });

  it('is a no-op for an unknown ID', () => {
    openTestWindow();
    useFloatingWindowsStore.getState().closeWindow('nonexistent-id');

    expect(useFloatingWindowsStore.getState().windows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updatePosition
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — updatePosition', () => {
  it('updates the position of the target window', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updatePosition(id, { x: 300, y: 200 });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.position.x).toBe(300);
    expect(win.position.y).toBe(200);
  });

  it('does not modify other windows', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');

    // Record id2's position before moving id1
    const posBefore = {
      ...useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!.position,
    };

    useFloatingWindowsStore.getState().updatePosition(id1, { x: 500, y: 300 });

    const win2 = useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!;
    expect(win2.position.x).toBe(posBefore.x);
    expect(win2.position.y).toBe(posBefore.y);
  });

  it('clamps y to >= 0 (prevents title bar going off-screen above)', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updatePosition(id, { x: 200, y: -100 });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.position.y).toBeGreaterThanOrEqual(0);
  });

  it('snaps x to 0 when within threshold of left edge', () => {
    const id = openTestWindow();
    // Position within snap threshold of left edge
    useFloatingWindowsStore.getState().updatePosition(id, {
      x: SNAP_EDGE_THRESHOLD - 1,
      y: 100,
    });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.position.x).toBe(0);
  });

  it('snaps y to 0 when within threshold of top edge', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updatePosition(id, {
      x: 100,
      y: SNAP_EDGE_THRESHOLD - 1,
    });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.position.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateSize
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — updateSize', () => {
  it('updates the size of the target window', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updateSize(id, { width: 900, height: 600 });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.size.width).toBe(900);
    expect(win.size.height).toBe(600);
  });

  it('clamps width to MIN_WINDOW_WIDTH', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updateSize(id, { width: 10, height: 400 });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.size.width).toBe(MIN_WINDOW_WIDTH);
  });

  it('clamps height to MIN_WINDOW_HEIGHT', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().updateSize(id, { width: 400, height: 10 });

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.size.height).toBe(MIN_WINDOW_HEIGHT);
  });

  it('does not modify other windows', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');

    // Record id2's size before resizing id1
    const sizeBefore = {
      ...useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!.size,
    };

    useFloatingWindowsStore.getState().updateSize(id1, { width: 999, height: 999 });

    const win2 = useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!;
    expect(win2.size.width).toBe(sizeBefore.width);
    expect(win2.size.height).toBe(sizeBefore.height);
  });
});

// ---------------------------------------------------------------------------
// focusWindow
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — focusWindow', () => {
  it('gives the focused window the highest z-index among all windows', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');
    const id3 = openTestWindow('C');

    // Focus the first window (it currently has the lowest z-index)
    useFloatingWindowsStore.getState().focusWindow(id1);

    const { windows } = useFloatingWindowsStore.getState();
    const w1 = windows.find((w) => w.id === id1)!;
    const w2 = windows.find((w) => w.id === id2)!;
    const w3 = windows.find((w) => w.id === id3)!;

    expect(w1.zIndex).toBeGreaterThan(w2.zIndex);
    expect(w1.zIndex).toBeGreaterThan(w3.zIndex);
  });

  it('increments nextZIndex after focusing', () => {
    const id = openTestWindow();
    const beforeFocus = useFloatingWindowsStore.getState().nextZIndex;

    useFloatingWindowsStore.getState().focusWindow(id);

    const afterFocus = useFloatingWindowsStore.getState().nextZIndex;
    expect(afterFocus).toBeGreaterThan(beforeFocus);
  });

  it('does not change z-indexes of windows that were not focused', () => {
    const id1 = openTestWindow('A');
    const id2 = openTestWindow('B');

    // Snapshot z-index of id2 before we focus id1.
    // Note: openWindow increments nextZIndex, so id1.zIndex < id2.zIndex.
    const zBefore = useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!.zIndex;

    // Focus id1 — only id1's zIndex should change.
    useFloatingWindowsStore.getState().focusWindow(id1);

    const zAfter = useFloatingWindowsStore.getState().windows.find((w) => w.id === id2)!.zIndex;
    // id2's z-index must not change when id1 is focused
    expect(zAfter).toBe(zBefore);
  });
});

// ---------------------------------------------------------------------------
// toggleMinimize
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — toggleMinimize', () => {
  it('sets isMinimized to true on first call', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().toggleMinimize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMinimized).toBe(true);
  });

  it('sets isMinimized back to false on second call', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().toggleMinimize(id);
    useFloatingWindowsStore.getState().toggleMinimize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMinimized).toBe(false);
  });

  it('clears isMaximized when minimizing', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.setState({
      windows: useFloatingWindowsStore
        .getState()
        .windows.map((w) => (w.id === id ? { ...w, isMaximized: true } : w)),
    });

    useFloatingWindowsStore.getState().toggleMinimize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMaximized).toBe(false);
    expect(win.isMinimized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleMaximize
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — toggleMaximize', () => {
  it('sets isMaximized to true on first call', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().toggleMaximize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMaximized).toBe(true);
  });

  it('sets isMaximized back to false on second call', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.getState().toggleMaximize(id);
    useFloatingWindowsStore.getState().toggleMaximize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMaximized).toBe(false);
  });

  it('clears isMinimized when maximizing', () => {
    const id = openTestWindow();
    useFloatingWindowsStore.setState({
      windows: useFloatingWindowsStore
        .getState()
        .windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
    });

    useFloatingWindowsStore.getState().toggleMaximize(id);

    const win = useFloatingWindowsStore.getState().windows.find((w) => w.id === id)!;
    expect(win.isMinimized).toBe(false);
    expect(win.isMaximized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// closeAllWindows
// ---------------------------------------------------------------------------

describe('useFloatingWindowsStore — closeAllWindows', () => {
  it('removes all windows', () => {
    openTestWindow('A');
    openTestWindow('B');
    openTestWindow('C');

    useFloatingWindowsStore.getState().closeAllWindows();

    expect(useFloatingWindowsStore.getState().windows).toHaveLength(0);
  });

  it('is a no-op when there are no windows open', () => {
    useFloatingWindowsStore.getState().closeAllWindows();

    expect(useFloatingWindowsStore.getState().windows).toHaveLength(0);
  });
});
