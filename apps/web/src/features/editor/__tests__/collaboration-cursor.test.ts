/**
 * @vitest-environment jsdom
 *
 * Unit tests for the collaboration cursor extension configuration.
 *
 * Tests the pure logic functions exported by collaboration-cursor.ts:
 *   - createCollaborationCursor() factory (returns a configured extension)
 *   - createCursorActivityTracker() (throttled awareness updater)
 *   - cleanupCollaborationCursors() (timer cleanup)
 *   - Cursor render function (DOM element creation)
 *   - Selection render function (decoration attributes)
 *
 * Uses jsdom environment because the render functions create DOM elements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createCollaborationCursor,
  createCursorActivityTracker,
  cleanupCollaborationCursors,
  type CollaborationUser,
} from '../lib/collaboration-cursor';

// ---------------------------------------------------------------------------
// Mock: @tiptap/extension-collaboration-cursor
// ---------------------------------------------------------------------------

// We mock the TipTap extension to avoid ProseMirror DOM dependency.
// We capture the configure() call to verify the options passed to it.
let lastConfigureOptions: Record<string, unknown> | null = null;

vi.mock('@tiptap/extension-collaboration-cursor', () => {
  return {
    default: {
      configure: (options: Record<string, unknown>) => {
        lastConfigureOptions = options;
        return { name: 'collaborationCursor', options };
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Mock: Awareness
// ---------------------------------------------------------------------------

interface MockAwareness {
  clientID: number;
  states: Map<number, Record<string, unknown>>;
  localState: Record<string, unknown> | null;
  listeners: Map<string, Array<(...args: unknown[]) => void>>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  getStates: () => Map<number, Record<string, unknown>>;
  getLocalState: () => Record<string, unknown> | null;
  setLocalState: (state: Record<string, unknown> | null) => void;
  setLocalStateField: (field: string, value: unknown) => void;
}

function createMockAwareness(clientID = 1): MockAwareness {
  const states = new Map<number, Record<string, unknown>>();
  let localState: Record<string, unknown> | null = {};
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    clientID,
    states,
    localState,
    listeners,
    on(event: string, handler: (...args: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      listeners.set(
        event,
        existing.filter((h) => h !== handler),
      );
    },
    getStates() {
      return states;
    },
    getLocalState() {
      return localState;
    },
    setLocalState(state: Record<string, unknown> | null) {
      localState = state;
    },
    setLocalStateField(field: string, value: unknown) {
      if (!localState) localState = {};
      localState[field] = value;
    },
  };
}

/**
 * Emit a 'change' event on the mock awareness to simulate awareness updates.
 */
function emitAwarenessChange(
  awareness: MockAwareness,
  changes: { added: number[]; updated: number[]; removed: number[] },
): void {
  const handlers = awareness.listeners.get('change') ?? [];
  for (const handler of handlers) {
    handler(changes);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCollaborationCursor()', () => {
  beforeEach(() => {
    lastConfigureOptions = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanupCollaborationCursors();
    vi.useRealTimers();
  });

  it('returns a configured extension object', () => {
    const awareness = createMockAwareness();
    const result = createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('name', 'collaborationCursor');
  });

  it('passes provider with awareness to the extension', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(lastConfigureOptions).not.toBeNull();
    const provider = lastConfigureOptions!['provider'] as Record<string, unknown>;
    expect(provider).toHaveProperty('awareness');
    expect(provider['awareness']).toBe(awareness);
  });

  it('passes user data with color assignments to the extension', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const user = lastConfigureOptions!['user'] as CollaborationUser;
    expect(user.userId).toBe('user-1');
    expect(user.name).toBe('Alice');
    expect(user.color).toBeTruthy();
    expect(user.color.startsWith('#')).toBe(true);
    expect(user.selectionColor).toBeTruthy();
    expect(user.selectionColor.startsWith('rgba')).toBe(true);
    expect(user.labelColor).toBeTruthy();
    expect(user.lastActiveAt).toBeGreaterThan(0);
  });

  it('provides a render function', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(typeof lastConfigureOptions!['render']).toBe('function');
  });

  it('provides a selectionRender function', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(typeof lastConfigureOptions!['selectionRender']).toBe('function');
  });

  it('registers an awareness change listener', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const changeListeners = awareness.listeners.get('change') ?? [];
    expect(changeListeners.length).toBeGreaterThan(0);
  });

  it('assigns the same color for the same user ID across calls', () => {
    const awareness1 = createMockAwareness(1);
    createCollaborationCursor({
      awareness: awareness1 as never,
      user: { userId: 'user-abc', name: 'Alice' },
    });
    const user1 = lastConfigureOptions!['user'] as CollaborationUser;

    const awareness2 = createMockAwareness(2);
    createCollaborationCursor({
      awareness: awareness2 as never,
      user: { userId: 'user-abc', name: 'Alice' },
    });
    const user2 = lastConfigureOptions!['user'] as CollaborationUser;

    expect(user1.color).toBe(user2.color);
    expect(user1.selectionColor).toBe(user2.selectionColor);
  });
});

