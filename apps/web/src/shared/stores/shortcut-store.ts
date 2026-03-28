/**
 * shortcut-store.ts — Zustand store for keyboard shortcut customization.
 *
 * Persisted to localStorage under 'notesaner-shortcuts'.
 *
 * Responsibilities:
 *   - Store user-defined key combo overrides
 *   - Track disabled shortcuts
 *   - Sync overrides to the keyboard manager
 *
 * The settings-store already has shortcutOverrides for backward compatibility.
 * This store serves as the canonical source and syncs to the keyboard manager
 * on every change, providing a clean separation of concerns.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { KeyCombo } from '@/shared/lib/keyboard-shortcuts';
import { keyboardManager } from '@/shared/lib/keyboard-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutStoreState {
  // ---- State ----

  /**
   * Per-user shortcut overrides.
   * Key: shortcutId, Value: replacement KeyCombo or null (null = disabled).
   */
  overrides: Record<string, KeyCombo | null>;

  // ---- Actions ----

  /** Override a shortcut's key combo. Pass null to disable the shortcut. */
  setOverride: (shortcutId: string, combo: KeyCombo | null) => void;

  /** Remove a shortcut override, restoring the default combo. */
  resetOverride: (shortcutId: string) => void;

  /** Remove all shortcut overrides. */
  resetAll: () => void;

  /**
   * Check if assigning a combo to an action would cause a conflict.
   * Returns the conflicting action IDs, or an empty array.
   */
  checkConflict: (shortcutId: string, combo: KeyCombo) => string[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useShortcutStore = create<ShortcutStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ---- Initial state ----
        overrides: {},

        // ---- Actions ----

        setOverride: (shortcutId, combo) => {
          set(
            (state) => {
              const next = { ...state.overrides, [shortcutId]: combo };
              // Sync to keyboard manager synchronously
              keyboardManager.setOverrides(next);
              return { overrides: next };
            },
            false,
            'shortcuts/setOverride',
          );
        },

        resetOverride: (shortcutId) => {
          set(
            (state) => {
              const next = { ...state.overrides };
              delete next[shortcutId];
              keyboardManager.setOverrides(next);
              return { overrides: next };
            },
            false,
            'shortcuts/resetOverride',
          );
        },

        resetAll: () => {
          keyboardManager.setOverrides({});
          set({ overrides: {} }, false, 'shortcuts/resetAll');
        },

        checkConflict: (shortcutId, combo) => {
          const currentOverrides = get().overrides;

          // Build a temporary override map with the proposed change
          const tempOverrides = { ...currentOverrides, [shortcutId]: combo };
          keyboardManager.setOverrides(tempOverrides);
          const conflicts = keyboardManager.wouldConflict(combo, 'global', shortcutId);

          // Restore the actual overrides
          keyboardManager.setOverrides(currentOverrides);

          return conflicts;
        },
      }),
      {
        name: 'notesaner-shortcuts',
        partialize: (state) => ({
          overrides: state.overrides,
        }),
        onRehydrateStorage: () => (state) => {
          // After rehydration, sync overrides to the keyboard manager
          if (state?.overrides) {
            keyboardManager.setOverrides(state.overrides);
          }
        },
      },
    ),
    { name: 'ShortcutStore' },
  ),
);
