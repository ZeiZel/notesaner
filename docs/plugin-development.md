# Plugin Development Guide

A comprehensive guide for building plugins for Notesaner, the web-first note-taking platform.

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Getting Started](#2-getting-started)
- [3. Plugin SDK API](#3-plugin-sdk-api)
- [4. UI Integration](#4-ui-integration)
- [5. Data Access](#5-data-access)
- [6. Events](#6-events)
- [7. Publishing](#7-publishing)
- [8. Examples](#8-examples)
- [9. Best Practices](#9-best-practices)
- [10. API Reference](#10-api-reference)

---

## 1. Introduction

### What Plugins Can Do

Notesaner plugins extend the application in ways limited only by the available
APIs. Common plugin capabilities include:

- **Editor extensions** -- custom blocks, node views, and markdown serializers
  (e.g. Excalidraw whiteboards, Kanban boards, database tables)
- **Sidebar panels** -- persistent UI in the workspace sidebar (e.g. calendar,
  backlinks, knowledge graph, spaced-repetition indicator)
- **Standalone views** -- full-pane views registered under their own route
  (e.g. graph view, slide presentation, PDF export preview)
- **Commands** -- entries in the command palette with optional keyboard shortcuts
  (e.g. "Open today's daily note", "Export to PDF", "AI summarize")
- **Data processing** -- reading and writing notes, parsing markdown, creating
  flashcards, clipping web content
- **Settings pages** -- custom configuration UI managed through a JSON schema

### Architecture Overview

```
 ┌───────────────────────────────────┐
 │         Host Application          │
 │  (Next.js frontend / NestJS API)  │
 ├───────────────────────────────────┤
 │        Plugin Loader              │
 │  reads manifest.json              │
 │  creates sandboxed iframe         │
 │  injects Plugin SDK bridge        │
 ├──────────┬────────────────────────┤
 │          │ postMessage API        │
 ├──────────┴────────────────────────┤
 │    Sandboxed Plugin iframe        │
 │    ┌─────────────────────────┐    │
 │    │  Plugin code (your JS)  │    │
 │    │  @notesaner/plugin-sdk  │    │
 │    └─────────────────────────┘    │
 └───────────────────────────────────┘
```

**Key architectural principles:**

1. **Sandbox isolation** -- every plugin runs in its own `<iframe>` with a strict
   Content Security Policy. Plugins cannot access the host DOM directly.
2. **postMessage bridge** -- all communication between the plugin and the host
   flows through a typed `postMessage` API. The Plugin SDK wraps this bridge so
   you work with clean async functions instead of raw messages.
3. **Manifest-driven loading** -- the host reads each plugin's `manifest.json`
   to determine which entry points to load, what permissions to grant, and where
   to render UI.
4. **GitHub-based registry** -- plugins are distributed as GitHub repositories
   tagged with `notesaner-plugin`. The built-in plugin browser discovers and
   installs them from GitHub releases.

### Built-in Plugins

Notesaner ships with 11 built-in plugins that follow the exact same architecture
as third-party plugins. They live in the monorepo under `packages/plugin-*` and
serve as canonical examples:

| Plugin                | Package                    | Entry Points                  |
| --------------------- | -------------------------- | ----------------------------- |
| AI Writing Assistant  | `plugin-ai`                | Sidebar, Commands, Settings   |
| Backlinks             | `plugin-backlinks`         | Sidebar panel                 |
| Calendar              | `plugin-calendar`          | Sidebar, Standalone view      |
| Daily Notes           | `plugin-daily-notes`       | Sidebar, Commands, Settings   |
| Database Tables       | `plugin-database`          | Editor block, Standalone view |
| Excalidraw Whiteboard | `plugin-excalidraw`        | Editor block, Standalone view |
| Focus Mode            | `plugin-focus-mode`        | Commands                      |
| Knowledge Graph       | `plugin-graph`             | Standalone view, Sidebar      |
| Kanban Boards         | `plugin-kanban`            | Editor block, Standalone view |
| PDF/DOCX Export       | `plugin-pdf-export`        | Commands, View                |
| Slides Presentation   | `plugin-slides`            | Commands, View                |
| Spaced Repetition     | `plugin-spaced-repetition` | View, Commands, Sidebar       |
| Templates             | `plugin-templates`         | Commands, Modal               |
| Web Clipper           | `plugin-web-clipper`       | Commands                      |

---

## 2. Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Basic TypeScript knowledge
- Familiarity with React (for UI-based plugins)

### Scaffold a New Plugin

The fastest way to start is to copy the structure of an existing built-in plugin
and modify it. For a minimal plugin:

```bash
mkdir -p my-plugin/src
cd my-plugin
```

Create the following files:

#### `package.json`

```json
{
  "name": "@notesaner/plugin-my-plugin",
  "version": "1.0.0",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch"
  },
  "peerDependencies": {
    "@notesaner/plugin-sdk": "^0.x"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsup": "^8.0.0"
  }
}
```

#### `src/manifest.json`

```json
{
  "id": "mypublisher.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A short, clear description of what the plugin does.",
  "main": "dist/index.js",
  "repository": "your-github-user/notesaner-plugin-my-plugin",
  "minAppVersion": "1.0.0",
  "permissions": ["storage:notes-read", "ui:register-command", "ui:show-notice"],
  "tags": ["notesaner-plugin", "productivity"],
  "entryPoints": {
    "commands": "dist/index.js"
  }
}
```

#### `src/index.ts`

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export const PLUGIN_ID = 'my-plugin';

export function activate(ctx: PluginContext): void {
  ctx.workspace.registerCommand({
    id: 'my-plugin.hello',
    name: 'My Plugin: Say Hello',
    callback: () => {
      ctx.ui.showNotice('Hello from My Plugin!');
    },
  });
}

export function deactivate(): void {
  // Clean up resources, timers, subscriptions, etc.
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### Project Structure

A well-organized plugin follows this layout:

```
my-plugin/
├── src/
│   ├── index.ts              # Plugin entry point (activate/deactivate)
│   ├── manifest.json         # Plugin metadata & permissions
│   ├── my-store.ts           # Zustand store (if stateful)
│   ├── MyComponent.tsx       # React UI components
│   ├── my-utils.ts           # Pure utility functions
│   ├── sandbox-root.ts       # iframe bootstrap (for sidebar/view plugins)
│   └── __tests__/
│       ├── setup.ts          # Test setup
│       └── my-utils.test.ts  # Unit tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── project.json              # NX project config (if in monorepo)
```

### Build and Test

```bash
# Build the plugin
pnpm build

# Run tests
pnpm vitest run

# Watch mode during development
pnpm dev
```

### Adding to the Notesaner Monorepo (Built-in Plugins)

If developing a built-in plugin within the monorepo:

```bash
# Create the package directory
mkdir -p packages/plugin-my-plugin/src

# Create NX project.json
cat > packages/plugin-my-plugin/project.json << 'EOF'
{
  "name": "plugin-my-plugin",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/plugin-my-plugin/src",
  "projectType": "library",
  "targets": {
    "type-check": {
      "command": "tsc --noEmit -p packages/plugin-my-plugin/tsconfig.json"
    }
  },
  "tags": ["scope:plugin"]
}
EOF

# Build and test with NX
pnpm nx build plugin-my-plugin
pnpm nx test plugin-my-plugin
```

---

## 3. Plugin SDK API

The Plugin SDK (`@notesaner/plugin-sdk`) provides a `PluginContext` object that
is passed to your `activate()` function. This context is your gateway to every
host capability.

### PluginContext

The top-level context object groups related APIs into namespaces:

```typescript
interface PluginContext {
  editor: EditorAPI;
  workspace: WorkspaceAPI;
  storage: StorageAPI;
  settings: SettingsAPI;
  events: EventsAPI;
  notes: NotesAPI;
  ui: UIAPI;
}
```

### Editor API

Register editor extensions, custom node views, and markdown serializers.

```typescript
interface EditorAPI {
  /**
   * Register a TipTap editor extension.
   * Use this to add custom marks, nodes, or plugins to the editor.
   */
  registerExtension(extension: TipTapExtension): void;

  /**
   * Register a React component as a node view for a custom node type.
   * The component receives the node's attributes as props.
   */
  registerNodeView(name: string, component: React.FC): void;

  /**
   * Register a custom markdown serializer for a node type.
   * Controls how your custom nodes are converted to/from markdown.
   */
  registerMarkdownSerializer(name: string, serializer: MarkdownSerializer): void;

  /**
   * Insert a block of the given type at the current cursor position.
   */
  insertBlock(type: string, attrs: Record<string, unknown>): void;
}
```

**Example -- registering a custom block:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.editor.registerExtension(MyCustomNode);

  ctx.editor.registerNodeView('my-custom-block', MyBlockComponent);

  ctx.editor.registerMarkdownSerializer('my-custom-block', {
    serialize: (node) => `:::my-block\n${node.textContent}\n:::\n`,
    parse: (token) => ({ type: 'my-custom-block', content: token.content }),
  });
}
```

### Workspace API

Register commands, views, sidebar panels, and keyboard shortcuts.

```typescript
interface WorkspaceAPI {
  /**
   * Register a standalone view accessible via a workspace tab.
   */
  registerView(id: string, component: React.FC, options: ViewOptions): void;

  /**
   * Register a panel in the sidebar.
   */
  registerSidebarPanel(id: string, component: React.FC): void;

  /**
   * Register an item in the status bar.
   */
  registerStatusBarItem(component: React.FC): void;

  /**
   * Register a command in the command palette.
   */
  registerCommand(command: Command): void;

  /**
   * Register a keyboard shortcut.
   */
  registerKeybinding(keybinding: Keybinding): void;
}
```

**Command interface:**

```typescript
interface Command {
  /** Unique command ID, namespaced by plugin. */
  id: string;
  /** Human-readable name shown in the command palette. */
  name: string;
  /** Optional keyboard shortcut (e.g. 'Cmd+Shift+D'). */
  hotkey?: string;
  /** Function to execute when the command is invoked. */
  callback: () => void | Promise<void>;
}
```

### Storage API

Persistent key-value storage scoped to your plugin.

```typescript
interface StorageAPI {
  /** Retrieve a value by key. Returns undefined if not set. */
  get(key: string): Promise<unknown>;

  /** Store a value. Values are serialized as JSON. */
  set(key: string, value: unknown): Promise<void>;

  /** Delete a stored value. */
  delete(key: string): Promise<void>;
}
```

**Example:**

```typescript
// Save user preferences
await ctx.storage.set('theme', 'dark');

// Retrieve later
const theme = await ctx.storage.get('theme'); // 'dark'
```

### Settings API

Declare and read plugin settings with a JSON schema.

```typescript
interface SettingsAPI {
  /**
   * Register a settings schema.
   * The host generates a settings page from this schema.
   */
  register(schema: SettingsSchema): void;

  /** Get the current value of a setting. */
  get(key: string): unknown;

  /** Subscribe to changes on a specific setting key. */
  onChange(key: string, callback: (value: unknown) => void): void;
}
```

Settings schemas are declared in `manifest.json` (see
[Manifest Reference](#manifest-reference)) and rendered by the host as native
settings UI.

### Events API

Subscribe to and emit events.

```typescript
interface EventsAPI {
  /** Subscribe to a plugin or host event. */
  on(event: PluginEvent, handler: EventHandler): void;

  /** Unsubscribe from an event. */
  off(event: PluginEvent, handler: EventHandler): void;

  /** Emit a custom event (other plugins can listen for it). */
  emit(event: string, data: unknown): void;
}
```

See [Section 6: Events](#6-events) for the full list of subscribable events.

### Notes API

Read and write notes in the workspace.

```typescript
interface NotesAPI {
  /** Get the currently active (focused) note, or null. */
  getActive(): NoteDto | null;

  /** Fetch a note by ID. */
  getById(id: string): Promise<NoteDto>;

  /** Search notes by query string. */
  search(query: string): Promise<NoteDto[]>;

  /** Create a new note. */
  create(options: CreateNoteOptions): Promise<NoteDto>;

  /** Update the content of an existing note. */
  update(id: string, content: string): Promise<void>;
}
```

See [Section 5: Data Access](#5-data-access) for details.

### UI API

Show notices, modals, and ribbon icons.

```typescript
interface UIAPI {
  /** Show a temporary notification. */
  showNotice(message: string, options?: NoticeOptions): void;

  /** Show a modal dialog with a custom React component. */
  showModal(component: React.FC, options?: ModalOptions): void;

  /** Add an icon to the ribbon (left vertical toolbar). */
  registerRibbonIcon(icon: string, title: string, onClick: () => void): void;
}
```

---

## 4. UI Integration

### Iframe Sandbox Model

Every plugin's UI runs inside an iframe with the `sandbox` attribute set:

```html
<iframe sandbox="allow-scripts allow-same-origin" src="..." title="Plugin: My Plugin" />
```

This means your plugin code cannot:

- Access the host page's DOM
- Navigate the top-level window
- Open popups
- Access cookies from other origins

All interaction with the host happens through the **postMessage protocol**.

### postMessage Protocol

The Plugin SDK abstracts the raw `postMessage` calls, but understanding the
protocol is useful for debugging.

**Message format (plugin to host):**

```typescript
interface PluginMessage {
  type: 'plugin-request';
  pluginId: string;
  requestId: string;
  method: string; // e.g. 'notes.getActive', 'ui.showNotice'
  params: unknown[];
}
```

**Message format (host to plugin):**

```typescript
interface HostMessage {
  type: 'plugin-response';
  requestId: string;
  result?: unknown;
  error?: { code: string; message: string };
}

interface HostEvent {
  type: 'plugin-event';
  event: string;
  data: unknown;
}
```

### Rendering UI in Sidebar Panels

To render a React component in the sidebar, create a sandbox root module that
bootstraps your component when the iframe loads:

```typescript
// src/sandbox-root.ts
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { MySidebarPanel } from './MySidebarPanel';

export function createPanelElement(ctx: PluginContext): HTMLElement {
  const container = document.createElement('div');
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(createElement(MySidebarPanel, { ctx }));
  return container;
}
```

This pattern is used by the built-in Daily Notes plugin
(`packages/plugin-daily-notes/src/sandbox-root.ts`).

### Rendering Views

Standalone views occupy the main content area. Register them during activation:

```typescript
export function activate(ctx: PluginContext): void {
  ctx.workspace.registerView('my-view', MyViewComponent, {
    title: 'My View',
    icon: 'layout-grid',
  });

  ctx.workspace.registerCommand({
    id: 'my-plugin.open-view',
    name: 'Open My View',
    callback: () => {
      // Host opens the registered view
    },
  });
}
```

### Showing Modals

Modals are useful for one-off dialogs like template pickers, export settings,
or confirmation prompts:

```typescript
ctx.ui.showModal(MyModalComponent, {
  title: 'Export Settings',
  width: 640,
  height: 480,
});
```

The Templates plugin (`packages/plugin-templates`) demonstrates a sophisticated
modal flow with the `TemplateManager` and `TemplatePicker` components.

### CSS Injection

Plugins can inject styles into their iframe for component styling. For
host-level effects (like Zen Mode), use the CSS injection pattern from the
Focus Mode plugin:

```typescript
// Inject a <style> tag with a unique ID for idempotent apply/remove
function applyStyles(): void {
  if (document.getElementById('my-plugin-styles')) return;
  const style = document.createElement('style');
  style.id = 'my-plugin-styles';
  style.textContent = `/* your CSS here */`;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById('my-plugin-styles')?.remove();
}
```

---

## 5. Data Access

### Reading Notes

The `notes` API provides read access to workspace notes.

**Get the currently active note:**

```typescript
const note = ctx.notes.getActive();
if (note) {
  console.log(note.title, note.content);
}
```

**Fetch a specific note by ID:**

```typescript
const note = await ctx.notes.getById('note-abc123');
```

**Search notes:**

```typescript
const results = await ctx.notes.search('meeting agenda');
for (const note of results) {
  console.log(note.title, note.id);
}
```

### Writing Notes

**Create a new note:**

```typescript
const newNote = await ctx.notes.create({
  title: 'My New Note',
  content: '# My New Note\n\nContent goes here.',
  folder: 'Daily Notes', // Optional folder path
});
```

**Update an existing note:**

```typescript
await ctx.notes.update(note.id, '# Updated Title\n\nNew content.');
```

### NoteDto Structure

```typescript
interface NoteDto {
  id: string;
  title: string;
  content: string; // Raw markdown content
  folder: string; // Folder path relative to workspace root
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  tags: string[];
  backlinks: string[]; // IDs of notes linking to this one
}
```

### Plugin-Scoped Storage

For plugin-specific data that does not belong in notes (preferences, caches,
computed state), use the storage API:

```typescript
// Save complex data
await ctx.storage.set('card-schedule', {
  cardId: 'abc',
  nextReview: '2026-04-01',
  easeFactor: 2.5,
});

// Retrieve it
const schedule = await ctx.storage.get('card-schedule');
```

Storage is scoped to the plugin ID -- two plugins cannot read each other's data.

### Accessing Workspace Metadata

Plugins can access workspace information through the notes API. To list folders
or tags, search for notes and aggregate:

```typescript
const allNotes = await ctx.notes.search('');
const folders = [...new Set(allNotes.map((n) => n.folder))];
const tags = [...new Set(allNotes.flatMap((n) => n.tags))];
```

### Permissions

Data access is gated by permissions declared in `manifest.json`. If your plugin
tries to call an API that requires a permission it did not declare, the host
will reject the request with an error.

| Permission            | Grants                                  |
| --------------------- | --------------------------------------- |
| `storage:notes-read`  | Read note content and metadata          |
| `storage:notes-write` | Create and update notes                 |
| `storage:files-write` | Upload images and attachments           |
| `storage:local`       | Use the plugin-scoped key-value storage |
| `network:fetch`       | Make HTTP requests to allowed origins   |
| `network:external`    | Make HTTP requests to any origin        |

---

## 6. Events

### Subscribable Events

The events API lets your plugin react to changes in the workspace.

| Event                      | Data                                                     | Description                             |
| -------------------------- | -------------------------------------------------------- | --------------------------------------- |
| `note:opened`              | `{ noteId: string }`                                     | A note was opened in the editor         |
| `note:closed`              | `{ noteId: string }`                                     | A note was closed                       |
| `note:changed`             | `{ noteId: string, content: string }`                    | Note content changed                    |
| `note:created`             | `{ noteId: string, title: string }`                      | A new note was created                  |
| `note:deleted`             | `{ noteId: string }`                                     | A note was deleted                      |
| `note:renamed`             | `{ noteId: string, oldTitle: string, newTitle: string }` | A note was renamed                      |
| `workspace:ready`          | `{}`                                                     | The workspace has finished initializing |
| `workspace:focus`          | `{}`                                                     | The window regained focus               |
| `workspace:blur`           | `{}`                                                     | The window lost focus                   |
| `editor:selection-changed` | `{ from: number, to: number }`                           | Text selection changed                  |
| `settings:changed`         | `{ key: string, value: unknown }`                        | A setting value was updated             |

**Example -- reacting to note changes:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.events.on('note:changed', (data) => {
    // Re-parse flashcards when the note content changes
    const cards = parseCardsFromMarkdown(data.content);
    updateDueCards(cards);
  });
}
```

### Lifecycle Hooks

Plugins have two lifecycle entry points:

```typescript
/**
 * Called when the plugin is loaded and the PluginContext is ready.
 * Register all commands, views, extensions, and event listeners here.
 */
export function activate(ctx: PluginContext): void {
  /* ... */
}

/**
 * Called when the plugin is being disabled or uninstalled.
 * Clean up timers, subscriptions, DOM mutations, etc.
 */
export function deactivate(): void {
  /* ... */
}
```

The lifecycle flow:

```
Plugin installed / enabled
         |
         v
    activate(ctx)
    - Register commands, views, extensions
    - Subscribe to events
    - Load saved state
         |
         v
    RUNTIME (plugin responds to events, user interactions)
         |
         v
    deactivate()
    - Unsubscribe from events
    - Clear timers / intervals
    - Persist unsaved state
         |
         v
Plugin disabled / uninstalled
```

### Custom Events

Plugins can emit custom events that other plugins can listen for. Namespace
your events with your plugin ID to avoid collisions:

```typescript
// Plugin A emits
ctx.events.emit('my-plugin:data-updated', { count: 42 });

// Plugin B subscribes
ctx.events.on('my-plugin:data-updated', (data) => {
  console.log('Data updated:', data.count);
});
```

---

## 7. Publishing

### GitHub-Based Registry

Notesaner plugins are discovered through GitHub repositories. The built-in
plugin browser searches for repositories tagged with `notesaner-plugin`.

### Prepare Your Repository

1. **Create a public GitHub repository** for your plugin.

2. **Add the `notesaner-plugin` topic** to the repository (Settings -> Topics).

3. **Include a `manifest.json`** at the repository root (or in your build
   output) with all required fields.

4. **Create a GitHub Release** with your built assets attached.

### Manifest Requirements

Every published plugin must include a valid `manifest.json`:

```json
{
  "id": "yourname.plugin-name",
  "name": "Human-Readable Name",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Clear description in one or two sentences.",
  "main": "dist/index.js",
  "repository": "your-github-user/notesaner-plugin-name",
  "minAppVersion": "1.0.0",
  "permissions": [],
  "tags": ["notesaner-plugin"],
  "entryPoints": {}
}
```

**Required fields:**

| Field           | Type       | Description                                      |
| --------------- | ---------- | ------------------------------------------------ |
| `id`            | `string`   | Globally unique ID in `publisher.name` format    |
| `name`          | `string`   | Human-readable display name                      |
| `version`       | `string`   | Semantic version (e.g. `1.2.3`)                  |
| `author`        | `string`   | Author name or organization                      |
| `description`   | `string`   | Short description (shown in plugin browser)      |
| `main`          | `string`   | Path to the main JavaScript bundle               |
| `repository`    | `string`   | GitHub repository in `owner/repo` format         |
| `minAppVersion` | `string`   | Minimum Notesaner version required               |
| `permissions`   | `string[]` | List of required permissions                     |
| `tags`          | `string[]` | Discovery tags (must include `notesaner-plugin`) |
| `entryPoints`   | `object`   | Map of entry point types to file paths           |

**Optional fields:**

| Field            | Type                 | Description                       |
| ---------------- | -------------------- | --------------------------------- |
| `styles`         | `string`             | Path to a CSS file to load        |
| `settings`       | `string` or `object` | Settings schema (path or inline)  |
| `settingsSchema` | `object`             | Inline settings schema definition |

### Entry Points

The `entryPoints` object tells the host which capabilities your plugin provides:

| Key               | Description                    |
| ----------------- | ------------------------------ |
| `commands`        | Command palette entries        |
| `sidebarPanel`    | Panel in the left sidebar      |
| `settingsPage`    | Custom settings UI             |
| `view`            | Standalone view / tab          |
| `modal`           | Modal dialog                   |
| `editorExtension` | TipTap editor extension        |
| `sidebar`         | Sidebar item (badge/indicator) |

### Settings Schema

Declare settings in your `manifest.json` for automatic settings UI generation:

```json
{
  "settings": {
    "apiKey": {
      "type": "string",
      "default": "",
      "secret": true,
      "description": "API key for external service"
    },
    "autoSave": {
      "type": "boolean",
      "default": true,
      "description": "Automatically save changes"
    },
    "fontSize": {
      "type": "number",
      "default": 14,
      "minimum": 8,
      "maximum": 36,
      "description": "Base font size in pixels"
    },
    "theme": {
      "type": "string",
      "enum": ["light", "dark", "system"],
      "default": "system",
      "description": "Color theme preference"
    }
  }
}
```

### Release Checklist

Before publishing a release:

- [ ] `manifest.json` has correct version and `minAppVersion`
- [ ] All permissions are declared (no undeclared API calls)
- [ ] Built assets are included in the release
- [ ] `README.md` describes what the plugin does and how to use it
- [ ] Repository has the `notesaner-plugin` topic
- [ ] Plugin has been tested against the target `minAppVersion`

### Versioning

Follow semantic versioning:

- **Patch** (`1.0.1`) -- bug fixes, no API changes
- **Minor** (`1.1.0`) -- new features, backward compatible
- **Major** (`2.0.0`) -- breaking changes to settings or behavior

### Plugin Discovery API

Users discover plugins through the built-in browser. The server queries GitHub:

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

---

## 8. Examples

This section walks through three built-in plugins of increasing complexity to
demonstrate real-world plugin patterns.

### Example 1: Focus Mode (Commands + CSS Injection)

**What it does:** Provides "Zen Mode" and "Typewriter Scrolling" for
distraction-free writing.

**Source:** `packages/plugin-focus-mode/`

**Complexity:** Low -- no persistent state, no sidebar, just commands and DOM
manipulation.

#### Manifest

```json
{
  "id": "notesaner.focus-mode",
  "permissions": ["ui:register-command", "ui:show-notice"],
  "entryPoints": {
    "commands": "dist/index.js"
  }
}
```

#### Key Patterns

**1. CSS injection for Zen Mode** (`src/zen-mode.ts`)

The plugin injects a `<style>` tag with a unique ID and uses a `data-*`
attribute on `<html>` to activate the styles. This is idempotent -- calling
`applyZenMode()` multiple times is safe.

```typescript
const STYLE_TAG_ID = 'notesaner-zen-mode-styles';
const HTML_ATTRIBUTE = 'data-zen-mode';

export function applyZenMode(maxWidth: number = 680): void {
  if (!document.getElementById(STYLE_TAG_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    style.textContent = buildZenCss(maxWidth);
    document.head.appendChild(style);
  }
  document.documentElement.setAttribute(HTML_ATTRIBUTE, '');
}

export function removeZenMode(): void {
  document.documentElement.removeAttribute(HTML_ATTRIBUTE);
  document.getElementById(STYLE_TAG_ID)?.remove();
}
```

The CSS hides all workspace chrome (`[data-sidebar]`, `nav`, `aside`, etc.)
and constrains the prose to a readable 680px column.

**2. Typewriter scrolling class** (`src/typewriter.ts`)

A self-contained class that attaches to the editor element and keeps the cursor
vertically centered:

```typescript
const scroller = new TypewriterScroller({ verticalOffset: 0.45 });
scroller.attach(editorEl, scrollEl);

// When done:
scroller.detach();
```

The `TypewriterScroller` listens for `selectionchange` events and smoothly
scrolls the container using `requestAnimationFrame`.

**Takeaway:** Even a simple plugin benefits from clean separation --
`zen-mode.ts` handles CSS, `typewriter.ts` handles scroll behavior, and
`index.ts` wires them into commands.

---

### Example 2: Daily Notes (Sidebar + Commands + Settings)

**What it does:** Creates and navigates date-based notes with daily, weekly,
and monthly periodicity. Includes a mini-calendar sidebar panel.

**Source:** `packages/plugin-daily-notes/`

**Complexity:** Medium -- Zustand store, settings schema, sidebar panel, and
date utilities.

#### Manifest (key parts)

```json
{
  "id": "notesaner.daily-notes",
  "permissions": [
    "storage:notes-read",
    "storage:notes-write",
    "ui:register-sidebar",
    "ui:register-command",
    "ui:show-notice"
  ],
  "entryPoints": {
    "sidebarPanel": "dist/index.js",
    "settingsPage": "dist/index.js",
    "commands": "dist/index.js"
  },
  "settings": {
    "autoCreate": {
      "type": "boolean",
      "default": false,
      "description": "Automatically open today's daily note on startup."
    },
    "nameFormat": {
      "type": "string",
      "default": "YYYY-MM-DD",
      "description": "Filename format. Tokens: YYYY, YY, MM, DD, ddd, dddd."
    },
    "folder": {
      "type": "string",
      "default": "Daily Notes",
      "description": "Folder for daily notes."
    }
  }
}
```

#### Key Patterns

**1. Zustand store for UI state** (`src/daily-notes-store.ts`)

The store holds navigation state (current date), settings, and transient flags.
Business logic lives in pure utility functions, not in the store itself:

```typescript
export const useDailyNotesStore = create<DailyNotesState>()((set) => ({
  currentDate: new Date(),
  today: new Date(),
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  error: null,

  goToToday: () => set({ currentDate: new Date() }),
  goToPrevDay: () =>
    set((state) => ({
      currentDate: addDays(state.currentDate, -1),
    })),
  // ...
}));
```

**2. Pure date utilities** (`src/date-utils.ts`)

All date formatting and navigation logic is in pure, side-effect-free functions:

```typescript
export function formatDate(date: Date, format: string): string {
  // Replaces YYYY, MM, DD, ww, ddd, dddd tokens
}

export function buildMonthGrid(year: number, month: number): CalendarGridDay[][] {
  // Returns a 6x7 grid for rendering a calendar
}
```

**3. Sidebar panel bootstrap** (`src/sandbox-root.ts`)

The sidebar component is lazily mounted in the iframe:

```typescript
export function createDailyNotesPanelElement(ctx: PluginContext): HTMLElement {
  const container = document.createElement('div');
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(createElement(DailyNotesPanel, { ctx }));
  return container;
}
```

**Takeaway:** Separate concerns aggressively. Pure date math, Zustand state
management, React UI rendering, and iframe bootstrapping each live in their own
module.

---

### Example 3: Templates (Commands + Modal + Store + Engine)

**What it does:** Create notes from templates with `{{variable}}` substitution,
conditional blocks, 8 built-in templates, custom templates, per-folder defaults,
and a slash-command trigger system.

**Source:** `packages/plugin-templates/`

**Complexity:** High -- template engine, YAML parser, Zustand CRUD store, React
modal UI, import/export.

#### Manifest (key parts)

```json
{
  "id": "notesaner.templates",
  "permissions": [
    "storage:notes-read",
    "storage:notes-write",
    "ui:register-command",
    "ui:register-modal",
    "ui:show-notice"
  ],
  "entryPoints": {
    "commands": "dist/index.js",
    "modal": "dist/index.js"
  }
}
```

#### Architecture

```
src/
├── index.ts                  # PLUGIN_ID export
├── template-engine.ts        # {{variable}} rendering, conditionals
├── template-parser.ts        # YAML frontmatter parser
├── template-store.ts         # Zustand CRUD store
├── built-in-templates.ts     # 8 built-in template definitions
├── TemplateManager.tsx        # CRUD dialog for templates
├── TemplatePicker.tsx         # Selection dialog with search
├── TemplatePreview.tsx        # Live preview of selected template
└── TemplateSettings.tsx       # Per-folder default configuration
```

#### Key Patterns

**1. Template engine with conditionals** (`src/template-engine.ts`)

The engine supports `{{variable}}` substitution and `{{#if var}}...{{else}}...{{/if}}`
conditional blocks with arbitrary nesting:

```typescript
import { renderTemplate } from './template-engine';

const result = renderTemplate(
  '# {{title}}\n\n{{#if mood}}Mood: {{mood}}{{else}}No mood set{{/if}}',
  {
    title: 'My Note',
    variables: { mood: 'Happy' },
  },
);

// result.content = "# My Note\n\nMood: Happy"
// result.cursorOffset = undefined (no {{cursor}} in template)
// result.unresolvedVariables = []
```

The `{{cursor}}` placeholder is replaced with an empty string, and its position
is returned as `cursorOffset` so the host can set the editor cursor there.

**2. Zustand store with CRUD operations** (`src/template-store.ts`)

The store manages built-in and user-created templates with full CRUD, picker
state, search filtering, and folder-based defaults:

```typescript
const store = useTemplateStore.getState();

// Add a user template
store.addTemplate({ id: 'user:my-template', meta, body });

// Open the picker with folder context (auto-selects folder default)
store.openPicker({
  noteTitle: 'New Note',
  folderPath: 'Daily Notes',
  onApply: (templateId, variables) => {
    /* apply template */
  },
});

// Get filtered templates matching search
const filtered = store.getFilteredTemplates();
```

**3. Built-in template registry** (`src/built-in-templates.ts`)

Templates are defined as typed objects with metadata, trigger strings, and
body content:

```typescript
const DAILY_NOTE: BuiltInTemplate = {
  id: 'built-in:daily-note',
  meta: {
    name: 'Daily Note',
    description: 'Daily journaling template.',
    folderDefault: 'Daily Notes',
    trigger: '/daily',
    tags: ['journal', 'daily'],
    variables: [{ name: 'mood', description: 'How are you feeling?', default: '' }],
  },
  body: `# {{date}} — Daily Note
**Mood:** {{#if mood}}{{mood}}{{else}}—{{/if}}
## Morning Intentions
- [ ] {{cursor}}
`,
};
```

**4. YAML frontmatter parser** (`src/template-parser.ts`)

A minimal YAML parser handles template file import/export without requiring a
full YAML library as a dependency:

```typescript
import { parseTemplateFile, serializeTemplate } from './template-parser';

const { meta, body, hasFrontmatter } = parseTemplateFile(fileContent);

const serialized = serializeTemplate(meta, body);
// Returns markdown with YAML frontmatter block
```

**Takeaway:** Complex plugins benefit from a clear layered architecture. The
template engine is pure (no React, no DOM). The store manages state but does not
do I/O. The React components consume the store and call the engine. Each layer
is independently testable.

---

## 9. Best Practices

### Performance

1. **Lazy load heavy modules.** Only import what you need at activation time.
   Use dynamic `import()` for large dependencies (React components, charting
   libraries, etc.).

   ```typescript
   // Sidebar component loaded on demand
   export async function activate(ctx: PluginContext): Promise<void> {
     ctx.workspace.registerSidebarPanel('my-panel', () => {
       const { createPanelElement } = await import('./sandbox-root');
       return createPanelElement(ctx);
     });
   }
   ```

2. **Debounce event handlers.** Events like `note:changed` and
   `editor:selection-changed` fire frequently. Debounce or throttle your
   handlers to avoid blocking the UI.

3. **Keep stores lean.** Zustand stores should hold UI state and derived values.
   Heavy computation belongs in utility functions called only when needed.

4. **Minimize bundle size.** Use tree-shakeable imports. Avoid pulling in large
   libraries when a focused utility will do. The built-in plugins demonstrate
   this -- `plugin-daily-notes` implements date math without `date-fns` or
   `dayjs`, and `plugin-templates` includes a minimal YAML parser instead of
   depending on `js-yaml`.

### Security

1. **Declare only the permissions you need.** Users see requested permissions
   before installing. Over-requesting erodes trust.

2. **Never store secrets in plain text.** Use the `"secret": true` flag in
   settings schemas for API keys. The host encrypts these values at rest.

3. **Sanitize user input.** If your plugin renders HTML from note content or
   user input, sanitize it to prevent XSS. The iframe sandbox provides a layer
   of defense, but defense in depth is always better.

4. **Validate data at boundaries.** Use Zod or manual checks for data received
   via `postMessage`, from storage, or from external APIs.

5. **Avoid `network:external` when possible.** Use `network:fetch` with specific
   allowed origins if your plugin only needs to contact known APIs.

### Error Handling

1. **Wrap async operations in try/catch.** API calls to the host can fail
   (permission denied, note not found, network error). Always handle errors
   gracefully.

   ```typescript
   try {
     const note = await ctx.notes.getById(noteId);
   } catch (error) {
     ctx.ui.showNotice(`Failed to load note: ${error.message}`);
   }
   ```

2. **Use loading and error state in stores.** The built-in plugins consistently
   use `isLoading` and `error` fields in their Zustand stores:

   ```typescript
   interface MyState {
     isLoading: boolean;
     error: string | null;
     setLoading: (loading: boolean) => void;
     setError: (error: string | null) => void;
   }
   ```

3. **Show user-friendly error notices.** Avoid raw error messages. Provide
   actionable guidance when possible.

4. **Log errors for debugging.** Use `console.error()` with enough context to
   diagnose issues in the browser DevTools.

### Testing

1. **Test business logic separately from UI.** The template engine, card parser,
   date utilities, and filter logic are all tested independently of React.

2. **Use Vitest.** All built-in plugins use Vitest for unit testing:

   ```typescript
   // vitest.config.ts
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       environment: 'jsdom',
       globals: true,
     },
   });
   ```

3. **Test edge cases.** The built-in plugins test malformed input, empty state,
   and boundary conditions. See `packages/plugin-templates/src/__tests__/` and
   `packages/plugin-daily-notes/src/__tests__/` for examples.

### Code Organization

1. **One concern per file.** Separate stores, engines, parsers, utilities, and
   components into their own modules.

2. **Pure functions over methods.** Keep business logic in pure functions
   (like `renderTemplate()`, `parseCardsFromMarkdown()`, `formatDate()`) that
   are easy to test and reuse.

3. **Type everything.** Use TypeScript strict mode. Export types from your
   public API so consumers get full IntelliSense.

4. **Use barrel exports.** Re-export your public API from `src/index.ts`:

   ```typescript
   export { PLUGIN_ID } from './constants';
   export { renderTemplate } from './template-engine';
   export type { RenderResult, RenderContext } from './template-engine';
   ```

---

## 10. API Reference

### Manifest Reference

#### `manifest.json` Schema

```typescript
interface PluginManifest {
  /** Globally unique plugin ID (format: publisher.name). */
  id: string;

  /** Human-readable plugin name. */
  name: string;

  /** Semantic version string. */
  version: string;

  /** Author name or organization. */
  author: string;

  /** Short description (one or two sentences). */
  description: string;

  /** Path to the main JavaScript bundle (relative to package root). */
  main: string;

  /** GitHub repository in owner/repo format. */
  repository: string;

  /** Minimum Notesaner version required to run this plugin. */
  minAppVersion: string;

  /** List of required permissions. */
  permissions: Permission[];

  /** Discovery and categorization tags. */
  tags: string[];

  /** Map of entry point types to JavaScript file paths. */
  entryPoints: {
    commands?: string;
    sidebarPanel?: string;
    settingsPage?: string;
    view?: string;
    modal?: string;
    editorExtension?: string;
    sidebar?: string;
  };

  /** Path to a CSS file to load alongside the plugin. */
  styles?: string;

  /** Settings schema (inline object or path to JSON schema file). */
  settings?: string | Record<string, SettingDefinition>;

  /** Inline settings schema (alternative to settings field). */
  settingsSchema?: Record<string, SettingDefinition>;
}
```

#### Permission Values

| Permission                 | Description                              |
| -------------------------- | ---------------------------------------- |
| `storage:notes-read`       | Read note content and metadata           |
| `storage:notes-write`      | Create, update, and delete notes         |
| `storage:files-write`      | Upload images and file attachments       |
| `storage:local`            | Use plugin-scoped key-value storage      |
| `ui:register-command`      | Register commands in the command palette |
| `ui:register-sidebar`      | Register a sidebar panel                 |
| `ui:register-sidebar-item` | Register a sidebar badge/indicator       |
| `ui:register-view`         | Register a standalone workspace view     |
| `ui:register-modal`        | Open modal dialogs                       |
| `ui:show-notice`           | Show notification toasts                 |
| `ui:show-modal`            | Show modal dialogs (alternative name)    |
| `editor:insert-block`      | Insert blocks into the editor            |
| `network:fetch`            | Make HTTP requests to allowed origins    |
| `network:external`         | Make HTTP requests to any origin         |

#### Setting Definition Schema

```typescript
interface SettingDefinition {
  /** Value type. */
  type: 'string' | 'number' | 'boolean';

  /** Default value. */
  default: string | number | boolean;

  /** Human-readable description. */
  description: string;

  /** For string type: allowed values (rendered as a dropdown). */
  enum?: string[];

  /** For number type: minimum allowed value. */
  minimum?: number;

  /** For number type: maximum allowed value. */
  maximum?: number;

  /** For string type: marks the value as sensitive (encrypted at rest). */
  secret?: boolean;
}
```

### Plugin SDK Exports

```typescript
// @notesaner/plugin-sdk

/** Current SDK version. */
export const PLUGIN_SDK_VERSION: string;

/** The context object passed to activate(). */
export interface PluginContext {
  editor: EditorAPI;
  workspace: WorkspaceAPI;
  storage: StorageAPI;
  settings: SettingsAPI;
  events: EventsAPI;
  notes: NotesAPI;
  ui: UIAPI;
}
```

### EditorAPI

| Method                       | Parameters                                     | Returns | Description                        |
| ---------------------------- | ---------------------------------------------- | ------- | ---------------------------------- |
| `registerExtension`          | `extension: TipTapExtension`                   | `void`  | Register a TipTap editor extension |
| `registerNodeView`           | `name: string, component: React.FC`            | `void`  | Register a custom node view        |
| `registerMarkdownSerializer` | `name: string, serializer: MarkdownSerializer` | `void`  | Register a markdown serializer     |
| `insertBlock`                | `type: string, attrs: Record<string, unknown>` | `void`  | Insert a block at cursor           |

### WorkspaceAPI

| Method                  | Parameters                                              | Returns | Description                  |
| ----------------------- | ------------------------------------------------------- | ------- | ---------------------------- |
| `registerView`          | `id: string, component: React.FC, options: ViewOptions` | `void`  | Register a standalone view   |
| `registerSidebarPanel`  | `id: string, component: React.FC`                       | `void`  | Register a sidebar panel     |
| `registerStatusBarItem` | `component: React.FC`                                   | `void`  | Register a status bar item   |
| `registerCommand`       | `command: Command`                                      | `void`  | Register a command           |
| `registerKeybinding`    | `keybinding: Keybinding`                                | `void`  | Register a keyboard shortcut |

### StorageAPI

| Method   | Parameters                    | Returns            | Description           |
| -------- | ----------------------------- | ------------------ | --------------------- |
| `get`    | `key: string`                 | `Promise<unknown>` | Get a stored value    |
| `set`    | `key: string, value: unknown` | `Promise<void>`    | Set a stored value    |
| `delete` | `key: string`                 | `Promise<void>`    | Delete a stored value |

### SettingsAPI

| Method     | Parameters                                        | Returns   | Description                  |
| ---------- | ------------------------------------------------- | --------- | ---------------------------- |
| `register` | `schema: SettingsSchema`                          | `void`    | Register a settings schema   |
| `get`      | `key: string`                                     | `unknown` | Get a setting value          |
| `onChange` | `key: string, callback: (value: unknown) => void` | `void`    | Subscribe to setting changes |

### EventsAPI

| Method | Parameters                                  | Returns | Description               |
| ------ | ------------------------------------------- | ------- | ------------------------- |
| `on`   | `event: PluginEvent, handler: EventHandler` | `void`  | Subscribe to an event     |
| `off`  | `event: PluginEvent, handler: EventHandler` | `void`  | Unsubscribe from an event |
| `emit` | `event: string, data: unknown`              | `void`  | Emit a custom event       |

### NotesAPI

| Method      | Parameters                    | Returns              | Description         |
| ----------- | ----------------------------- | -------------------- | ------------------- |
| `getActive` | (none)                        | `NoteDto \| null`    | Get the active note |
| `getById`   | `id: string`                  | `Promise<NoteDto>`   | Get a note by ID    |
| `search`    | `query: string`               | `Promise<NoteDto[]>` | Search notes        |
| `create`    | `options: CreateNoteOptions`  | `Promise<NoteDto>`   | Create a note       |
| `update`    | `id: string, content: string` | `Promise<void>`      | Update note content |

### UIAPI

| Method               | Parameters                                         | Returns | Description         |
| -------------------- | -------------------------------------------------- | ------- | ------------------- |
| `showNotice`         | `message: string, options?: NoticeOptions`         | `void`  | Show a notification |
| `showModal`          | `component: React.FC, options?: ModalOptions`      | `void`  | Show a modal        |
| `registerRibbonIcon` | `icon: string, title: string, onClick: () => void` | `void`  | Add a ribbon icon   |

### Types

```typescript
interface NoteDto {
  id: string;
  title: string;
  content: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  backlinks: string[];
}

interface CreateNoteOptions {
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
}

interface Command {
  id: string;
  name: string;
  hotkey?: string;
  callback: () => void | Promise<void>;
}

interface Keybinding {
  keys: string;
  command: string;
}

interface ViewOptions {
  title: string;
  icon?: string;
}

interface NoticeOptions {
  duration?: number; // ms, default 4000
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ModalOptions {
  title?: string;
  width?: number;
  height?: number;
  closable?: boolean;
}

interface MarkdownSerializer {
  serialize: (node: ProseMirrorNode) => string;
  parse: (token: MarkdownToken) => ProseMirrorNodeSpec;
}
```

---

## Further Reading

- [Plugin Domain Overview](./domains/plugins.md) -- internal design document
  covering the plugin loader, sandbox, and registry
- [Architecture Overview](./architecture/overview.md) -- system-wide
  architecture and component relationships
- [API Contracts](./artifacts/wave-01-specs/05-api-contracts.md) -- REST API
  specifications including the plugin search endpoint
- Built-in plugin source code at `packages/plugin-*/` -- the best reference for
  real-world patterns
