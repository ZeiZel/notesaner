/**
 * Backward-compatible re-export.
 *
 * The store has moved to features/settings/model/settings-store.ts
 * as part of FSD restructuring. This file preserves the import path
 * for any existing consumers.
 */
export { useSettingsStore, editorFontFamilyCss, FONT_FAMILY_LABELS } from './model/settings-store';
export type { EditorSettings, EditorFontFamily, SettingsState } from './model/settings-store';
