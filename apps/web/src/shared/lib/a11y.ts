/**
 * Accessibility Utilities
 * =======================
 * Core a11y helpers for WCAG 2.1 AA compliance across the Notesaner frontend.
 *
 * Includes:
 *   - announceToScreenReader() — programmatic screen reader announcements
 *   - useFocusTrap()           — traps focus within a container (modals, dialogs)
 *   - useReducedMotion()       — respects prefers-reduced-motion
 *   - generateId()             — stable IDs for aria-describedby associations
 *   - useArrowNavigation()     — arrow key navigation for list/menu patterns
 *
 * @module shared/lib/a11y
 */

import { useCallback, useEffect, useRef, useState, useId, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Focusable element selector per WAI-ARIA practices. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'details > summary',
  'audio[controls]',
  'video[controls]',
].join(', ');

// ---------------------------------------------------------------------------
// announceToScreenReader
// ---------------------------------------------------------------------------

/**
 * Live region element reference (lazily created and appended to <body>).
 * We maintain two regions: one for polite and one for assertive announcements.
 */
let politeRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

function getOrCreateLiveRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const existing = politeness === 'polite' ? politeRegion : assertiveRegion;
  if (existing && document.body.contains(existing)) {
    return existing;
  }

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  el.className = 'sr-only';
  // Visually hidden but accessible
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
  });
  el.id = `ns-live-region-${politeness}`;
  document.body.appendChild(el);

  if (politeness === 'polite') {
    politeRegion = el;
  } else {
    assertiveRegion = el;
  }

  return el;
}

/**
 * Announce a message to screen readers via an ARIA live region.
 *
 * Messages are cleared after a short delay to allow repeated identical
 * announcements to be re-read.
 *
 * @param message   - The text to announce.
 * @param politeness - 'polite' (default) waits for idle; 'assertive' interrupts.
 */
export function announceToScreenReader(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite',
): void {
  if (typeof document === 'undefined') return;

  const region = getOrCreateLiveRegion(politeness);

  // Clear first so repeated identical messages are re-announced.
  region.textContent = '';

  // Use a microtask to ensure the DOM update triggers the announcement.
  requestAnimationFrame(() => {
    region.textContent = message;
  });

  // Clear after 5 seconds so future announcements can use the same text.
  setTimeout(() => {
    if (region.textContent === message) {
      region.textContent = '';
    }
  }, 5000);
}

// ---------------------------------------------------------------------------
// useFocusTrap
// ---------------------------------------------------------------------------

interface UseFocusTrapOptions {
  /** Whether the trap is currently active. */
  active?: boolean;
  /** Element to return focus to when the trap is released. */
  returnFocusTo?: HTMLElement | null;
  /** Called when the user presses Escape inside the trap. */
  onEscape?: () => void;
}

/**
 * Traps keyboard focus within a container element.
 *
 * Implements the WCAG dialog pattern:
 *   - Focus moves to the first focusable element on activation.
 *   - Tab / Shift+Tab cycle through focusable children.
 *   - Escape triggers the onEscape callback (for closing).
 *   - Focus returns to the previously focused element on deactivation.
 *
 * @returns A ref to attach to the container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  active = true,
  returnFocusTo,
  onEscape,
}: UseFocusTrapOptions = {}) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Save the currently focused element to restore later.
    previousActiveElement.current = returnFocusTo ?? (document.activeElement as HTMLElement | null);

    // Focus the first focusable element inside the container.
    const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      // Slight delay to allow animation/render to complete.
      requestAnimationFrame(() => {
        firstFocusable.focus();
      });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!container) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on the first element, wrap to last.
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on the last element, wrap to first.
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to the previously focused element.
      if (previousActiveElement.current && previousActiveElement.current.isConnected) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, returnFocusTo, onEscape]);

  return containerRef;
}

// ---------------------------------------------------------------------------
// useReducedMotion
// ---------------------------------------------------------------------------

/**
 * Returns true if the user has requested reduced motion via their OS settings.
 *
 * Uses useSyncExternalStore to subscribe to the prefers-reduced-motion media
 * query — no useEffect needed for external browser API subscriptions.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false, // Server snapshot: assume no reduced motion preference
  );
}

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

let idCounter = 0;

/**
 * Generates a unique ID string suitable for aria-describedby, aria-labelledby,
 * htmlFor/id associations, and similar ARIA attribute pairings.
 *
 * Prefer React's useId() hook when possible. Use this for imperative/non-hook
 * contexts (e.g., class methods, event handlers, utilities).
 *
 * @param prefix - Optional prefix for readability (e.g., "error", "label").
 * @returns A unique string ID.
 */
export function generateId(prefix = 'ns'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * React hook version of generateId. Uses React's useId for SSR safety,
 * with an optional human-readable prefix.
 *
 * @param prefix - Optional prefix for the ID.
 * @returns A stable unique ID string.
 */
export function useA11yId(prefix?: string): string {
  const reactId = useId();
  // useId returns a format like ":r1:" — strip colons for cleaner IDs.
  const sanitized = reactId.replace(/:/g, '');
  return prefix ? `${prefix}-${sanitized}` : `ns-${sanitized}`;
}

// ---------------------------------------------------------------------------
// useArrowNavigation
// ---------------------------------------------------------------------------

interface UseArrowNavigationOptions {
  /** Orientation of the navigation. Defaults to 'vertical'. */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Whether navigation wraps from last to first. Defaults to true. */
  wrap?: boolean;
  /** Callback when an item is activated (Enter/Space). */
  onActivate?: (index: number) => void;
}

/**
 * Hook for arrow-key navigation within a list of focusable items.
 *
 * Implements the WAI-ARIA roving tabindex pattern:
 *   - ArrowUp/Down (vertical) or ArrowLeft/Right (horizontal) moves focus.
 *   - Home/End jumps to first/last item.
 *   - Enter/Space activates the current item.
 *
 * @returns An object with the active index, a keydown handler, and a setter.
 */
export function useArrowNavigation(itemCount: number, options: UseArrowNavigationOptions = {}) {
  const { orientation = 'vertical', wrap = true, onActivate } = options;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKeys =
        orientation === 'horizontal'
          ? ['ArrowLeft']
          : orientation === 'vertical'
            ? ['ArrowUp']
            : ['ArrowUp', 'ArrowLeft'];

      const nextKeys =
        orientation === 'horizontal'
          ? ['ArrowRight']
          : orientation === 'vertical'
            ? ['ArrowDown']
            : ['ArrowDown', 'ArrowRight'];

      if (prevKeys.includes(e.key)) {
        e.preventDefault();
        setActiveIndex((prev) => {
          if (prev <= 0) return wrap ? itemCount - 1 : 0;
          return prev - 1;
        });
      } else if (nextKeys.includes(e.key)) {
        e.preventDefault();
        setActiveIndex((prev) => {
          if (prev >= itemCount - 1) return wrap ? 0 : itemCount - 1;
          return prev + 1;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(itemCount - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate?.(activeIndex);
      }
    },
    [itemCount, orientation, wrap, activeIndex, onActivate],
  );

  return { activeIndex, setActiveIndex, handleKeyDown };
}

// ---------------------------------------------------------------------------
// Utility: visually hidden style (for programmatic use)
// ---------------------------------------------------------------------------

/**
 * CSS-in-JS style object for visually hidden elements that remain
 * accessible to screen readers. Prefer the Tailwind `sr-only` class
 * when working in JSX/TSX.
 */
export const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { FOCUSABLE_SELECTOR };
