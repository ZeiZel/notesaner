/**
 * Backward-compatible re-exports for workspace settings.
 *
 * Components have been moved to features/settings/ui/ as part of FSD restructuring.
 * This file preserves existing import paths for consumers.
 */
export { GeneralSettings } from '../ui/GeneralSettings';
export { MembersSettings } from '../ui/MembersSettings';
export { PluginsSettings } from '../ui/PluginsSettings';
export { AppearanceSettings } from '../ui/AppearanceSettings';
export { PublishSettings } from '../ui/PublishSettings';
export { DangerZone } from '../ui/DangerZone';
export { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
