/**
 * typewriter — Typewriter scrolling for the Focus Mode plugin.
 *
 * Typewriter scrolling keeps the line containing the cursor vertically centred
 * (or at a configurable offset from centre) in the scrollable editor container.
 * This mimics the behaviour of dedicated distraction-free writing apps such as
 * iA Writer and Typora.
 *
 * Usage:
 *   1. Create a TypewriterScroller instance once when entering focus mode.
 *   2. Call `attach(editorEl, scrollEl)` to begin observing cursor movement.
 *   3. Call `detach()` before leaving focus mode to clean up event listeners.
 *   4. Call `scrollToCursor()` manually when the cursor moves programmatically.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default vertical offset as a fraction of the viewport height.
 *
 * 0.5 centres the cursor exactly. Values less than 0.5 place it above centre
 * (closer to the top), greater than 0.5 place it below centre.
 */
export const DEFAULT_VERTICAL_OFFSET = 0.45;

/** Minimum scroll delta (px) to bother animating — avoids jitter for tiny moves. */
const MIN_SCROLL_DELTA = 2;

/** Duration of the smooth scroll animation in milliseconds. */
const SCROLL_DURATION_MS = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TypewriterOptions {
  /**
   * Vertical fraction of the scroll container height where the cursor
   * line should be placed (0 = top, 1 = bottom). Default: 0.45.
   */
  verticalOffset?: number;
  /**
   * Whether to animate the scroll (smooth) or jump instantly.
   * Default: true.
   */
  smooth?: boolean;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Retrieve the bounding rect of the cursor inside a contenteditable element.
 *
 * Returns null when there is no selection or the selection is not within the
 * given container.
 */
export function getCursorRect(container: HTMLElement): DOMRect | null {
  if (typeof window === 'undefined') return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();

  // Ensure the selection is inside our editor container
  if (!container.contains(range.commonAncestorContainer)) return null;

  range.collapse(true);

  // getClientRects can be empty for collapsed ranges at the start of a line.
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];

  // Fallback: use the bounding rect of the start container node
  const node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).getBoundingClientRect();
  }
  if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
    return node.parentElement.getBoundingClientRect();
  }

  return null;
}

/**
 * Calculate the target scrollTop that places `cursorTop` at `targetY`
 * inside `scrollEl`.
 *
 * @param cursorTop   The cursor's top position relative to the document (pageY).
 * @param scrollEl    The scrollable container element.
 * @param verticalOffset  Fraction of viewport height (0–1).
 */
export function calculateTargetScrollTop(
  cursorTop: number,
  scrollEl: HTMLElement,
  verticalOffset: number,
): number {
  const containerRect = scrollEl.getBoundingClientRect();
  const targetY = containerRect.top + containerRect.height * verticalOffset;

  // Current scroll offset of the container
  const currentScroll = scrollEl.scrollTop;

  // Absolute position of the cursor relative to the scroll container's content
  const cursorAbsolute = cursorTop - containerRect.top + currentScroll;

  return cursorAbsolute - containerRect.height * verticalOffset + (targetY - containerRect.top);
}

// ---------------------------------------------------------------------------
// Animation helper
// ---------------------------------------------------------------------------

/**
 * Smoothly animate `scrollEl.scrollTop` from its current value to `target`.
 */
function animateScrollTo(scrollEl: HTMLElement, target: number, durationMs: number): void {
  const start = scrollEl.scrollTop;
  const delta = target - start;

  if (Math.abs(delta) < MIN_SCROLL_DELTA) return;

  const startTime = performance.now();

  function step(now: number): void {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    scrollEl.scrollTop = start + delta * eased;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// TypewriterScroller class
// ---------------------------------------------------------------------------

/**
 * Manages typewriter scrolling for a given editor and scroll container.
 */
export class TypewriterScroller {
  private editorEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  private readonly options: Required<TypewriterOptions>;
  private readonly boundHandleSelectionChange: () => void;
  private rafId: number | null = null;

  constructor(options: TypewriterOptions = {}) {
    this.options = {
      verticalOffset: options.verticalOffset ?? DEFAULT_VERTICAL_OFFSET,
      smooth: options.smooth ?? true,
    };
    this.boundHandleSelectionChange = this.handleSelectionChange.bind(this);
  }

  /**
   * Attach the scroller to an editor container and its scroll parent.
   *
   * @param editorEl  The contenteditable (or ProseMirror editor) element.
   * @param scrollEl  The scrollable ancestor that should be scrolled.
   */
  attach(editorEl: HTMLElement, scrollEl: HTMLElement): void {
    this.detach(); // Clean up any previous attachment

    this.editorEl = editorEl;
    this.scrollEl = scrollEl;

    document.addEventListener('selectionchange', this.boundHandleSelectionChange);
  }

  /** Remove all event listeners and release DOM references. */
  detach(): void {
    document.removeEventListener('selectionchange', this.boundHandleSelectionChange);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.editorEl = null;
    this.scrollEl = null;
  }

  /** Scroll to the current cursor position. */
  scrollToCursor(): void {
    if (!this.editorEl || !this.scrollEl) return;

    const cursorRect = getCursorRect(this.editorEl);
    if (!cursorRect) return;

    const target = calculateTargetScrollTop(
      cursorRect.top,
      this.scrollEl,
      this.options.verticalOffset,
    );

    const clampedTarget = Math.max(
      0,
      Math.min(target, this.scrollEl.scrollHeight - this.scrollEl.clientHeight),
    );

    if (this.options.smooth) {
      animateScrollTo(this.scrollEl, clampedTarget, SCROLL_DURATION_MS);
    } else {
      this.scrollEl.scrollTop = clampedTarget;
    }
  }

  /** Update vertical offset at runtime (e.g. from settings panel). */
  setVerticalOffset(offset: number): void {
    this.options.verticalOffset = Math.max(0, Math.min(1, offset));
  }

  /** Update smooth animation setting at runtime. */
  setSmooth(smooth: boolean): void {
    this.options.smooth = smooth;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private handleSelectionChange(): void {
    // Debounce via requestAnimationFrame to avoid over-scrolling on every
    // intermediate selection event during a key-hold.
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.scrollToCursor();
    });
  }
}
