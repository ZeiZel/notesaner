export enum NoteStatus {
  ACTIVE = 'ACTIVE',
  TRASHED = 'TRASHED',
  ARCHIVED = 'ARCHIVED',
}

export enum LinkType {
  WIKI = 'WIKI',
  MARKDOWN = 'MARKDOWN',
  EMBED = 'EMBED',
  BLOCK_REF = 'BLOCK_REF',
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  SAML = 'SAML',
  OIDC = 'OIDC',
}

export enum PluginEntryPoint {
  EDITOR_EXTENSION = 'editorExtension',
  SIDEBAR_PANEL = 'sidebarPanel',
  SETTINGS_PAGE = 'settingsPage',
  COMMANDS = 'commands',
  STATUS_BAR = 'statusBar',
  VIEW = 'view',
}

export enum PanelType {
  EDITOR = 'editor',
  GRAPH = 'graph',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
  EXCALIDRAW = 'excalidraw',
  SETTINGS = 'settings',
  PLUGIN = 'plugin',
}

export enum SortOrder {
  RELEVANCE = 'relevance',
  UPDATED_AT = 'updatedAt',
  CREATED_AT = 'createdAt',
  TITLE = 'title',
}
