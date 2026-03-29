// NOTE: Business store — focus mode is a core editor domain concept. The
// `isFocusMode` flag controls whether the application hides all workspace
// chrome (sidebars, tabs, status bar) and presents a distraction-free writing
// surface. Persisted to localStorage so the user's preference survives a
// page reload.
/**
 * focus-mode-store.ts
 *
 * Zustand store managing focus (distraction-free writing) mode state.
 *
 * Focus mode:
 *   - Hides the sidebar, tab bar, and status bar.
 *   - Centers the writing area with a comfortable max-width.
 *   - Enables typewriter scrolling (active line stays vertically centered).
 *   - Provides an ambient sounds toggle (UI placeholder for future audio).
 *
 * Lifecycle:
 *   - `toggleFocusMode()` flips the flag.
 *   - `exitFocusMode()` unconditionally clears focus mode (used by Esc handler).
 *   - The flag is persisted to localStorage under the key
 *     `notesaner-focus-mode`.
 *
 * Keyboard shortcut (Ctrl+Shift+F / Cmd+Shift+F) is registered in
 * KeyboardShortcutsProvider and calls `toggleFocusMode`.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FocusModeState {
  /** Whether focus (distraction-free) mode is currently active. */
  isFocusMode: boolean;

  /**
   * Whether typewriter scrolling is enabled.
   * When true, the active cursor line is kept vertically centered
   * in the writing area.
   */
  typewriterScrolling: boolean;

  /**
   * Whether ambient sounds are enabled (UI placeholder).
   * Audio integration is deferred to a future sprint; this flag
   * is persisted so the user's preference is remembered.
   */
  ambientSoundsEnabled: boolean;

  // ---- Actions ----

  /** Toggle focus mode on/off. */
  toggleFocusMode: () => void;

  /** Unconditionally exit focus mode (used by Esc key handler). */
  exitFocusMode: () => void;

  /** Toggle typewriter scrolling on/off. */
  toggleTypewriterScrolling: () => void;

  /** Toggle ambient sounds on/off. */
  toggleAmbientSounds: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFocusModeStore = create<FocusModeState>()(
  devtools(
    persist(
      (set) => ({
        isFocusMode: false,
        typewriterScrolling: true,
        ambientSoundsEnabled: false,

        toggleFocusMode: () =>
          set((state) => ({ isFocusMode: !state.isFocusMode }), false, 'focusMode/toggleFocusMode'),

        exitFocusMode: () => set({ isFocusMode: false }, false, 'focusMode/exitFocusMode'),

        toggleTypewriterScrolling: () =>
          set(
            (state) => ({ typewriterScrolling: !state.typewriterScrolling }),
            false,
            'focusMode/toggleTypewriterScrolling',
          ),

        toggleAmbientSounds: () =>
          set(
            (state) => ({ ambientSoundsEnabled: !state.ambientSoundsEnabled }),
            false,
            'focusMode/toggleAmbientSounds',
          ),
      }),
      {
        name: 'notesaner-focus-mode',
        partialize: (state) => ({
          // Persist user preferences but NOT the active focus mode flag —
          // re-opening the app should not lock the user into focus mode.
          typewriterScrolling: state.typewriterScrolling,
          ambientSoundsEnabled: state.ambientSoundsEnabled,
        }),
      },
    ),
    { name: 'FocusModeStore' },
  ),
);
