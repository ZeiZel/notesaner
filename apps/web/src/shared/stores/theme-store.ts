// NOTE: Business store — user theme preferences persisted to localStorage.
// These are user-configurable settings (accent color, font family, font size)
// that must survive page reloads. Zustand persistence is required.
// TODO: Consider merging with shared/lib/theme/theme-store.ts to reduce
// indirection — both stores manage theme-related preferences.
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

/**
 * A personal CSS snippet that the user can define in their appearance
 * preferences. Distinct from workspace-level CSS snippets (those are
 * stored server-side and managed via the workspace settings store).
 */
export interface PersonalCssSnippet {
  id: string;
  name: string;
  css: string;
  enabled: boolean;
}

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

  /**
   * Personal CSS snippets. These are applied on top of workspace snippets.
   * Persisted to localStorage, not to the server.
   */
  personalSnippets: PersonalCssSnippet[];
}

export interface ThemePreferencesState extends ThemePreferences {
  // Actions
  setAccentColor: (color: string | null) => void;
  setUiFontFamily: (family: string | null, presetId: string) => void;
  setUiFontSize: (size: number | null) => void;
  addPersonalSnippet: (snippet: PersonalCssSnippet) => void;
  updatePersonalSnippet: (id: string, patch: Partial<Omit<PersonalCssSnippet, 'id'>>) => void;
  removePersonalSnippet: (id: string) => void;
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
  personalSnippets: [],
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

        addPersonalSnippet: (snippet) =>
          set(
            (state) => ({
              personalSnippets: [...state.personalSnippets, snippet],
            }),
            false,
            'themePrefs/addPersonalSnippet',
          ),

        updatePersonalSnippet: (id, patch) =>
          set(
            (state) => ({
              personalSnippets: state.personalSnippets.map((s) =>
                s.id === id ? { ...s, ...patch } : s,
              ),
            }),
            false,
            'themePrefs/updatePersonalSnippet',
          ),

        removePersonalSnippet: (id) =>
          set(
            (state) => ({
              personalSnippets: state.personalSnippets.filter((s) => s.id !== id),
            }),
            false,
            'themePrefs/removePersonalSnippet',
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
          personalSnippets: state.personalSnippets,
        }),
      },
    ),
    { name: 'ThemePreferencesStore' },
  ),
);
