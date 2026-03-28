'use client';

/**
 * useIdleDetection — tracks user activity and reports idle/active status.
 *
 * Monitors mouse, keyboard, scroll, and touch events. After `idleTimeoutMs`
 * of inactivity (default: 5 minutes), calls `onIdle`. When activity resumes,
 * calls `onActive`.
 *
 * Valid useEffect usage:
 *   - Setting up DOM event listeners for user activity detection.
 *     This is a side effect on an external system (DOM) and cannot be
 *     computed during render.
 */

import { useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default idle timeout: 5 minutes. */
export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Events that count as user activity. */
const ACTIVITY_EVENTS: readonly string[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'pointermove',
] as const;

/** Throttle interval for activity detection to avoid excessive callbacks. */
const ACTIVITY_THROTTLE_MS = 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseIdleDetectionOptions {
  /** Milliseconds of inactivity before the user is considered idle. Defaults to 5 min. */
  idleTimeoutMs?: number;
  /** Called when the user becomes idle. */
  onIdle?: () => void;
  /** Called when the user resumes activity after being idle. */
  onActive?: () => void;
  /** Whether to enable idle detection. Defaults to true. */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIdleDetection({
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  onIdle,
  onActive,
  enabled = true,
}: UseIdleDetectionOptions = {}): void {
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Stable references for callbacks
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;

  const resetTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // If currently idle, transition back to active
    if (isIdleRef.current) {
      isIdleRef.current = false;
      onActiveRef.current?.();
    }

    lastActivityRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      onIdleRef.current?.();
    }, idleTimeoutMs);
  }, [idleTimeoutMs]);

  useEffect(() => {
    if (!enabled) return;

    // Throttled activity handler
    let lastCallTime = 0;
    function handleActivity() {
      const now = Date.now();
      if (now - lastCallTime < ACTIVITY_THROTTLE_MS) return;
      lastCallTime = now;
      resetTimer();
    }

    // Start initial timer
    resetTimer();

    // Register event listeners
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, resetTimer]);
}
