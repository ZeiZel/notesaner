# Domain: Plugins

## Overview

GitHub-based plugin ecosystem with sandboxed execution, tag-based discovery, and hot-reload support.

## Plugin Manifest

Each plugin is a GitHub repository containing `manifest.json`:

```json
{
  "id": "excalidraw",
  "name": "Excalidraw Whiteboard",
  "version": "1.2.0",
  "description": "Embed interactive whiteboards in your notes",
  "author": "notesaner-team",
  "repository": "https://github.com/notesaner/plugin-excalidraw",
  "tags": ["notesaner-plugin", "whiteboard", "drawing", "visual"],
  "minAppVersion": "1.0.0",
  "main": "dist/main.js",
  "styles": "dist/styles.css",
  "settings": "settings.schema.json",
  "permissions": ["editor:insert-block", "ui:register-view", "storage:local"],
  "entryPoints": {
    "editorExtension": "dist/editor-extension.js",
    "sidebarPanel": "dist/sidebar.js",
    "settingsPage": "dist/settings.js",
    "commands": "dist/commands.js"
  }
}
```

## Plugin SDK API

```typescript
interface PluginContext {
  // Editor
  editor: {
    registerExtension(extension: TipTapExtension): void;
    registerNodeView(name: string, component: React.FC): void;
    registerMarkdownSerializer(name: string, serializer: MarkdownSerializer): void;
    insertBlock(type: string, attrs: Record<string, unknown>): void;
  };

  // Workspace
  workspace: {
    registerView(id: string, component: React.FC, options: ViewOptions): void;
    registerSidebarPanel(id: string, component: React.FC): void;
    registerStatusBarItem(component: React.FC): void;
    registerCommand(command: Command): void;
    registerKeybinding(keybinding: Keybinding): void;
  };

  // Storage
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // Settings
  settings: {
    register(schema: SettingsSchema): void;
    get(key: string): unknown;
    onChange(key: string, callback: (value: unknown) => void): void;
  };

  // Events
  events: {
    on(event: PluginEvent, handler: EventHandler): void;
    off(event: PluginEvent, handler: EventHandler): void;
    emit(event: string, data: unknown): void;
  };

  // Notes
  notes: {
    getActive(): NoteDto | null;
    getById(id: string): Promise<NoteDto>;
    search(query: string): Promise<NoteDto[]>;
    create(options: CreateNoteOptions): Promise<NoteDto>;
    update(id: string, content: string): Promise<void>;
  };

  // UI
  ui: {
    showNotice(message: string, options?: NoticeOptions): void;
    showModal(component: React.FC, options?: ModalOptions): void;
    registerRibbonIcon(icon: string, title: string, onClick: () => void): void;
  };
}
```

## Plugin Lifecycle

```
1. DISCOVERY
   User searches plugins by tags in built-in browser
   Server queries plugin registry (GitHub repos with "notesaner-plugin" tag)
        │
2. INSTALLATION
   User clicks "Install" → Server downloads release from GitHub
   Plugin files stored in workspace plugin directory
   Manifest registered in PostgreSQL
        │
3. LOADING
   On app start, plugin loader reads installed manifests
   Each plugin loaded in sandboxed iframe
   Plugin SDK injected via postMessage bridge
        │
4. ACTIVATION
   Plugin's main() called with PluginContext
   Plugin registers extensions, views, commands
        │
5. RUNTIME
   Plugin responds to events, renders views
   Communication via postMessage API (sandboxed)
        │
6. DEACTIVATION
   User disables plugin → cleanup handlers called
   Extensions unregistered, views removed
        │
7. UNINSTALLATION
   Plugin files deleted, manifest removed from DB
   Plugin data optionally preserved
```

## Plugin Sandbox

- Plugins execute in iframes with strict CSP
- Communication via `postMessage` API
- Plugin SDK provides typed bridge between host and iframe
- Plugins cannot access host DOM directly
- Custom elements / Shadow DOM for plugin-rendered UI in host

## Built-in Plugins (packages/)

These ship as part of the monorepo but follow the plugin architecture:

| Plugin | Description | Entry Points |
|--------|-------------|-------------|
| `plugin-excalidraw` | Whiteboard drawing | Editor block, Standalone view |
| `plugin-kanban` | Kanban boards from frontmatter | Editor block, Standalone view |
| `plugin-calendar` | Calendar with daily notes | Sidebar panel, Standalone view |
| `plugin-database` | Notion-like tables | Editor block, Standalone view |
| `plugin-graph` | Knowledge graph | Standalone view, Sidebar mini-graph |
| `plugin-slides` | Presentations from notes | Standalone view |
| `plugin-ai` | AI writing assistant | Editor extension, Command palette |
| `plugin-templates` | Note templates | Command palette, New note dialog |
| `plugin-backlinks` | Backlinks panel | Sidebar panel |
| `plugin-daily-notes` | Daily/periodic notes | Sidebar, Command palette |
| `plugin-pdf-export` | Export to PDF/DOCX | Command palette |

## Plugin Registry Search

Tags system enables efficient plugin discovery:

```
GET /api/plugins/search?tags=notesaner-plugin,editor&q=whiteboard

Response:
{
  "plugins": [
    {
      "id": "excalidraw",
      "name": "Excalidraw Whiteboard",
      "tags": ["notesaner-plugin", "whiteboard", "drawing"],
      "downloads": 15420,
      "rating": 4.8,
      "repository": "https://github.com/notesaner/plugin-excalidraw"
    }
  ]
}
```