describe('Awareness change listener (fade-out management)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanupCollaborationCursors();
    vi.useRealTimers();
  });

  it('does not throw when a remote client is added', () => {
    const awareness = createMockAwareness(1);
    awareness.states.set(2, { user: { name: 'Bob' } });

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(() => {
      emitAwarenessChange(awareness, { added: [2], updated: [], removed: [] });
    }).not.toThrow();
  });

  it('does not throw when a remote client is removed', () => {
    const awareness = createMockAwareness(1);

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    expect(() => {
      emitAwarenessChange(awareness, { added: [], updated: [], removed: [2] });
    }).not.toThrow();
  });

  it('ignores changes to the local client (self)', () => {
    const awareness = createMockAwareness(1);
    awareness.states.set(1, { user: { name: 'Alice' } });

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    // Should not set up a fade timer for self
    expect(() => {
      emitAwarenessChange(awareness, { added: [], updated: [1], removed: [] });
    }).not.toThrow();
  });
});

describe('createCursorActivityTracker()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a function', () => {
    const awareness = createMockAwareness();
    const tracker = createCursorActivityTracker(awareness as never);
    expect(typeof tracker).toBe('function');
  });

  it('updates awareness local state lastActiveAt on call', () => {
    const awareness = createMockAwareness();
    awareness.setLocalStateField('user', {
      userId: 'user-1',
      name: 'Alice',
      color: '#f38ba8',
      selectionColor: 'rgba(243, 139, 168, 0.20)',
      labelColor: '#1e1e2e',
      lastActiveAt: 1000,
    });

    const tracker = createCursorActivityTracker(awareness as never);
    const beforeTime = Date.now();
    tracker();

    const userState = awareness.localState?.['user'] as CollaborationUser | undefined;
    expect(userState).toBeDefined();
    expect(userState!.lastActiveAt).toBeGreaterThanOrEqual(beforeTime);
  });

  it('does not update when no user state is set', () => {
    const awareness = createMockAwareness();
    // localState has no 'user' field

    const tracker = createCursorActivityTracker(awareness as never);
    const setFieldSpy = vi.spyOn(awareness, 'setLocalStateField');

    tracker();

    // Should not call setLocalStateField since there's no user
    expect(setFieldSpy).not.toHaveBeenCalled();
  });

  it('throttles rapid calls', () => {
    const awareness = createMockAwareness();
    awareness.setLocalStateField('user', {
      userId: 'user-1',
      name: 'Alice',
      color: '#f38ba8',
      selectionColor: 'rgba(243, 139, 168, 0.20)',
      labelColor: '#1e1e2e',
      lastActiveAt: 1000,
    });

    const setFieldSpy = vi.spyOn(awareness, 'setLocalStateField');
    const tracker = createCursorActivityTracker(awareness as never);

    // Call multiple times rapidly
    tracker();
    tracker();
    tracker();
    tracker();
    tracker();

    // First call should execute immediately, rest are throttled
    expect(setFieldSpy).toHaveBeenCalledTimes(1);

    // After throttle interval, the trailing call should fire
    vi.advanceTimersByTime(60);
    expect(setFieldSpy).toHaveBeenCalledTimes(2);
  });
});

