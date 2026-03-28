'use client';

/**
 * ShortcutProvider — Initializes the global keyboard shortcut system.
 *
 * Responsibilities:
 *   1. Starts the KeyboardManager global listener on mount
 *   2. Syncs persisted overrides from useShortcutStore to the manager
 *   3. Registers the cheatsheet toggle shortcut (Cmd+/)
 *   4. Warns about conflicts on startup
 *   5. Manages the ShortcutCheatsheet overlay state
 *
 * This component should be mounted once near the application root,
 * inside the Providers tree (it needs access to Zustand stores).
 *
 * useEffect is justified here: we need to start/stop the global keydown
 * listener (external system integration — valid escape hatch).
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { keyboardManager } from '@/shared/lib/keyboard-manager';
import { useShortcutStore } from '@/shared/stores/shortcut-store';
import { useKeyboardShortcut } from '@/shared/hooks/useKeyboardShortcut';
import { ShortcutCheatsheet } from './ShortcutCheatsheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutProviderProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const overrides = useShortcutStore((s) => s.overrides);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  // ---- Start/stop the keyboard manager (external system integration) ----
  useEffect(() => {
    keyboardManager.start();
    return () => {
      keyboardManager.stop();
    };
  }, []);

  // ---- Sync overrides and warn conflicts on change ----
  useEffect(() => {
    keyboardManager.setOverrides(overrides);
    keyboardManager.warnConflicts();
  }, [overrides]);

  // ---- Toggle cheatsheet callback (stable ref via useCallback) ----
  const toggleCheatsheet = useCallback(() => {
    setCheatsheetOpen((prev) => !prev);
  }, []);

  // ---- Register cheatsheet shortcut (Cmd+/) ----
  useKeyboardShortcut('shortcut-cheatsheet', 'global', toggleCheatsheet);

  const handleCloseCheatsheet = useCallback(() => {
    setCheatsheetOpen(false);
  }, []);

  return (
    <>
      {children}
      <ShortcutCheatsheet open={cheatsheetOpen} onClose={handleCloseCheatsheet} />
    </>
  );
}
