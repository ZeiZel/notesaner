'use client';

import { useEffect, useCallback } from 'react';
import {
  getGlobalShortcuts,
  matchesCombo,
  type ShortcutId,
} from '@/shared/lib/keyboard-shortcuts';

/**
 * Map of shortcut action IDs to their handler functions.
 *
 * Only include the actions your component cares about.
 * Unregistered actions will be silently skipped.
 *
 * Example:
 * ```ts
 * const handlers: ShortcutHandlers = {
 *   'new-note': () => router.push('/notes/new'),
 *   'global-search': () => setSearchOpen(true),
 * };
 * ```
 */
export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/**
 * Registers global keyboard shortcuts and dispatches to the provided handlers.
 *
 * Behavior:
 * - Only intercepts shortcuts that have a registered handler.
 * - Calls `event.preventDefault()` when a matching shortcut fires to prevent
 *   default browser behavior (e.g., Cmd+S triggering "Save page").
 * - Does NOT fire when the user is typing inside an <input>, <textarea>, or
 *   [contenteditable] element that is NOT the TipTap editor root — this
 *   prevents hijacking form inputs while still allowing editor shortcuts to
 *   pass through to TipTap.
 * - Safe to call in multiple components simultaneously; each instance manages
 *   its own listener and cleans up on unmount.
 *
 * @param handlers - Map of shortcut IDs to handler callbacks.
 * @param enabled  - Set to false to temporarily disable all shortcuts (e.g.
 *                   while a modal is open that has its own key bindings).
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  enabled = true,
): void {
  // Stable reference so the effect doesn't re-register on every render when
  // the caller passes an inline object literal.
  const stableHandlers = useCallback(() => handlers, [handlers]);

  useEffect(() => {
    if (!enabled) return;

    const globalShortcuts = getGlobalShortcuts();

    function handleKeyDown(event: KeyboardEvent): void {
      // Skip when focus is inside a native text input that is not the editor.
      // TipTap marks its root with class "ProseMirror" — we allow shortcuts to
      // bubble up from there so that global ones still fire.
      const target = event.target as HTMLElement | null;
      if (target !== null && isNativeTextInput(target)) {
        return;
      }

      const currentHandlers = stableHandlers();

      for (const shortcut of globalShortcuts) {
        if (matchesCombo(event, shortcut.combo)) {
          const handler = currentHandlers[shortcut.id];
          if (handler !== undefined) {
            event.preventDefault();
            handler();
            // Stop after the first match — combos are assumed unique.
            return;
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, stableHandlers]);
}

/**
 * Returns true for native text-entry elements that should NOT trigger global
 * shortcuts. The TipTap editor uses [contenteditable] but is excluded because
 * it relies on the event bubbling to the window for its own shortcut handling.
 *
 * We exempt the ProseMirror root so that global shortcuts (e.g. Cmd+Shift+F)
 * still fire even when the editor is focused, while editor-scoped shortcuts
 * (Bold, Italic, etc.) are handled by TipTap internally.
 */
function isNativeTextInput(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();

  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (el.isContentEditable) {
    // Allow global shortcuts to fire from inside the TipTap editor.
    // TipTap sets class="ProseMirror" on its contenteditable root.
    if (el.classList.contains('ProseMirror')) {
      return false;
    }
    return true;
  }

  return false;
}
