'use client';

import { useRef, useCallback, type RefObject } from 'react';

/**
 * Swipe direction constants.
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeGestureOptions {
  /**
   * Minimum horizontal/vertical distance (px) to qualify as a swipe.
   * @default 50
   */
  threshold?: number;

  /**
   * Maximum ratio of perpendicular movement to primary axis movement.
   * Prevents diagonal drags from firing. Lower = stricter.
   * @default 0.75
   */
  maxCrossAxisRatio?: number;

  /**
   * Called when a valid swipe is detected.
   */
  onSwipe: (direction: SwipeDirection) => void;

  /**
   * Filter directions to listen for. If omitted, all directions fire.
   * @default undefined (all directions)
   */
  directions?: SwipeDirection[];
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

/**
 * Swipe gesture detection for touch devices.
 *
 * Returns `onTouchStart` and `onTouchEnd` handlers to spread onto the
 * target element. No useEffect needed -- pure event handler approach.
 *
 * @example
 * ```tsx
 * const swipeHandlers = useSwipeGesture({
 *   onSwipe: (dir) => {
 *     if (dir === 'right') openLeftSidebar();
 *     if (dir === 'left') openRightSidebar();
 *   },
 *   directions: ['left', 'right'],
 * });
 *
 * return <div {...swipeHandlers}>...</div>;
 * ```
 */
export function useSwipeGesture(options: SwipeGestureOptions) {
  const { threshold = 50, maxCrossAxisRatio = 0.75, onSwipe, directions } = options;

  const touchState = useRef<TouchState | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchState.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const { startX, startY, startTime } = touchState.current;
      touchState.current = null;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const elapsed = Date.now() - startTime;

      // Ignore very slow swipes (> 500ms) -- those are likely pans/scrolls
      if (elapsed > 500) return;

      const absDx = Math.abs(deltaX);
      const absDy = Math.abs(deltaY);

      // Determine primary axis
      let direction: SwipeDirection;

      if (absDx > absDy) {
        // Horizontal swipe
        if (absDx < threshold) return;
        if (absDy / absDx > maxCrossAxisRatio) return;
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        // Vertical swipe
        if (absDy < threshold) return;
        if (absDx / absDy > maxCrossAxisRatio) return;
        direction = deltaY > 0 ? 'down' : 'up';
      }

      // Filter if directions are specified
      if (directions && !directions.includes(direction)) return;

      onSwipe(direction);
    },
    [threshold, maxCrossAxisRatio, onSwipe, directions],
  );

  return { onTouchStart, onTouchEnd };
}

/**
 * Variant that attaches swipe handlers to a specific ref element.
 * Uses pointer events for broader device support.
 *
 * Returns a ref to attach to the element.
 *
 * @example
 * ```tsx
 * const ref = useSwipeGestureRef<HTMLDivElement>({
 *   onSwipe: (dir) => console.log(dir),
 * });
 *
 * return <div ref={ref}>...</div>;
 * ```
 */
export function useSwipeGestureRef<T extends HTMLElement>(
  options: SwipeGestureOptions,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const touchState = useRef<TouchState | null>(null);

  const { threshold = 50, maxCrossAxisRatio = 0.75, onSwipe, directions } = options;

  // We use a callback ref pattern to attach/detach listeners
  // without useEffect. The ref callback fires on mount/unmount.
  const callbackRef = useCallback(
    (node: T | null) => {
      // Cleanup old node
      if (ref.current) {
        ref.current.removeEventListener('touchstart', handleTouchStart as EventListener);
        ref.current.removeEventListener('touchend', handleTouchEnd as EventListener);
      }

      ref.current = node;

      if (node) {
        node.addEventListener('touchstart', handleTouchStart as EventListener, {
          passive: true,
        });
        node.addEventListener('touchend', handleTouchEnd as EventListener, {
          passive: true,
        });
      }

      function handleTouchStart(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        touchState.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: Date.now(),
        };
      }

      function handleTouchEnd(e: TouchEvent) {
        if (!touchState.current) return;
        const touch = e.changedTouches[0];
        if (!touch) return;

        const { startX, startY, startTime } = touchState.current;
        touchState.current = null;

        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const elapsed = Date.now() - startTime;

        if (elapsed > 500) return;

        const absDx = Math.abs(deltaX);
        const absDy = Math.abs(deltaY);

        let direction: SwipeDirection;

        if (absDx > absDy) {
          if (absDx < threshold) return;
          if (absDy / absDx > maxCrossAxisRatio) return;
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          if (absDy < threshold) return;
          if (absDx / absDy > maxCrossAxisRatio) return;
          direction = deltaY > 0 ? 'down' : 'up';
        }

        if (directions && !directions.includes(direction)) return;
        onSwipe(direction);
      }
    },
    [threshold, maxCrossAxisRatio, onSwipe, directions],
  );

  // Return the callback ref disguised as a RefObject for API compatibility
  return callbackRef as unknown as RefObject<T | null>;
}
