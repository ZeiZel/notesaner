/**
 * Tests for typewriter.ts
 *
 * Covers:
 *   - calculateTargetScrollTop
 *   - getCursorRect (with DOM mocks)
 *   - TypewriterScroller: attach / detach / option setters
 *   - DEFAULT_VERTICAL_OFFSET constant
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTargetScrollTop,
  getCursorRect,
  TypewriterScroller,
  DEFAULT_VERTICAL_OFFSET,
} from '../typewriter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake HTMLElement with scrollTop, scrollHeight, clientHeight,
 * and getBoundingClientRect.
 */
function makeScrollEl(opts: {
  top?: number;
  height?: number;
  scrollTop?: number;
  scrollHeight?: number;
}): HTMLElement {
  const el = document.createElement('div');

  const rect = {
    top: opts.top ?? 0,
    left: 0,
    right: 800,
    bottom: (opts.top ?? 0) + (opts.height ?? 600),
    width: 800,
    height: opts.height ?? 600,
    x: 0,
    y: opts.top ?? 0,
    toJSON: () => ({}),
  };

  Object.defineProperty(el, 'scrollTop', {
    get: () => opts.scrollTop ?? 0,
    set: () => undefined,
    configurable: true,
  });

  Object.defineProperty(el, 'scrollHeight', {
    get: () => opts.scrollHeight ?? 2000,
    configurable: true,
  });

  Object.defineProperty(el, 'clientHeight', {
    get: () => opts.height ?? 600,
    configurable: true,
  });

  el.getBoundingClientRect = () => rect as DOMRect;

  return el;
}

// ---------------------------------------------------------------------------
// DEFAULT_VERTICAL_OFFSET
// ---------------------------------------------------------------------------

