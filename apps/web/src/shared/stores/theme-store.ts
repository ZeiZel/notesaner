/**
 * theme-store.ts — Extended theme preferences store.
 *
 * Extends the core theme store (shared/lib/theme/theme-store.ts) with
 * additional user-level customization preferences:
 *   - Accent color override (custom primary color)
 *   - UI font family override
 *   - UI font size override
 *
 * These preferences are layered ON TOP of the base theme. The ThemeEditor
 * component reads from both stores and applies overrides via the theme engine.
 *
 * Persisted to localStorage under 'notesaner-theme-prefs'.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemePreferences {
  /**
   * Custom accent color hex (e.g. '#cba6f7').
   * When null, the theme's built-in primary color is used.
   */
  accentColor: string | null;

  /**
   * UI font family override (CSS font-family string).
   * When null, the theme's default --ns-font-sans is used.
   */
  uiFontFamily: string | null;

  /**
   * UI font family preset ID (for displaying the selected preset in UI).
   */
  uiFontPresetId: string;

  /**
   * UI base font size in px.
   * When null, the default 16px root font size is used.
   */
  uiFontSize: number | null;
}

export interface ThemePreferencesState extends ThemePreferences {
  // Actions
  setAccentColor: (color: string | null) => void;
  setUiFontFamily: (family: string | null, presetId: string) => void;
  setUiFontSize: (size: number | null) => void;
  resetPreferences: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: ThemePreferences = {
  accentColor: null,
  uiFontFamily: null,
  uiFontPresetId: 'system',
  uiFontSize: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThemePreferencesStore = create<ThemePreferencesState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_PREFERENCES,

        setAccentColor: (accentColor) => set({ accentColor }, false, 'themePrefs/setAccentColor'),

        setUiFontFamily: (uiFontFamily, uiFontPresetId) =>
          set({ uiFontFamily, uiFontPresetId }, false, 'themePrefs/setUiFontFamily'),

        setUiFontSize: (uiFontSize) =>
          set(
            {
              uiFontSize: uiFontSize !== null ? Math.min(22, Math.max(12, uiFontSize)) : null,
            },
            false,
            'themePrefs/setUiFontSize',
          ),

        resetPreferences: () => set(DEFAULT_PREFERENCES, false, 'themePrefs/reset'),
      }),
      {
        name: 'notesaner-theme-prefs',
        partialize: (state) => ({
          accentColor: state.accentColor,
          uiFontFamily: state.uiFontFamily,
          uiFontPresetId: state.uiFontPresetId,
          uiFontSize: state.uiFontSize,
        }),
      },
    ),
    { name: 'ThemePreferencesStore' },
  ),
);
