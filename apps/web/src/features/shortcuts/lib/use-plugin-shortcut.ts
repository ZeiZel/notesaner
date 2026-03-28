'use client';

/**
 * usePluginShortcut — Hook for plugins to register keyboard shortcuts.
 *
 * Wraps keyboardManager.registerKeybinding with React lifecycle management.
 * The shortcut is automatically unregistered on unmount.
 *
 * Usage (from a plugin component):
 * ```ts
 * usePluginShortcut('my-plugin.do-thing', { key: 'g', mod: true }, () => {
 *   // plugin action
 * }, { label: 'Do the thing' });
 * ```
 *
 * useEffect is justified: registering/unregistering with an external
 * singleton (KeyboardManager) is a valid escape hatch.
 */

import { useEffect, useRef } from 'react';
import { keyboardManager, type ShortcutScope } from '@/shared/lib/keyboard-manager';
import type { KeyCombo, ShortcutCategory } from '@/shared/lib/keyboard-shortcuts';

export interface UsePluginShortcutOptions {
  /** Human-readable label shown in the cheatsheet. */
  label?: string;
  /** Category for grouping. Defaults to 'plugin'. */
  category?: ShortcutCategory;
  /** Scope for activation context. Defaults to 'global'. */
  scope?: ShortcutScope;
  /** Set to false to temporarily disable. */
  enabled?: boolean;
}

/**
 * Register a plugin shortcut that is managed by the central KeyboardManager.
 *
 * @param id       - Unique shortcut ID (recommend: `pluginId.action`)
 * @param combo    - Key combination
 * @param callback - Handler function
 * @param options  - Optional label, category, scope, enabled
 */
export function usePluginShortcut(
  id: string,
  combo: KeyCombo,
  callback: () => void,
  options?: UsePluginShortcutOptions,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const enabled = options?.enabled ?? true;

  // Serialize combo + options for stable dependency tracking
  const comboKey = `${combo.mod ? 'mod+' : ''}${combo.ctrl ? 'ctrl+' : ''}${combo.shift ? 'shift+' : ''}${combo.alt ? 'alt+' : ''}${combo.key}`;
  const label = options?.label;
  const category = options?.category;
  const scope = options?.scope;

  useEffect(() => {
    if (!enabled) return;

    const unregister = keyboardManager.registerKeybinding(id, combo, () => callbackRef.current(), {
      label,
      category,
      scope,
    });

    return unregister;
    // combo is intentionally excluded — comboKey encodes combo identity as a stable string
  }, [id, comboKey, enabled, label, category, scope]);
}
