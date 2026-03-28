// NOTE: Business store — public vault theme configuration with persistence.
// The `isPreviewMode` field is transient UI state, correctly excluded from
// persistence via `partialize`. All other fields are user-configured theme
// settings that must persist across sessions.
/**
 * public-theme-store.ts
 *
 * Zustand store managing the visual configuration of public vault pages.
 *
 * State:
 *   - selectedTheme    : which built-in theme is active
 *   - customCss        : user-provided CSS snippet (sanitized on read)
 *   - fontFamily       : font-family preset
 *   - customFontFamily : raw font family string when fontFamily === 'custom'
 *   - fontSize         : base font size in px (clamped 12–24)
 *   - maxWidth         : max content column width in px (clamped 480–1440)
 *   - isPreviewMode    : whether the settings panel is showing a live preview
 *
 * The store is persisted to localStorage under 'notesaner-public-theme'.
 * isPreviewMode is NOT persisted (transient UI state).
 *
 * Theme settings are stored in workspace public settings on the server; this
 * store is the local source of truth during a settings editing session and
 * is synced to the backend when the user saves.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  type PublicThemeId,
  type PublicFontFamily,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  MAX_WIDTH_MIN,
  MAX_WIDTH_MAX,
  MAX_WIDTH_DEFAULT,
  sanitizeCustomCss,
} from './public-themes';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const PUBLIC_THEME_STORAGE_KEY = 'notesaner-public-theme';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface PublicThemeState {
  // ---- Persisted state ----

  /** The active built-in theme identifier. */
  selectedTheme: PublicThemeId;

  /** User-supplied custom CSS (stored as-is; sanitized on read via getCssToInject). */
  customCss: string;

  /** Font family preset. */
  fontFamily: PublicFontFamily;

  /** Raw font family value when fontFamily === 'custom'. */
  customFontFamily: string;

  /** Base font size in px. Clamped to [FONT_SIZE_MIN, FONT_SIZE_MAX]. */
  fontSize: number;

  /** Max content column width in px. Clamped to [MAX_WIDTH_MIN, MAX_WIDTH_MAX]. */
  maxWidth: number;

  // ---- Transient UI state (NOT persisted) ----

  /**
   * When true, the settings panel is in preview mode — the PublicThemeProvider
   * uses the current store values to preview the theme without persisting to
   * the backend. Resets to false on page navigation or store hydration.
   */
  isPreviewMode: boolean;

  // ---- Actions ----

  /** Set the active theme. */
  setSelectedTheme: (theme: PublicThemeId) => void;

  /** Update the custom CSS snippet. Raw input — sanitized in getCssToInject. */
  setCustomCss: (css: string) => void;

  /** Set the font family preset. */
  setFontFamily: (family: PublicFontFamily) => void;

  /** Set the raw custom font family string (only meaningful when fontFamily === 'custom'). */
  setCustomFontFamily: (family: string) => void;

  /** Set the base font size. Value is clamped. */
  setFontSize: (size: number) => void;

  /** Set the max content width. Value is clamped. */
  setMaxWidth: (width: number) => void;

  /** Enter or exit preview mode. */
  setPreviewMode: (isPreview: boolean) => void;

  /** Reset all settings to their defaults. */
  resetToDefaults: () => void;

  // ---- Derived helpers (pure, not persisted) ----

  /**
   * Return the sanitized custom CSS string, safe for injection into a
   * <style> tag.
   */
  getSanitizedCustomCss: () => string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STATE = {
  selectedTheme: 'light' as PublicThemeId,
  customCss: '',
  fontFamily: 'system-ui' as PublicFontFamily,
  customFontFamily: '',
  fontSize: FONT_SIZE_DEFAULT,
  maxWidth: MAX_WIDTH_DEFAULT,
  isPreviewMode: false,
};

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

export const usePublicThemeStore = create<PublicThemeState>()(
  devtools(
    persist(
      (set, get) => ({
        // ---- Initial state ----

        ...DEFAULT_STATE,

        // ---- Actions ----

        setSelectedTheme: (theme) =>
          set({ selectedTheme: theme }, false, 'publicTheme/setSelectedTheme'),

        setCustomCss: (css) => set({ customCss: css }, false, 'publicTheme/setCustomCss'),

        setFontFamily: (family) => set({ fontFamily: family }, false, 'publicTheme/setFontFamily'),

        setCustomFontFamily: (family) =>
          set({ customFontFamily: family }, false, 'publicTheme/setCustomFontFamily'),

        setFontSize: (size) =>
          set(
            { fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size)) },
            false,
            'publicTheme/setFontSize',
          ),

        setMaxWidth: (width) =>
          set(
            { maxWidth: Math.min(MAX_WIDTH_MAX, Math.max(MAX_WIDTH_MIN, width)) },
            false,
            'publicTheme/setMaxWidth',
          ),

        setPreviewMode: (isPreview) =>
          set({ isPreviewMode: isPreview }, false, 'publicTheme/setPreviewMode'),

        resetToDefaults: () =>
          set(
            {
              selectedTheme: DEFAULT_STATE.selectedTheme,
              customCss: DEFAULT_STATE.customCss,
              fontFamily: DEFAULT_STATE.fontFamily,
              customFontFamily: DEFAULT_STATE.customFontFamily,
              fontSize: DEFAULT_STATE.fontSize,
              maxWidth: DEFAULT_STATE.maxWidth,
              isPreviewMode: false,
            },
            false,
            'publicTheme/resetToDefaults',
          ),

        getSanitizedCustomCss: () => sanitizeCustomCss(get().customCss),
      }),
      {
        name: PUBLIC_THEME_STORAGE_KEY,
        // Exclude transient UI state from persistence.
        partialize: (state) => ({
          selectedTheme: state.selectedTheme,
          customCss: state.customCss,
          fontFamily: state.fontFamily,
          customFontFamily: state.customFontFamily,
          fontSize: state.fontSize,
          maxWidth: state.maxWidth,
          // isPreviewMode is intentionally excluded
        }),
        version: 1,
      },
    ),
    { name: 'PublicThemeStore' },
  ),
);