describe('cleanupCollaborationCursors()', () => {
  it('can be called multiple times without error', () => {
    expect(() => {
      cleanupCollaborationCursors();
      cleanupCollaborationCursors();
      cleanupCollaborationCursors();
    }).not.toThrow();
  });

  it('cleans up after createCollaborationCursor', () => {
    vi.useFakeTimers();

    const awareness = createMockAwareness(1);
    awareness.states.set(2, { user: { name: 'Bob' } });

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    // Trigger a change that starts a fade timer
    emitAwarenessChange(awareness, { added: [2], updated: [], removed: [] });

    // Clean up should not throw and should clear all timers
    expect(() => {
      cleanupCollaborationCursors();
    }).not.toThrow();

    vi.useRealTimers();
  });
});

describe('Render function (via captured options)', () => {
  afterEach(() => {
    cleanupCollaborationCursors();
  });

  it('render produces an HTMLElement with cursor classes', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const renderFn = lastConfigureOptions!['render'] as (
      user: Record<string, string>,
    ) => HTMLElement;

    const element = renderFn({
      userId: 'user-2',
      name: 'Bob',
      color: '#89b4fa',
      selectionColor: 'rgba(137, 180, 250, 0.20)',
      labelColor: '#1e1e2e',
      lastActiveAt: String(Date.now()),
    });

    expect(element).toBeInstanceOf(HTMLElement);
    expect(element.classList.contains('collaboration-cursor-caret')).toBe(true);
    // jsdom normalizes hex colors to rgb() format
    expect(element.style.borderLeftColor).toBeTruthy();

    // Should have a label child
    const label = element.querySelector('.collaboration-cursor-label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Bob');
  });

  it('render falls back to "Anonymous" for missing name', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const renderFn = lastConfigureOptions!['render'] as (
      user: Record<string, string>,
    ) => HTMLElement;

    const element = renderFn({});
    const label = element.querySelector('.collaboration-cursor-label');
    expect(label!.textContent).toBe('Anonymous');
  });

  it('render returns hidden element when over MAX_VISIBLE_CURSORS', () => {
    const awareness = createMockAwareness(1);
    // Add 11 remote clients to exceed the limit
    for (let i = 2; i <= 12; i++) {
      awareness.states.set(i, { user: { name: `User ${i}` } });
    }

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const renderFn = lastConfigureOptions!['render'] as (
      user: Record<string, string>,
    ) => HTMLElement;

    const element = renderFn({ name: 'Overflow User', color: '#f38ba8' });
    expect(element.style.display).toBe('none');
  });

  it('selectionRender returns proper attributes', () => {
    const awareness = createMockAwareness();
    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const selectionRenderFn = lastConfigureOptions!['selectionRender'] as (
      user: Record<string, string>,
    ) => Record<string, string>;

    const attrs = selectionRenderFn({
      selectionColor: 'rgba(137, 180, 250, 0.20)',
    });

    expect(attrs['class']).toBe('collaboration-cursor-selection');
    expect(attrs['style']).toContain('background-color');
    expect(attrs['style']).toContain('rgba(137, 180, 250, 0.20)');
    expect(attrs['nodeName']).toBe('span');
  });

  it('selectionRender returns empty object when over MAX_VISIBLE_CURSORS', () => {
    const awareness = createMockAwareness(1);
    for (let i = 2; i <= 12; i++) {
      awareness.states.set(i, { user: { name: `User ${i}` } });
    }

    createCollaborationCursor({
      awareness: awareness as never,
      user: { userId: 'user-1', name: 'Alice' },
    });

    const selectionRenderFn = lastConfigureOptions!['selectionRender'] as (
      user: Record<string, string>,
    ) => Record<string, string>;

    const attrs = selectionRenderFn({ selectionColor: 'rgba(0,0,0,0.2)' });
    expect(Object.keys(attrs)).toHaveLength(0);
  });
});