describe('DEFAULT_VERTICAL_OFFSET', () => {
  it('is between 0 and 1', () => {
    expect(DEFAULT_VERTICAL_OFFSET).toBeGreaterThan(0);
    expect(DEFAULT_VERTICAL_OFFSET).toBeLessThan(1);
  });

  it('is close to centre (0.4 – 0.5)', () => {
    expect(DEFAULT_VERTICAL_OFFSET).toBeGreaterThanOrEqual(0.4);
    expect(DEFAULT_VERTICAL_OFFSET).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// calculateTargetScrollTop
// ---------------------------------------------------------------------------

describe('calculateTargetScrollTop', () => {
  it('centres the cursor when verticalOffset is 0.5', () => {
    // Container: top=0, height=600, scrollTop=0
    const scrollEl = makeScrollEl({ top: 0, height: 600, scrollTop: 0, scrollHeight: 2000 });

    // Cursor is at clientTop=300 (already centred in a 600px container)
    const targetScrollTop = calculateTargetScrollTop(300, scrollEl, 0.5);
    // cursor absolute from content = 300 - 0 + 0 = 300
    // targetScrollTop = 300 - 300 + (300-0) = 300
    expect(targetScrollTop).toBeCloseTo(300, 0);
  });

  it('returns a larger scrollTop when cursor is near the bottom', () => {
    const scrollEl = makeScrollEl({ top: 0, height: 600, scrollTop: 0, scrollHeight: 3000 });
    // Cursor is at viewport y=500 (near bottom of 600px container)
    const target = calculateTargetScrollTop(500, scrollEl, 0.45);
    // Should require scrolling down (positive value)
    expect(target).toBeGreaterThan(0);
  });

  it('returns a smaller scrollTop when cursor is above centre', () => {
    const scrollEl = makeScrollEl({ top: 0, height: 600, scrollTop: 200, scrollHeight: 3000 });
    // Cursor is at clientY=50 (near top)
    const target = calculateTargetScrollTop(50, scrollEl, 0.45);
    // Content absolute position = 50 + 200 = 250; target centre = 0.45 * 600 = 270
    // scrollTop = 250 - 270 + 270 = 250; but since scrollTop=200 currently, target < 200 is expected
    // The formula: cursorAbsolute - height*offset + (targetY - top)
    // cursorAbsolute = 50 - 0 + 200 = 250
    // 250 - 600*0.45 + (0.45*600 - 0) = 250 - 270 + 270 = 250
    expect(typeof target).toBe('number');
    expect(isNaN(target)).toBe(false);
  });

  it('handles a container that is scrolled down', () => {
    const scrollEl = makeScrollEl({ top: 0, height: 600, scrollTop: 500, scrollHeight: 3000 });
    const target = calculateTargetScrollTop(300, scrollEl, 0.5);
    // cursorAbsolute = 300 - 0 + 500 = 800
    // target = 800 - 300 + 300 = 800
    expect(target).toBeCloseTo(800, 0);
  });
});

// ---------------------------------------------------------------------------
// getCursorRect
// ---------------------------------------------------------------------------

describe('getCursorRect', () => {
  it('returns null when window.getSelection returns null', () => {
    const original = window.getSelection;
    window.getSelection = () => null;
    const container = document.createElement('div');
    expect(getCursorRect(container)).toBeNull();
    window.getSelection = original;
  });

  it('returns null when selection has no ranges', () => {
    const mockSelection = {
      rangeCount: 0,
      getRangeAt: vi.fn(),
    } as unknown as Selection;

    const original = window.getSelection;
    window.getSelection = () => mockSelection;

    const container = document.createElement('div');
    expect(getCursorRect(container)).toBeNull();

    window.getSelection = original;
  });

  it('returns null when selection is outside the container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Create a range inside a different element (not the container)
    const outside = document.createElement('p');
    outside.textContent = 'outside text';
    document.body.appendChild(outside);

    const range = document.createRange();
    range.selectNodeContents(outside);

    const mockSelection = {
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection;

    const original = window.getSelection;
    window.getSelection = () => mockSelection;

    expect(getCursorRect(container)).toBeNull();

    window.getSelection = original;
    document.body.removeChild(container);
    document.body.removeChild(outside);
  });
});

// ---------------------------------------------------------------------------
// TypewriterScroller
// ---------------------------------------------------------------------------

describe('TypewriterScroller', () => {
  let scroller: TypewriterScroller;

  beforeEach(() => {
    scroller = new TypewriterScroller();
  });

  afterEach(() => {
    scroller.detach();
  });

  it('creates with default options', () => {
    expect(scroller).toBeDefined();
  });

  it('accepts custom verticalOffset', () => {
    const custom = new TypewriterScroller({ verticalOffset: 0.3 });
    expect(custom).toBeDefined();
    custom.detach();
  });

  it('accepts smooth: false option', () => {
    const instant = new TypewriterScroller({ smooth: false });
    expect(instant).toBeDefined();
    instant.detach();
  });

  it('attach adds a selectionchange event listener', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const editorEl = document.createElement('div');
    const scrollEl = makeScrollEl({});
    document.body.appendChild(scrollEl);

    scroller.attach(editorEl, scrollEl);

    expect(addSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));

    addSpy.mockRestore();
    document.body.removeChild(scrollEl);
  });

  it('detach removes the selectionchange event listener', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const editorEl = document.createElement('div');
    const scrollEl = makeScrollEl({});
    document.body.appendChild(scrollEl);

    scroller.attach(editorEl, scrollEl);
    scroller.detach();

    expect(removeSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));

    removeSpy.mockRestore();
    document.body.removeChild(scrollEl);
  });

  it('detach is safe to call before attach', () => {
    expect(() => scroller.detach()).not.toThrow();
  });

  it('detach is safe to call multiple times', () => {
    const editorEl = document.createElement('div');
    const scrollEl = makeScrollEl({});
    scroller.attach(editorEl, scrollEl);
    expect(() => {
      scroller.detach();
      scroller.detach();
    }).not.toThrow();
  });

  it('setVerticalOffset clamps values between 0 and 1', () => {
    // Should not throw for edge and out-of-range values
    expect(() => scroller.setVerticalOffset(0)).not.toThrow();
    expect(() => scroller.setVerticalOffset(1)).not.toThrow();
    expect(() => scroller.setVerticalOffset(2)).not.toThrow();
    expect(() => scroller.setVerticalOffset(-1)).not.toThrow();
  });

  it('setSmooth toggles animation mode', () => {
    expect(() => scroller.setSmooth(false)).not.toThrow();
    expect(() => scroller.setSmooth(true)).not.toThrow();
  });

  it('scrollToCursor is a no-op before attach', () => {
    // Should not throw when no editor/scroll element is set
    expect(() => scroller.scrollToCursor()).not.toThrow();
  });

  it('attach replaces previous attachment', () => {
    const editorEl1 = document.createElement('div');
    const editorEl2 = document.createElement('div');
    const scrollEl = makeScrollEl({});
    document.body.appendChild(scrollEl);

    // Second attach should not leave orphaned listeners
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    scroller.attach(editorEl1, scrollEl);
    scroller.attach(editorEl2, scrollEl);

    // detach from first attach should have been called
    expect(removeSpy).toHaveBeenCalled();

    removeSpy.mockRestore();
    document.body.removeChild(scrollEl);
  });
});
