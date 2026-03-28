/**
 * settings-store.ts
 *
 * Zustand store for user-configurable editor and UI settings.
 * Persisted to localStorage under 'notesaner-settings'.
 *
 * Covers:
 *   - Editor typography (font family, font size, line height, tab size)
 *   - Per-user shortcut overrides (map of shortcutId -> custom KeyCombo)
 *
 * Theme settings are owned by theme-store (apps/web/src/shared/lib/theme/theme-store.ts).
 * Plugin enable/disable state is owned by plugin-store.ts.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { KeyCombo } from '@/shared/lib/keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorFontFamily =
  | 'system'
  | 'sans-serif'
  | 'serif'
  | 'mono'
  | 'inter'
  | 'source-serif'
  | 'jetbrains-mono';

export type LinkClickBehavior = 'click' | 'ctrl-click' | 'always-edit';

export type AutocompleteTrigger = '/' | '@' | '#' | '[[';

export interface AutocompleteSettings {
  enabled: boolean;
  triggers: AutocompleteTrigger[];
  delayMs: number;
}

export interface EditorSettings {
  fontFamily: EditorFontFamily;
  /** Font size in px. Clamped 10-24. */
  fontSize: number;
  /** Line height multiplier. Clamped 1.2-2.5. */
  lineHeight: number;
  /** Tab size in spaces. Clamped 2-8. */
  tabSize: number;
  /** Link click behaviour in the editor */
  linkClickBehavior: LinkClickBehavior;
  /** Enable browser spell checking */
  spellCheck: boolean;
  /** Show line numbers in the editor gutter */
  showLineNumbers: boolean;
  /** Wrap long lines instead of horizontal scrolling */
  wordWrap: boolean;
  /** Autocomplete settings */
  autocomplete: AutocompleteSettings;
}

export type UiDensity = 'compact' | 'comfortable' | 'spacious';

export type SidebarPosition = 'left' | 'right';

export interface AppearanceSettings {
  uiDensity: UiDensity;
  sidebarPosition: SidebarPosition;
  showStatusBar: boolean;
  reduceAnimations: boolean;
  contentMaxWidth: number;
  useCustomAccentColor: boolean;
  accentColor: string;
}

export interface SettingsState {
  // ---- State ----

  /** Editor typography settings. */
  editor: EditorSettings;

  /** Appearance settings. */
  appearance: AppearanceSettings;

  /**
   * Per-user shortcut overrides.
   * Key: shortcutId, Value: replacement KeyCombo (or null to disable).
   */
  shortcutOverrides: Record<string, KeyCombo | null>;

  // ---- Actions ----

  /** Partially update editor settings. */
  updateEditorSettings: (patch: Partial<EditorSettings>) => void;

  /** Partially update autocomplete settings. */
  updateAutocompleteSettings: (patch: Partial<AutocompleteSettings>) => void;

  /** Partially update appearance settings. */
  updateAppearanceSettings: (patch: Partial<AppearanceSettings>) => void;

  /** Override a shortcut's key combo. Pass null to disable the shortcut. */
  setShortcutOverride: (shortcutId: string, combo: KeyCombo | null) => void;

  /** Remove a shortcut override, restoring the default combo. */
  resetShortcutOverride: (shortcutId: string) => void;

  /** Remove all shortcut overrides. */
  resetAllShortcuts: () => void;

  /** Reset editor settings to defaults. */
  resetEditorSettings: () => void;

