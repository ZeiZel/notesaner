export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string;
  tags: string[];
  minAppVersion: string;
  main: string;
  styles?: string;
  settings?: string;
  permissions: PluginPermission[];
  entryPoints: {
    editorExtension?: string;
    sidebarPanel?: string;
    settingsPage?: string;
    commands?: string;
    statusBar?: string;
    view?: string;
  };
}

export type PluginPermission =
  | 'editor:insert-block'
  | 'editor:modify-content'
  | 'editor:register-extension'
  | 'ui:register-view'
  | 'ui:register-sidebar'
  | 'ui:register-command'
  | 'ui:show-modal'
  | 'ui:show-notice'
  | 'storage:local'
  | 'storage:notes-read'
  | 'storage:notes-write'
  | 'network:fetch';

export interface InstalledPluginDto {
  id: string;
  workspaceId: string;
  pluginId: string;
  name: string;
  version: string;
  repository: string;
  isEnabled: boolean;
  installedAt: string;
}

export interface PluginSearchParams {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface PluginSearchResult {
  plugins: PluginRegistryEntry[];
  total: number;
}

export interface PluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  repository: string;
  tags: string[];
  latestVersion: string;
  downloads: number;
  rating: number;
}

export interface PluginSettingsSchema {
  type: 'object';
  properties: Record<string, PluginSettingField>;
}

export interface PluginSettingField {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
}
