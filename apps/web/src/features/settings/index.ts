/**
 * features/settings — public API (FSD barrel export).
 *
 * All imports from this feature MUST go through this file.
 */

// ---- UI components ----
export { SettingsDialog } from './ui/SettingsDialog';
export type { SettingsDialogProps } from './ui/SettingsDialog';
export { ProfileSettings } from './ui/ProfileSettings';
export { EditorSettings } from './ui/EditorSettings';
export { ThemeSettingsTab } from './ui/ThemeSettingsTab';
export { KeybindingSettings } from './ui/KeybindingSettings';
export { KeybindingsSettings } from './ui/KeybindingsSettings';
export { PluginSettings } from './ui/PluginSettings';
export { WorkspaceSettings } from './ui/WorkspaceSettings';
export { MemberManagement } from './ui/MemberManagement';

// Workspace settings (page-level, not dialog)
export { GeneralSettings } from './ui/GeneralSettings';
export { MembersSettings } from './ui/MembersSettings';
export { PluginsSettings } from './ui/PluginsSettings';
export { AppearanceSettings } from './ui/AppearanceSettings';
export { PublishSettings } from './ui/PublishSettings';
export { DangerZone } from './ui/DangerZone';

// ---- Model (stores, types, helpers) ----
export { useSettingsStore, FONT_FAMILY_LABELS, editorFontFamilyCss } from './model/settings-store';
export type {
  EditorSettings as EditorSettingsValues,
  EditorFontFamily,
} from './model/settings-store';
export { useWorkspaceSettingsStore } from './model/workspace-settings-store';