  /** Reset appearance settings to defaults. */
  resetAppearanceSettings: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_AUTOCOMPLETE_SETTINGS: AutocompleteSettings = {
  enabled: true,
  triggers: ['/', '@', '#', '[['],
  delayMs: 200,
};

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontFamily: 'system',
  fontSize: 15,
  lineHeight: 1.6,
  tabSize: 2,
  linkClickBehavior: 'click',
  spellCheck: true,
  showLineNumbers: false,
  wordWrap: true,
  autocomplete: DEFAULT_AUTOCOMPLETE_SETTINGS,
};

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  uiDensity: 'comfortable',
  sidebarPosition: 'left',
  showStatusBar: true,
  reduceAnimations: false,
  contentMaxWidth: 720,
  useCustomAccentColor: false,
  accentColor: '#6366f1',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        // ---- Initial state ----
        editor: DEFAULT_EDITOR_SETTINGS,
        appearance: DEFAULT_APPEARANCE_SETTINGS,
        shortcutOverrides: {},

        // ---- Actions ----

        updateEditorSettings: (patch) =>
          set(
            (state) => ({
              editor: {
                ...state.editor,
                ...patch,
                // Clamp numeric values
                fontSize:
                  patch.fontSize !== undefined
                    ? Math.min(24, Math.max(10, patch.fontSize))
                    : state.editor.fontSize,
                lineHeight:
                  patch.lineHeight !== undefined
                    ? Math.min(2.5, Math.max(1.2, patch.lineHeight))
                    : state.editor.lineHeight,
                tabSize:
                  patch.tabSize !== undefined
                    ? Math.min(8, Math.max(2, patch.tabSize))
                    : state.editor.tabSize,
              },
            }),
            false,
            'settings/updateEditorSettings',
          ),

        updateAutocompleteSettings: (patch) =>
          set(
            (state) => ({
              editor: {
                ...state.editor,
                autocomplete: {
                  ...state.editor.autocomplete,
                  ...patch,
                },
              },
            }),
            false,
            'settings/updateAutocompleteSettings',
          ),

        updateAppearanceSettings: (patch) =>
          set(
            (state) => ({
              appearance: {
                ...state.appearance,
                ...patch,
              },
            }),
            false,
            'settings/updateAppearanceSettings',
          ),

        setShortcutOverride: (shortcutId, combo) =>
          set(
            (state) => ({
              shortcutOverrides: {
                ...state.shortcutOverrides,
                [shortcutId]: combo,
              },
            }),
            false,
            'settings/setShortcutOverride',
          ),

        resetShortcutOverride: (shortcutId) =>
          set(
            (state) => {
              const overrides = { ...state.shortcutOverrides };
              delete overrides[shortcutId];
              return { shortcutOverrides: overrides };
            },
            false,
            'settings/resetShortcutOverride',
          ),

        resetAllShortcuts: () =>
          set({ shortcutOverrides: {} }, false, 'settings/resetAllShortcuts'),

        resetEditorSettings: () =>
          set({ editor: DEFAULT_EDITOR_SETTINGS }, false, 'settings/resetEditorSettings'),

        resetAppearanceSettings: () =>
          set(
            { appearance: DEFAULT_APPEARANCE_SETTINGS },
            false,
            'settings/resetAppearanceSettings',
          ),
      }),
      {
        name: 'notesaner-settings',
        partialize: (state) => ({
          editor: state.editor,
          appearance: state.appearance,
          shortcutOverrides: state.shortcutOverrides,
        }),
      },
    ),
    { name: 'SettingsStore' },
  ),
);

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** CSS font-family value for the given EditorFontFamily token. */
export function editorFontFamilyCss(family: EditorFontFamily): string {
  switch (family) {
    case 'inter':
      return "'Inter', sans-serif";
    case 'source-serif':
      return "'Source Serif 4', 'Georgia', serif";
    case 'jetbrains-mono':
      return "'JetBrains Mono', 'Menlo', monospace";
    case 'mono':
      return "'Menlo', 'Monaco', 'Consolas', monospace";
    case 'serif':
      return "'Georgia', 'Times New Roman', serif";
    case 'sans-serif':
      return "'Helvetica Neue', Arial, sans-serif";
    case 'system':
    default:
      return 'var(--ns-font-sans)';
  }
}

/** Human-readable label for an EditorFontFamily token. */
export const FONT_FAMILY_LABELS: Record<EditorFontFamily, string> = {
  system: 'System default',
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  mono: 'Monospace',
  inter: 'Inter',
  'source-serif': 'Source Serif',
  'jetbrains-mono': 'JetBrains Mono',
};
