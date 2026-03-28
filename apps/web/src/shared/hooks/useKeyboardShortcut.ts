'use client';

/**
 * useKeyboardShortcut — React hook for registering a single keyboard shortcut.
 *
 * Integrates with the central KeyboardManager for conflict detection
 * and scope-based priority resolution.
 *
 * Usage:
 * ```ts
 * useKeyboardShortcut('new-note', 'global', () => {
 *   router.push('/notes/new');
 * });
 * ```
 *
 * The hook:
 * - Registers the handler with the keyboard manager on mount
 * - Unregisters on unmount
 * - Respects the `enabled` flag for conditional activation
 * - Starts the global keydown listener automatically
 *
 * For bulk registration of multiple shortcuts, prefer useKeyboardShortcuts
 * (plural) from './useKeyboardShortcuts'.
 */

import { useEffect, useRef } from 'react';
import { keyboardManager, type ShortcutScope } from '@/shared/lib/keyboard-manager';

/**
 * Registers a handler for a specific shortcut action in the keyboard manager.
 *
 * @param actionId - The shortcut ID from KEYBOARD_SHORTCUTS registry
 * @param scope    - The scope this handler operates in
 * @param handler  - Callback invoked when the shortcut fires
 * @param enabled  - Set to false to temporarily disable (default: true)
 */
export function useKeyboardShortcut(
  actionId: string,
  scope: ShortcutScope,
  handler: () => void,
  enabled = true,
): void {
  // Keep a stable ref to the handler to avoid re-registering on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    // Ensure the global listener is active
    keyboardManager.start();

    const unregister = keyboardManager.register(actionId, scope, () => handlerRef.current());

    return unregister;
  }, [actionId, scope, enabled]);
}

/**
 * Convenience overload: register multiple shortcuts at once.
 *
 * @param shortcuts - Array of { actionId, scope, handler } registrations
 * @param enabled   - Master enable/disable switch
 */
export function useKeyboardShortcuts(
  shortcuts: Array<{
    actionId: string;
    scope: ShortcutScope;
    handler: () => void;
  }>,
  enabled = true,
): void {
  // Store handlers in a ref to keep the effect stable
  const handlersRef = useRef(shortcuts);
  handlersRef.current = shortcuts;

  // Serialize action IDs for dependency tracking
  const actionIds = shortcuts.map((s) => `${s.scope}:${s.actionId}`).join(',');

  useEffect(() => {
    if (!enabled) return;

    keyboardManager.start();

    const unregisters = handlersRef.current.map((s) =>
      keyboardManager.register(s.actionId, s.scope, () => {
        // Look up the current handler at call time
        const current = handlersRef.current.find(
          (h) => h.actionId === s.actionId && h.scope === s.scope,
        );
        current?.handler();
      }),
    );

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [actionIds, enabled]);
}
