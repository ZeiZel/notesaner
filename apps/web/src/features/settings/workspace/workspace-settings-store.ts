/**
 * Backward-compatible re-export.
 *
 * The store has moved to features/settings/model/workspace-settings-store.ts
 * as part of FSD restructuring. This file preserves the import path for
 * existing consumers (e.g., widgets/settings-layout).
 */
export { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
