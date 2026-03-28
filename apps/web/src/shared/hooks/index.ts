/**
 * shared/hooks — Reusable React hooks.
 *
 * These hooks are domain-agnostic and may be used across all FSD layers.
 */

// Responsive breakpoints
export {
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  type Breakpoint,
} from './useBreakpoint';

// Clipboard operations
export { useClipboard, type UseClipboardOptions, type UseClipboardReturn } from './useClipboard';

// Keyboard shortcuts (single + batch registration)
export { useKeyboardShortcut } from './useKeyboardShortcut';
export { useKeyboardShortcuts, type ShortcutHandlers } from './useKeyboardShortcuts';

// Real-time presence (Yjs awareness)
export {
  usePresence,
  setLocalPresence,
  removeLocalPresence,
  updateLocalPresence,
  clearPresence,
  type PresenceUser,
  type UsePresenceOptions,
  type UsePresenceReturn,
} from './usePresence';

// Touch gestures
export {
  useSwipeGesture,
  useSwipeGestureRef,
  type SwipeDirection,
  type SwipeGestureOptions,
} from './useSwipeGesture';

// Idle detection
export {
  useIdleDetection,
  DEFAULT_IDLE_TIMEOUT_MS,
  type UseIdleDetectionOptions,
} from './useIdleDetection';

// Presence + idle integration
export { usePresenceWithIdle, type UsePresenceWithIdleOptions } from './usePresenceWithIdle';
