# Notesaner Plugin Development Guide

A comprehensive reference for third-party developers building plugins for
Notesaner, the web-first note-taking platform.

## Table of Contents

- [1. Getting Started](#1-getting-started)
  - [1.1 What Is a Plugin?](#11-what-is-a-plugin)
  - [1.2 How the Sandbox Works](#12-how-the-sandbox-works)
  - [1.3 Prerequisites](#13-prerequisites)
  - [1.4 Scaffold a New Plugin](#14-scaffold-a-new-plugin)
  - [1.5 Project Structure](#15-project-structure)
- [2. Plugin Manifest Reference](#2-plugin-manifest-reference)
  - [2.1 Required Fields](#21-required-fields)
  - [2.2 Optional Fields](#22-optional-fields)
  - [2.3 Manifest Validation Rules](#23-manifest-validation-rules)
  - [2.4 Complete Manifest Example](#24-complete-manifest-example)
- [3. Plugin SDK API Documentation](#3-plugin-sdk-api-documentation)
  - [3.1 PluginContext](#31-plugincontext)
  - [3.2 EditorAPI](#32-editorapi)
  - [3.3 WorkspaceAPI](#33-workspaceapi)
  - [3.4 NotesAPI](#34-notesapi)
  - [3.5 UIAPI](#35-uiapi)
  - [3.6 EventsAPI](#36-eventsapi)
- [4. Entry Points](#4-entry-points)
  - [4.1 Commands](#41-commands)
  - [4.2 Sidebar Panel](#42-sidebar-panel)
  - [4.3 Standalone View](#43-standalone-view)
  - [4.4 Editor Extension](#44-editor-extension)
  - [4.5 Modal](#45-modal)
  - [4.6 Sidebar Item (Badge/Indicator)](#46-sidebar-item-badgeindicator)
  - [4.7 Ribbon Action](#47-ribbon-action)
  - [4.8 Settings Page](#48-settings-page)
- [5. Storage API](#5-storage-api)
  - [5.1 Plugin-Scoped Key-Value Storage](#51-plugin-scoped-key-value-storage)
  - [5.2 Reading and Writing Notes](#52-reading-and-writing-notes)
  - [5.3 File Uploads](#53-file-uploads)
- [6. Settings Schema](#6-settings-schema)
  - [6.1 Declaring Settings in the Manifest](#61-declaring-settings-in-the-manifest)
  - [6.2 Supported Setting Types](#62-supported-setting-types)
  - [6.3 Settings API at Runtime](#63-settings-api-at-runtime)
  - [6.4 Auto-Generated Settings UI](#64-auto-generated-settings-ui)
  - [6.5 Complete Settings Schema Example](#65-complete-settings-schema-example)
- [7. Example Plugin: Hello World](#7-example-plugin-hello-world)
  - [7.1 Minimal Plugin (Command Only)](#71-minimal-plugin-command-only)
  - [7.2 Plugin with Sidebar Panel](#72-plugin-with-sidebar-panel)
  - [7.3 Plugin with Settings](#73-plugin-with-settings)
  - [7.4 Plugin with View and Events](#74-plugin-with-view-and-events)
- [8. Testing Plugins in Dev Mode](#8-testing-plugins-in-dev-mode)
  - [8.1 Hot Reload](#81-hot-reload)
  - [8.2 Unit Testing with Vitest](#82-unit-testing-with-vitest)
  - [8.3 Debugging in the Browser](#83-debugging-in-the-browser)
  - [8.4 Testing in the Monorepo](#84-testing-in-the-monorepo)
- [9. Submitting to the Plugin Registry](#9-submitting-to-the-plugin-registry)
  - [9.1 Registry Architecture](#91-registry-architecture)
  - [9.2 Prepare Your Repository](#92-prepare-your-repository)
  - [9.3 Create a GitHub Release](#93-create-a-github-release)
  - [9.4 Release Checklist](#94-release-checklist)
  - [9.5 Auto-Update Mechanism](#95-auto-update-mechanism)
  - [9.6 Server-Side Installation Flow](#96-server-side-installation-flow)
- [10. SDK Version Changelog](#10-sdk-version-changelog)
- [11. Security Model and Permissions](#11-security-model-and-permissions)
  - [11.1 Iframe Sandbox](#111-iframe-sandbox)
  - [11.2 postMessage Protocol](#112-postmessage-protocol)
  - [11.3 Permission System](#113-permission-system)
  - [11.4 Permission Reference](#114-permission-reference)
  - [11.5 Network Access](#115-network-access)
  - [11.6 Secret Storage](#116-secret-storage)
  - [11.7 Asset Integrity](#117-asset-integrity)
  - [11.8 Security Best Practices](#118-security-best-practices)

---

## 1. Getting Started

### 1.1 What Is a Plugin?

A Notesaner plugin is a self-contained JavaScript package that extends the
application through a typed API. Plugins can add commands to the command palette,
render UI in the sidebar, register new editor blocks, create standalone views,
show modals, and read or write notes.

Notesaner ships with 14 built-in plugins (located at `packages/plugin-*` in the
monorepo) that use the exact same architecture as third-party plugins:

| Plugin                | Package                    | Entry Points                     |
| --------------------- | -------------------------- | -------------------------------- |
| AI Writing Assistant  | `plugin-ai`                | Sidebar, Commands, Settings      |
| Backlinks             | `plugin-backlinks`         | Sidebar panel                    |
| Calendar              | `plugin-calendar`          | View, Commands                   |
| Daily Notes           | `plugin-daily-notes`       | Sidebar, Commands, Settings      |
| Database Tables       | `plugin-database`          | Editor extension, View, Commands |
| Excalidraw Whiteboard | `plugin-excalidraw`        | Editor extension, View, Commands |
| Focus Mode            | `plugin-focus-mode`        | Commands                         |
| Knowledge Graph       | `plugin-graph`             | View, Sidebar                    |
| Kanban Boards         | `plugin-kanban`            | View, Commands                   |
| PDF/DOCX Export       | `plugin-pdf-export`        | Commands, View                   |
| Slides Presentation   | `plugin-slides`            | Commands, View                   |
| Spaced Repetition     | `plugin-spaced-repetition` | View, Commands, Sidebar          |
| Templates             | `plugin-templates`         | Commands, Modal                  |
| Web Clipper           | `plugin-web-clipper`       | Commands                         |

These built-in plugins are the canonical reference implementations. When in
doubt about patterns, consult their source code.

### 1.2 How the Sandbox Works

Every plugin runs inside its own `<iframe>` element with strict sandboxing:

```
 +-------------------------------------------+
 |         Host Application                  |
 |  (Next.js frontend / NestJS API)          |
 +-------------------------------------------+
 |        Plugin Loader                      |
 |  - Reads plugin.json manifest             |
 |  - Creates sandboxed iframe               |
 |  - Injects Plugin SDK bridge              |
 +----------+--------------------------------+
            | postMessage API
 +----------v--------------------------------+
 |    Sandboxed Plugin iframe                |
 |    +-------------------------------+      |
 |    |  Your plugin code             |      |
 |    |  @notesaner/plugin-sdk        |      |
 |    +-------------------------------+      |
 +-------------------------------------------+
```

The iframe has the following sandbox attributes:

```html
<iframe sandbox="allow-scripts allow-same-origin" src="..." title="Plugin: My Plugin" />
```

This means your plugin code **cannot**:

- Access the host page DOM directly
- Navigate the top-level window
- Open popups or new windows
- Access cookies from other origins

All interaction with the host flows through a typed **postMessage protocol**. The
Plugin SDK wraps this bridge so you work with clean async functions instead of
raw messages. See [Section 11.2](#112-postmessage-protocol) for protocol details.

### 1.3 Prerequisites

- Node.js 18+
- pnpm 10+
- TypeScript knowledge (all APIs are typed)
- React knowledge (for plugins with UI components)
- A GitHub account (for publishing to the registry)

### 1.4 Scaffold a New Plugin

Create a new directory for your plugin and initialize the project:

```bash
mkdir notesaner-plugin-hello-world
cd notesaner-plugin-hello-world
mkdir -p src
```

#### `package.json`

```json
{
  "name": "@mypublisher/notesaner-plugin-hello-world",
  "version": "1.0.0",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@notesaner/plugin-sdk": "^0.x"
  },
  "devDependencies": {
    "@notesaner/plugin-sdk": "^0.0.0",
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "vitest": "^3.0.0"
  }
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

#### `src/manifest.json`

```json
{
  "id": "mypublisher.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A minimal example plugin that registers a command.",
  "main": "dist/index.js",
  "repository": "your-github-user/notesaner-plugin-hello-world",
  "minAppVersion": "1.0.0",
  "permissions": ["ui:register-command", "ui:show-notice"],
  "tags": ["notesaner-plugin", "example"],
  "entryPoints": {
    "commands": "dist/index.js"
  }
}
```

#### `src/index.ts`

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export const PLUGIN_ID = 'hello-world';

export function activate(ctx: PluginContext): void {
  ctx.workspace.registerCommand({
    id: 'hello-world.greet',
    name: 'Hello World: Say Hello',
    callback: () => {
      ctx.ui.showNotice('Hello from my first Notesaner plugin!');
    },
  });
}

export function deactivate(): void {
  // Clean up resources, timers, subscriptions, etc.
}
```

Build and verify:

```bash
pnpm install
pnpm build
```

### 1.5 Project Structure

A well-organized plugin follows this layout:

```
my-plugin/
+-- src/
|   +-- index.ts              # Plugin entry: activate() and deactivate()
|   +-- manifest.json         # Plugin metadata, permissions, entry points
|   +-- my-store.ts           # Zustand store (for stateful plugins)
|   +-- MyComponent.tsx       # React UI components
|   +-- my-utils.ts           # Pure utility functions
|   +-- sandbox-root.ts       # iframe bootstrap (for sidebar/view plugins)
|   +-- __tests__/
|       +-- my-utils.test.ts  # Unit tests
|       +-- setup.ts          # Test setup (jsdom environment)
+-- package.json
+-- tsconfig.json
+-- vitest.config.ts
+-- plugin.json               # Built copy of manifest (in dist/ after build)
```

**Key conventions:**

- Every plugin exports a `PLUGIN_ID` constant from `src/index.ts`.
- The `activate(ctx)` function is the entry point; register all commands, views,
  and extensions here.
- The `deactivate()` function is called on disable/uninstall for cleanup.
- Business logic lives in pure utility functions, not in the store or components.
- Zustand stores hold only UI state and derived values.

---

## 2. Plugin Manifest Reference

Every plugin must include a `manifest.json` (deployed as `plugin.json` at the
package root). The server validates this file during installation.

### 2.1 Required Fields

| Field           | Type     | Description                                                                                                                                  | Example                             |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `id`            | `string` | Globally unique plugin identifier. Use reverse-domain or `publisher.name` format. Only alphanumeric, dots, hyphens, and underscores allowed. | `"mypublisher.my-plugin"`           |
| `name`          | `string` | Human-readable display name shown in the plugin browser.                                                                                     | `"My Plugin"`                       |
| `description`   | `string` | Short description (one or two sentences).                                                                                                    | `"Does amazing things with notes."` |
| `version`       | `string` | Semantic version string.                                                                                                                     | `"1.2.3"`                           |
| `minSdkVersion` | `string` | Minimum Plugin SDK version required.                                                                                                         | `"0.1.0"`                           |
| `repository`    | `string` | GitHub repository in `owner/repo` format.                                                                                                    | `"jdoe/notesaner-plugin-my-plugin"` |
| `author`        | `string` | Plugin author name or organization.                                                                                                          | `"Jane Doe"`                        |
| `main`          | `string` | Relative path to the main JavaScript bundle inside the package.                                                                              | `"dist/index.js"`                   |

**Note:** The server-side manifest parser (`apps/server/src/modules/plugins/plugin.types.ts`)
enforces that all required fields are non-empty strings. Missing or empty
required fields cause installation to fail with a `BadRequestException`.

### 2.2 Optional Fields

| Field            | Type                 | Description                                                                   |
| ---------------- | -------------------- | ----------------------------------------------------------------------------- |
| `license`        | `string`             | SPDX license identifier (e.g. `"MIT"`, `"Apache-2.0"`).                       |
| `icon`           | `string`             | Path to an icon file relative to the package root (e.g. `"icon.svg"`).        |
| `keywords`       | `string[]`           | Keywords for registry search. Must be an array of strings.                    |
| `tags`           | `string[]`           | Discovery tags. Must include `"notesaner-plugin"` for registry discovery.     |
| `configSchema`   | `object`             | Plugin configuration schema (JSON Schema format).                             |
| `permissions`    | `string[]`           | List of required permissions (see [Section 11.4](#114-permission-reference)). |
| `minAppVersion`  | `string`             | Minimum Notesaner application version required.                               |
| `entryPoints`    | `object`             | Map of entry point types to file paths (see [Section 4](#4-entry-points)).    |
| `settings`       | `object` or `string` | Inline settings schema object, or path to a JSON schema file.                 |
| `settingsSchema` | `object`             | Alternative field for inline settings schema definition.                      |
| `styles`         | `string`             | Path to a CSS file to load alongside the plugin.                              |

### 2.3 Manifest Validation Rules

The server (`GitHubReleaseService.validateManifest()`) enforces these rules:

1. The file must be valid JSON and a top-level object.
2. All required fields must be present and non-empty strings.
3. The `id` field must match `/^[a-zA-Z0-9._-]+$/` (no spaces or special characters).
4. If `keywords` is present, it must be an array of strings.
5. The manifest filename must be `plugin.json` at the package root.

Validation failures return detailed error messages explaining which field is
invalid and what format is expected.

### 2.4 Complete Manifest Example

This example is based on the built-in AI Writing Assistant plugin
(`packages/plugin-ai/src/manifest.json`):

```json
{
  "id": "notesaner.ai",
  "name": "AI Writing Assistant",
  "version": "1.0.0",
  "author": "Notesaner",
  "description": "LLM-powered writing assistance with summarization, continue writing, rewrite selection, grammar check, translation, link suggestions, and auto-tagging.",
  "main": "dist/index.js",
  "repository": "notesaner/plugin-ai",
  "minAppVersion": "1.0.0",
  "minSdkVersion": "0.0.0",
  "license": "MIT",
  "permissions": [
    "storage:notes-read",
    "storage:notes-write",
    "ui:register-sidebar",
    "ui:register-command",
    "ui:show-notice",
    "network:fetch"
  ],
  "tags": ["ai", "writing", "assistant", "llm", "summarize", "translate"],
  "entryPoints": {
    "sidebarPanel": "dist/index.js",
    "commands": "dist/index.js",
    "settingsPage": "dist/index.js"
  },
  "settingsSchema": {
    "provider": {
      "type": "string",
      "enum": ["openai", "anthropic", "ollama"],
      "default": "openai",
      "description": "LLM provider to use for AI features"
    },
    "apiKey": {
      "type": "string",
      "default": "",
      "secret": true,
      "description": "API key for the selected provider"
    },
    "model": {
      "type": "string",
      "default": "gpt-4o-mini",
      "description": "Model identifier"
    },
    "temperature": {
      "type": "number",
      "default": 0.7,
      "minimum": 0,
      "maximum": 2,
      "description": "Sampling temperature for response generation"
    },
    "maxTokens": {
      "type": "number",
      "default": 1024,
      "minimum": 64,
      "maximum": 8192,
      "description": "Maximum tokens to generate per request"
    }
  }
}
```

---

## 3. Plugin SDK API Documentation

The Plugin SDK (`@notesaner/plugin-sdk`, current version `0.0.0`) provides a
`PluginContext` object that is passed to your `activate()` function. This context
is your gateway to every host capability.

### 3.1 PluginContext

```typescript
interface PluginContext {
  /** Editor manipulation: extensions, node views, markdown serializers. */
  editor: EditorAPI;

  /** Workspace registration: commands, views, sidebar panels, keybindings. */
  workspace: WorkspaceAPI;

  /** Plugin-scoped persistent key-value storage. */
  storage: StorageAPI;

  /** Settings schema registration and value retrieval. */
  settings: SettingsAPI;

  /** Event subscription and emission. */
  events: EventsAPI;

  /** Note CRUD operations. */
  notes: NotesAPI;

  /** UI primitives: notices, modals, ribbon icons. */
  ui: UIAPI;
}
```

The `PluginContext` is passed as the sole argument to `activate()`. All API calls
are proxied through the postMessage bridge to the host application. Async methods
return Promises that resolve when the host responds.

### 3.2 EditorAPI

Register TipTap editor extensions, custom node views, and markdown serializers.

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
   * Requires the `editor:insert-block` permission.
   */
  insertBlock(type: string, attrs: Record<string, unknown>): void;
}

interface MarkdownSerializer {
  /** Convert a ProseMirror node to markdown text. */
  serialize: (node: ProseMirrorNode) => string;
  /** Parse a markdown token into a ProseMirror node specification. */
  parse: (token: MarkdownToken) => ProseMirrorNodeSpec;
}
```

**Example -- registering a custom editor block:**

```typescript
export function activate(ctx: PluginContext): void {
  // Register the TipTap extension that defines the node schema
  ctx.editor.registerExtension(MyCustomBlockExtension);

  // Register the React component that renders the node in the editor
  ctx.editor.registerNodeView('my-custom-block', MyBlockComponent);

  // Register how the node is serialized to/from markdown
  ctx.editor.registerMarkdownSerializer('my-custom-block', {
    serialize: (node) => `:::my-block\n${node.textContent}\n:::\n`,
    parse: (token) => ({ type: 'my-custom-block', content: token.content }),
  });
}
```

The Database, Excalidraw, and Kanban plugins all use this pattern to embed rich
blocks inside notes.

### 3.3 WorkspaceAPI

Register commands, standalone views, sidebar panels, status bar items, and
keyboard shortcuts.

```typescript
interface WorkspaceAPI {
  /** Register a standalone view accessible via a workspace tab. */
  registerView(id: string, component: React.FC, options: ViewOptions): void;

  /** Register a panel in the left sidebar. */
  registerSidebarPanel(id: string, component: React.FC): void;

  /** Register an item in the status bar. */
  registerStatusBarItem(component: React.FC): void;

  /** Register a command in the command palette. */
  registerCommand(command: Command): void;

  /** Register a keyboard shortcut. */
  registerKeybinding(keybinding: Keybinding): void;
}

interface Command {
  /** Unique command ID, namespaced by plugin (e.g. 'my-plugin.do-thing'). */
  id: string;
  /** Human-readable name shown in the command palette. */
  name: string;
  /** Optional keyboard shortcut (e.g. 'Cmd+Shift+D'). */
  hotkey?: string;
  /** Function to execute when the command is invoked. */
  callback: () => void | Promise<void>;
}

interface ViewOptions {
  /** Title displayed in the tab header. */
  title: string;
  /** Icon identifier for the tab (optional). */
  icon?: string;
}

interface Keybinding {
  /** Key combination string (e.g. 'Cmd+Shift+F'). */
  keys: string;
  /** ID of the command to invoke. */
  command: string;
}
```

### 3.4 NotesAPI

Read and write notes in the workspace.

```typescript
interface NotesAPI {
  /** Get the currently active (focused) note, or null. */
  getActive(): NoteDto | null;

  /** Fetch a note by its unique ID. */
  getById(id: string): Promise<NoteDto>;

  /** Search notes by query string (full-text search). */
  search(query: string): Promise<NoteDto[]>;

  /** Create a new note. */
  create(options: CreateNoteOptions): Promise<NoteDto>;

  /** Update the markdown content of an existing note. */
  update(id: string, content: string): Promise<void>;
}

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

interface CreateNoteOptions {
  title: string;
  content: string;
  folder?: string; // Target folder (defaults to workspace root)
  tags?: string[];
}
```

**Requires permissions:** `storage:notes-read` for read operations,
`storage:notes-write` for create and update.

### 3.5 UIAPI

Display notifications, modals, and ribbon icons.

```typescript
interface UIAPI {
  /** Show a temporary notification toast. */
  showNotice(message: string, options?: NoticeOptions): void;

  /** Show a modal dialog with a custom React component. */
  showModal(component: React.FC, options?: ModalOptions): void;

  /** Add an icon to the ribbon (left vertical toolbar). */
  registerRibbonIcon(icon: string, title: string, onClick: () => void): void;
}

interface NoticeOptions {
  /** Display duration in milliseconds (default: 4000). */
  duration?: number;
  /** Notice severity level. */
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ModalOptions {
  /** Modal title bar text. */
  title?: string;
  /** Modal width in pixels. */
  width?: number;
  /** Modal height in pixels. */
  height?: number;
  /** Whether the modal can be dismissed by the user (default: true). */
  closable?: boolean;
}
```

### 3.6 EventsAPI

Subscribe to host and plugin events. Emit custom events for inter-plugin
communication.

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

**Available host events:**

| Event                      | Data                                                     | Description                         |
| -------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `note:opened`              | `{ noteId: string }`                                     | A note was opened in the editor     |
| `note:closed`              | `{ noteId: string }`                                     | A note was closed                   |
| `note:changed`             | `{ noteId: string, content: string }`                    | Note content changed (debounced)    |
| `note:created`             | `{ noteId: string, title: string }`                      | A new note was created              |
| `note:deleted`             | `{ noteId: string }`                                     | A note was deleted                  |
| `note:renamed`             | `{ noteId: string, oldTitle: string, newTitle: string }` | A note was renamed                  |
| `workspace:ready`          | `{}`                                                     | The workspace finished initializing |
| `workspace:focus`          | `{}`                                                     | The window regained focus           |
| `workspace:blur`           | `{}`                                                     | The window lost focus               |
| `editor:selection-changed` | `{ from: number, to: number }`                           | Text selection changed              |
| `settings:changed`         | `{ key: string, value: unknown }`                        | A plugin setting value was updated  |

**Custom events:** Namespace your events with your plugin ID to avoid collisions
(e.g. `my-plugin:data-updated`).

---

## 4. Entry Points

The `entryPoints` object in your manifest tells the host which capabilities your
plugin provides. Each key maps to a JavaScript file that the host loads when the
corresponding UI surface is activated.

### 4.1 Commands

Register entries in the command palette with optional keyboard shortcuts.

**Manifest:**

```json
{
  "entryPoints": {
    "commands": "dist/index.js"
  },
  "permissions": ["ui:register-command"]
}
```

**Code:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.workspace.registerCommand({
    id: 'my-plugin.do-something',
    name: 'My Plugin: Do Something',
    hotkey: 'Cmd+Shift+M',
    callback: async () => {
      const note = ctx.notes.getActive();
      if (note) {
        ctx.ui.showNotice(`Active note: ${note.title}`);
      }
    },
  });
}
```

Commands are the most common entry point. Every built-in plugin registers at
least one command.

**Real-world examples:**

- Focus Mode: `Cmd+Shift+F` toggles zen mode
- Daily Notes: `Cmd+Shift+D` opens today's note
- Templates: `/template` slash-command trigger

### 4.2 Sidebar Panel

Render a persistent panel in the workspace sidebar (left side).

**Manifest:**

```json
{
  "entryPoints": {
    "sidebarPanel": "dist/index.js"
  },
  "permissions": ["ui:register-sidebar"]
}
```

**Code (sandbox-root.ts):**

```typescript
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { MySidebarPanel } from './MySidebarPanel';

/**
 * Mount a React component into the iframe and return the root element.
 * Called by the sidebar panel render callback.
 */
export function createPanelElement(ctx: PluginContext): HTMLElement {
  const container = document.createElement('div');
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(createElement(MySidebarPanel, { ctx }));
  return container;
}
```

This pattern is used by the Daily Notes plugin
(`packages/plugin-daily-notes/src/sandbox-root.ts`) and the AI Writing
Assistant plugin.

### 4.3 Standalone View

Register a full-pane view accessible via a workspace tab.

**Manifest:**

```json
{
  "entryPoints": {
    "view": "dist/index.js"
  },
  "permissions": ["ui:register-view"]
}
```

**Code:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.workspace.registerView('my-plugin-view', MyViewComponent, {
    title: 'My View',
    icon: 'layout-grid',
  });

  // Optionally register a command to open the view
  ctx.workspace.registerCommand({
    id: 'my-plugin.open-view',
    name: 'My Plugin: Open View',
    callback: () => {
      // The host opens the registered view in a new tab
    },
  });
}
```

**Real-world examples:**

- Calendar: month/week/day calendar view
- Slides: presentation preview and fullscreen mode
- Spaced Repetition: flashcard review session view
- PDF/DOCX Export: export preview with settings panel

### 4.4 Editor Extension

Register a TipTap editor extension that adds custom blocks or marks to the
note editor.

**Manifest:**

```json
{
  "entryPoints": {
    "editorExtension": "dist/index.js"
  },
  "permissions": ["editor:insert-block"]
}
```

**Code:**

```typescript
export function activate(ctx: PluginContext): void {
  // Register the TipTap extension (node schema)
  ctx.editor.registerExtension(MyBlockExtension);

  // Register the React component that renders the block
  ctx.editor.registerNodeView('my-block', MyBlockComponent);

  // Register how it serializes to/from markdown
  ctx.editor.registerMarkdownSerializer('my-block', {
    serialize: (node) => `:::my-block\n${JSON.stringify(node.attrs)}\n:::\n`,
    parse: (token) => ({
      type: 'my-block',
      attrs: JSON.parse(token.content),
    }),
  });

  // Register a command to insert the block
  ctx.workspace.registerCommand({
    id: 'my-plugin.insert-block',
    name: 'My Plugin: Insert Block',
    callback: () => {
      ctx.editor.insertBlock('my-block', { title: 'New Block' });
    },
  });
}
```

**Real-world examples:**

- Database: embeds database table views inside notes
- Excalidraw: embeds whiteboard drawings as resizable blocks
- Kanban: embeds kanban board views

### 4.5 Modal

Register a modal dialog for one-off interactions like pickers, forms, or
confirmation prompts.

**Manifest:**

```json
{
  "entryPoints": {
    "modal": "dist/index.js"
  },
  "permissions": ["ui:register-modal"]
}
```

**Code:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.workspace.registerCommand({
    id: 'my-plugin.pick-template',
    name: 'My Plugin: Pick Template',
    callback: () => {
      ctx.ui.showModal(TemplatePickerComponent, {
        title: 'Select a Template',
        width: 640,
        height: 480,
      });
    },
  });
}
```

**Real-world example:** The Templates plugin (`packages/plugin-templates`) uses
modals for both the template picker and the template manager CRUD dialog.

### 4.6 Sidebar Item (Badge/Indicator)

Register a small indicator widget in the sidebar (e.g., a badge showing a count).

**Manifest:**

```json
{
  "entryPoints": {
    "sidebar": "dist/index.js"
  },
  "permissions": ["ui:register-sidebar-item"]
}
```

**Real-world example:** The Spaced Repetition plugin
(`packages/plugin-spaced-repetition`) renders a `DueCardsIndicator` component
that shows the count of flashcards due for review:

```typescript
// DueCardsIndicator.tsx (simplified)
export function DueCardsIndicator({ onStartReview }: DueCardsIndicatorProps) {
  const dueCardIds = useCardStore((s) => s.dueCardIds);
  const count = dueCardIds.length;

  return (
    <button onClick={onStartReview} aria-label={`${count} flashcards due`}>
      <span>{count > 0 ? `${count} due` : 'Review'}</span>
      {count > 0 && <span className="badge">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}
```

### 4.7 Ribbon Action

Add an icon to the ribbon (left vertical toolbar) that triggers an action on
click.

**Code:**

```typescript
export function activate(ctx: PluginContext): void {
  ctx.ui.registerRibbonIcon('pencil', 'Open My Plugin', () => {
    // Handle click
  });
}
```

Ribbon actions do not require a dedicated `entryPoints` key. They are registered
via the `UIAPI.registerRibbonIcon()` method during activation.

### 4.8 Settings Page

Declare a custom settings UI that is automatically rendered by the host from a
JSON schema.

**Manifest:**

```json
{
  "entryPoints": {
    "settingsPage": "dist/index.js"
  }
}
```

Settings pages are driven by the `settings` or `settingsSchema` field in the
manifest. See [Section 6](#6-settings-schema) for the full settings reference.

---

## 5. Storage API

Plugins have three mechanisms for persisting data: plugin-scoped key-value
storage, note read/write operations, and file uploads.

### 5.1 Plugin-Scoped Key-Value Storage

The `StorageAPI` provides persistent key-value storage scoped to your plugin ID.
Two plugins cannot read each other's storage.

```typescript
interface StorageAPI {
  /** Retrieve a value by key. Returns undefined if not set. */
  get(key: string): Promise<unknown>;

  /** Store a value. Values are JSON-serialized. */
  set(key: string, value: unknown): Promise<void>;

  /** Delete a stored value. */
  delete(key: string): Promise<void>;
}
```

**Requires permission:** `storage:local`

**Examples:**

```typescript
// Store user preferences
await ctx.storage.set('theme', 'dark');
await ctx.storage.set('lastOpenedDate', '2026-03-28');

// Store complex objects (JSON-serialized automatically)
await ctx.storage.set('card-schedule', {
  cardId: 'abc',
  nextReview: '2026-04-01',
  easeFactor: 2.5,
  repetitions: 3,
});

// Retrieve values
const theme = await ctx.storage.get('theme'); // 'dark'
const schedule = await ctx.storage.get('card-schedule'); // { cardId: 'abc', ... }
const missing = await ctx.storage.get('nonexistent'); // undefined

// Delete a value
await ctx.storage.delete('theme');
```

**Best practices:**

- Use storage for plugin-specific state that does not belong in notes (caches,
  preferences, computed schedules, session data).
- Keep stored values reasonably small. Do not use storage as a database.
- Always handle the `undefined` case when reading keys that may not exist.

### 5.2 Reading and Writing Notes

Notes are the primary data model in Notesaner. They are stored as markdown files
on the filesystem, and the file is the source of truth.

```typescript
// Get the currently open note
const active = ctx.notes.getActive();
if (active) {
  console.log(active.title, active.content);
}

// Fetch a specific note by ID
const note = await ctx.notes.getById('note-abc123');

// Full-text search
const results = await ctx.notes.search('meeting agenda');

// Create a new note
const newNote = await ctx.notes.create({
  title: 'Meeting Notes - March 2026',
  content: '# Meeting Notes\n\n- Item 1\n- Item 2\n',
  folder: 'Meetings',
  tags: ['meetings', 'work'],
});

// Update an existing note
await ctx.notes.update(newNote.id, '# Updated Content\n\nRevised notes.');
```

**Requires permissions:**

- `storage:notes-read` for `getActive()`, `getById()`, `search()`
- `storage:notes-write` for `create()`, `update()`

### 5.3 File Uploads

Plugins that need to attach images or files to notes must request the
`storage:files-write` permission. The Web Clipper plugin
(`packages/plugin-web-clipper`) demonstrates this pattern for saving clipped
images and screenshots to the workspace.

---

## 6. Settings Schema

Plugins can declare a configuration schema in the manifest. The host
automatically generates a settings UI from this schema using the
`PluginSettingsRenderer` component and the `schemaToFields()` utility.

### 6.1 Declaring Settings in the Manifest

There are two ways to declare settings:

**Inline in the manifest (recommended for simple schemas):**

```json
{
  "settings": {
    "autoCreate": {
      "type": "boolean",
      "default": false,
      "description": "Automatically create today's note on startup."
    },
    "folder": {
      "type": "string",
      "default": "Daily Notes",
      "description": "Folder for daily notes."
    }
  }
}
```

**Via a separate JSON Schema file:**

```json
{
  "settings": "dist/settings-schema.json"
}
```

**Using the `settingsSchema` field (alternative to `settings`):**

```json
{
  "settingsSchema": {
    "provider": {
      "type": "string",
      "enum": ["openai", "anthropic", "ollama"],
      "default": "openai"
    }
  }
}
```

### 6.2 Supported Setting Types

The settings system maps JSON Schema types to UI controls:

| JSON Schema Type             | UI Control      | Example                                              |
| ---------------------------- | --------------- | ---------------------------------------------------- |
| `string`                     | Text input      | `{ "type": "string", "default": "" }`                |
| `string` + `format: "uri"`   | URL input       | `{ "type": "string", "format": "uri" }`              |
| `string` + `format: "color"` | Color picker    | `{ "type": "string", "format": "color" }`            |
| `string` + `enum`            | Select dropdown | `{ "type": "string", "enum": ["a", "b"] }`           |
| `number` / `integer`         | Number input    | `{ "type": "number", "minimum": 0 }`                 |
| `boolean`                    | Toggle switch   | `{ "type": "boolean", "default": true }`             |
| `array` + items with `enum`  | Multi-select    | `{ "type": "array", "items": { "enum": [...] } }`    |
| `array` + items without enum | Tag input       | `{ "type": "array", "items": { "type": "string" } }` |
| `object` + `properties`      | Fieldset group  | Nested fields rendered as a group                    |

**Supported validation constraints:**

| Constraint  | Applies To        | Description                        |
| ----------- | ----------------- | ---------------------------------- |
| `minimum`   | `number/integer`  | Minimum numeric value              |
| `maximum`   | `number/integer`  | Maximum numeric value              |
| `minLength` | `string`          | Minimum string length              |
| `maxLength` | `string`          | Maximum string length              |
| `pattern`   | `string`          | Regex pattern the value must match |
| `minItems`  | `array`           | Minimum number of items            |
| `maxItems`  | `array`           | Maximum number of items            |
| `required`  | (top-level array) | List of required field names       |

**Special fields:**

| Property      | Type      | Description                                              |
| ------------- | --------- | -------------------------------------------------------- |
| `default`     | any       | Default value used when no saved value exists            |
| `description` | `string`  | Help text shown below the control                        |
| `title`       | `string`  | Override for the auto-generated label                    |
| `secret`      | `boolean` | Marks the value as sensitive (encrypted at rest by host) |

### 6.3 Settings API at Runtime

Access and subscribe to settings values programmatically:

```typescript
interface SettingsAPI {
  /** Register a settings schema (usually done from the manifest). */
  register(schema: SettingsSchema): void;

  /** Get the current value of a setting. */
  get(key: string): unknown;

  /** Subscribe to changes on a specific setting key. */
  onChange(key: string, callback: (value: unknown) => void): void;
}
```

**Example:**

```typescript
export function activate(ctx: PluginContext): void {
  // Read current settings
  const provider = ctx.settings.get('provider') as string;
  const apiKey = ctx.settings.get('apiKey') as string;

  // React to settings changes
  ctx.settings.onChange('provider', (newProvider) => {
    reconfigureClient(newProvider as string);
  });

  ctx.settings.onChange('temperature', (newTemp) => {
    setTemperature(newTemp as number);
  });
}
```

### 6.4 Auto-Generated Settings UI

When a plugin declares a settings schema, the host renders a settings page using
the `PluginSettingsRenderer` component (`apps/web/src/features/plugins/ui/`).
The renderer:

1. Calls `schemaToFields(schema)` to convert the JSON Schema into an ordered
   array of `FieldDescriptor` objects.
2. Renders each field using the appropriate Ant Design control (Input,
   InputNumber, Select, Switch, ColorPicker, Checkbox.Group).
3. Calls `validateSettings(fields, values)` before saving to enforce constraints.
4. Persists validated values through the plugin store.

No code is required from the plugin author for the settings UI. It is generated
entirely from the schema declaration in the manifest.

### 6.5 Complete Settings Schema Example

From the built-in Daily Notes plugin (`packages/plugin-daily-notes/src/manifest.json`):

```json
{
  "settings": {
    "autoCreate": {
      "type": "boolean",
      "default": false,
      "description": "Automatically open or create today's daily note on workspace startup."
    },
    "nameFormat": {
      "type": "string",
      "default": "YYYY-MM-DD",
      "description": "Filename format for daily notes. Tokens: YYYY, YY, MM, DD, ddd, dddd."
    },
    "folder": {
      "type": "string",
      "default": "Daily Notes",
      "description": "Folder for daily notes (relative to workspace root). Empty = root."
    },
    "templateId": {
      "type": "string",
      "default": "",
      "description": "Path to a template note used when creating new daily notes."
    },
    "weeklyEnabled": {
      "type": "boolean",
      "default": false,
      "description": "Enable weekly periodic notes."
    },
    "weeklyFormat": {
      "type": "string",
      "default": "YYYY-[W]ww",
      "description": "Filename format for weekly notes. Default produces 2026-W12."
    },
    "weeklyFolder": {
      "type": "string",
      "default": "",
      "description": "Folder for weekly notes. Falls back to the daily notes folder."
    },
    "monthlyEnabled": {
      "type": "boolean",
      "default": false,
      "description": "Enable monthly periodic notes."
    },
    "monthlyFormat": {
      "type": "string",
      "default": "YYYY-MM",
      "description": "Filename format for monthly notes. Default produces 2026-03."
    },
    "monthlyFolder": {
      "type": "string",
      "default": "",
      "description": "Folder for monthly notes. Falls back to the daily notes folder."
    }
  }
}
```

---

## 7. Example Plugin: Hello World

This section presents four progressively complex examples showing all major
entry points.

### 7.1 Minimal Plugin (Command Only)

The simplest possible plugin: a single command that shows a notification.

**`src/manifest.json`:**

```json
{
  "id": "example.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "author": "Example Developer",
  "description": "A minimal plugin that says hello.",
  "main": "dist/index.js",
  "repository": "example/notesaner-plugin-hello-world",
  "minAppVersion": "1.0.0",
  "minSdkVersion": "0.0.0",
  "permissions": ["ui:register-command", "ui:show-notice"],
  "tags": ["notesaner-plugin", "example"],
  "entryPoints": {
    "commands": "dist/index.js"
  }
}
```

**`src/index.ts`:**

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export const PLUGIN_ID = 'hello-world';

export function activate(ctx: PluginContext): void {
  // Register a command in the command palette
  ctx.workspace.registerCommand({
    id: `${PLUGIN_ID}.greet`,
    name: 'Hello World: Say Hello',
    hotkey: 'Cmd+Shift+H',
    callback: () => {
      ctx.ui.showNotice('Hello from my first Notesaner plugin!', {
        type: 'success',
        duration: 3000,
      });
    },
  });

  // Register a second command that reads the active note
  ctx.workspace.registerCommand({
    id: `${PLUGIN_ID}.read-note`,
    name: 'Hello World: Read Active Note',
    callback: () => {
      const note = ctx.notes.getActive();
      if (note) {
        ctx.ui.showNotice(`Current note: "${note.title}" (${note.content.length} chars)`);
      } else {
        ctx.ui.showNotice('No note is currently open.', { type: 'warning' });
      }
    },
  });
}

export function deactivate(): void {
  // Nothing to clean up for this simple plugin
}
```

### 7.2 Plugin with Sidebar Panel

A plugin that renders a React component in the sidebar.

**`src/manifest.json`:**

```json
{
  "id": "example.word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "author": "Example Developer",
  "description": "Live word count displayed in the sidebar.",
  "main": "dist/index.js",
  "repository": "example/notesaner-plugin-word-count",
  "minAppVersion": "1.0.0",
  "minSdkVersion": "0.0.0",
  "permissions": ["storage:notes-read", "ui:register-sidebar", "ui:register-command"],
  "tags": ["notesaner-plugin", "word-count", "productivity"],
  "entryPoints": {
    "sidebarPanel": "dist/index.js",
    "commands": "dist/index.js"
  }
}
```

**`src/index.ts`:**

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export const PLUGIN_ID = 'word-count';

export function activate(ctx: PluginContext): void {
  ctx.workspace.registerCommand({
    id: `${PLUGIN_ID}.show-count`,
    name: 'Word Count: Show Count',
    callback: () => {
      const note = ctx.notes.getActive();
      if (note) {
        const count = note.content.split(/\s+/).filter(Boolean).length;
        ctx.ui.showNotice(`Word count: ${count}`);
      }
    },
  });
}

export function deactivate(): void {}
```

**`src/sandbox-root.ts`:**

```typescript
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { WordCountPanel } from './WordCountPanel';

export function createPanelElement(ctx: PluginContext): HTMLElement {
  const container = document.createElement('div');
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(createElement(WordCountPanel, { ctx }));
  return container;
}
```

**`src/WordCountPanel.tsx`:**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { PluginContext } from '@notesaner/plugin-sdk';

interface WordCountPanelProps {
  ctx: PluginContext;
}

export function WordCountPanel({ ctx }: WordCountPanelProps) {
  const [count, setCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const updateCounts = useCallback(() => {
    const note = ctx.notes.getActive();
    if (note) {
      const words = note.content.split(/\s+/).filter(Boolean);
      setCount(words.length);
      setCharCount(note.content.length);
    } else {
      setCount(0);
      setCharCount(0);
    }
  }, [ctx]);

  useEffect(() => {
    // Update on mount
    updateCounts();

    // Subscribe to note changes
    ctx.events.on('note:changed', updateCounts);
    ctx.events.on('note:opened', updateCounts);

    return () => {
      ctx.events.off('note:changed', updateCounts);
      ctx.events.off('note:opened', updateCounts);
    };
  }, [ctx, updateCounts]);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 12px' }}>Word Count</h3>
      <div style={{ fontSize: 32, fontWeight: 'bold' }}>{count}</div>
      <div style={{ color: '#888', fontSize: 14 }}>words</div>
      <div style={{ marginTop: 12, fontSize: 14, color: '#666' }}>
        {charCount} characters
      </div>
    </div>
  );
}
```

### 7.3 Plugin with Settings

A plugin that uses a settings schema for user configuration.

**`src/manifest.json`** (relevant parts):

```json
{
  "id": "example.auto-tagger",
  "name": "Auto Tagger",
  "entryPoints": {
    "commands": "dist/index.js",
    "settingsPage": "dist/index.js"
  },
  "settings": {
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "Enable automatic tagging on note save."
    },
    "maxTags": {
      "type": "number",
      "default": 5,
      "minimum": 1,
      "maximum": 20,
      "description": "Maximum number of tags to auto-assign."
    },
    "ignoredFolders": {
      "type": "array",
      "items": { "type": "string" },
      "default": [],
      "description": "Folders to exclude from auto-tagging."
    },
    "tagPrefix": {
      "type": "string",
      "default": "auto/",
      "description": "Prefix added to auto-generated tags."
    }
  }
}
```

**`src/index.ts`:**

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export const PLUGIN_ID = 'auto-tagger';

export function activate(ctx: PluginContext): void {
  // Read initial settings
  let isEnabled = ctx.settings.get('enabled') as boolean;
  let maxTags = ctx.settings.get('maxTags') as number;
  let tagPrefix = ctx.settings.get('tagPrefix') as string;

  // React to settings changes
  ctx.settings.onChange('enabled', (val) => {
    isEnabled = val as boolean;
  });
  ctx.settings.onChange('maxTags', (val) => {
    maxTags = val as number;
  });
  ctx.settings.onChange('tagPrefix', (val) => {
    tagPrefix = val as string;
  });

  ctx.events.on('note:changed', (data) => {
    if (!isEnabled) return;
    // Auto-tagging logic here...
  });

  ctx.workspace.registerCommand({
    id: `${PLUGIN_ID}.tag-current`,
    name: 'Auto Tagger: Tag Current Note',
    callback: async () => {
      const note = ctx.notes.getActive();
      if (!note) return;
      ctx.ui.showNotice(`Auto-tagging "${note.title}" (max ${maxTags} tags)...`);
      // Apply tagging logic...
    },
  });
}

export function deactivate(): void {}
```

### 7.4 Plugin with View and Events

A plugin that registers a standalone view and listens for events.

**`src/manifest.json`** (relevant parts):

```json
{
  "id": "example.note-timeline",
  "name": "Note Timeline",
  "entryPoints": {
    "view": "dist/index.js",
    "commands": "dist/index.js"
  },
  "permissions": ["storage:notes-read", "ui:register-view", "ui:register-command"]
}
```

**`src/index.ts`:**

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';
import { TimelineView } from './TimelineView';

export const PLUGIN_ID = 'note-timeline';

export function activate(ctx: PluginContext): void {
  // Register the standalone view
  ctx.workspace.registerView(`${PLUGIN_ID}.view`, TimelineView, {
    title: 'Note Timeline',
    icon: 'clock',
  });

  // Command to open the view
  ctx.workspace.registerCommand({
    id: `${PLUGIN_ID}.open`,
    name: 'Note Timeline: Open',
    hotkey: 'Cmd+Shift+T',
    callback: () => {
      // Host opens the view
    },
  });

  // Listen for note events to keep the timeline updated
  ctx.events.on('note:created', (data) => {
    console.log('New note created:', data.title);
  });

  ctx.events.on('note:deleted', (data) => {
    console.log('Note deleted:', data.noteId);
  });
}

export function deactivate(): void {}
```

---

## 8. Testing Plugins in Dev Mode

### 8.1 Hot Reload

Notesaner includes a built-in hot-reload system for plugin development. In
development mode (`NODE_ENV=development`), the server watches the `plugins-dev/`
directory for file changes.

**How it works:**

1. The `HotReloadService` (`apps/server/src/modules/plugins/hot-reload.service.ts`)
   uses [chokidar](https://github.com/paulmillr/chokidar) to watch the
   `plugins-dev/` directory with a depth of 5.

2. File changes are debounced (300ms) to avoid rapid-fire events during saves.

3. Change events are classified by type:
   - `manifest-changed` -- the `plugin.json` was modified
   - `code-changed` -- a source file (.ts, .js, .json, .css, .html) changed
   - `plugin-added` -- a new plugin directory appeared
   - `plugin-removed` -- a plugin directory was deleted

4. The `PluginWatcherGateway` (`apps/server/src/modules/plugins/plugin-watcher.gateway.ts`)
   forwards change events to connected frontends via WebSocket at the
   `/plugins/watch` endpoint.

5. The frontend receives `plugin:change` events and reloads the affected plugin.

**Watched file extensions:** `.ts`, `.js`, `.json`, `.css`, `.html`, `.svelte`, `.vue`

**Ignored directories:** `node_modules`, `.git`, `dist`, `.DS_Store`, `thumbs.db`

**To use hot reload during development:**

1. Place your plugin directory under the `plugins-dev/` root:

   ```bash
   cp -r my-plugin/ /path/to/plugins-dev/my-plugin/
   ```

2. Start the backend server in development mode:

   ```bash
   NODE_ENV=development pnpm nx serve server
   ```

3. The server logs will show:

   ```
   [HotReloadService] Starting plugin hot-reload watcher on: /path/to/plugins-dev
   [HotReloadService] Plugin hot-reload watcher is ready
   ```

4. Edit your plugin files. The server detects changes and broadcasts reload
   events to the frontend.

**WebSocket protocol for dev tools:**

```
Client -> Server:  "subscribe" { plugins?: string[] }
Server -> Client:  "plugin:change" { type, pluginDir, relativePath, timestamp, manifest? }
Server -> Client:  "plugin:status" { watching, pluginsRoot, connectedClients }
Client -> Server:  "force-reload" { pluginDir: string }
```

Clients can subscribe to specific plugin directories or receive all events. The
`force-reload` message triggers a synthetic change event for manual refresh.

### 8.2 Unit Testing with Vitest

All built-in plugins use Vitest for unit testing. Follow this pattern:

**`vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

**`src/__tests__/my-utils.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import { countWords, extractTags } from '../my-utils';

describe('countWords', () => {
  it('counts words in a string', () => {
    expect(countWords('hello world')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('handles multiple spaces', () => {
    expect(countWords('hello   world')).toBe(2);
  });
});
```

**Run tests:**

```bash
# Run all tests once
pnpm vitest run

# Watch mode
pnpm vitest

# With coverage
pnpm vitest run --coverage
```

**Testing patterns from built-in plugins:**

- `packages/plugin-daily-notes/src/__tests__/` -- date formatting, periodic
  note generation, store state management
- `packages/plugin-focus-mode/src/__tests__/` -- typewriter scrolling math,
  focus store state transitions
- `packages/plugin-slides/src/__tests__/` -- slide parsing, slide store
- `packages/plugin-web-clipper/src/__tests__/` -- clip template rendering

**Best practices:**

1. Test business logic separately from UI. Pure functions (date math, parsers,
   formatters) are straightforward to test.
2. Test edge cases: empty input, malformed data, boundary values.
3. Use `jsdom` environment for tests that touch DOM APIs.
4. Mock the `PluginContext` when testing activation logic.

### 8.3 Debugging in the Browser

Since plugins run in iframes:

1. Open the browser DevTools.
2. In the **Sources** panel, expand the iframe tree to find your plugin's
   JavaScript files.
3. Set breakpoints in your plugin code.
4. Use the **Console** panel (select the iframe context from the dropdown) to
   evaluate expressions in your plugin's scope.
5. The **Network** panel shows postMessage traffic between the plugin and host
   (filter by "message" type).

### 8.4 Testing in the Monorepo

For built-in plugins developed within the Notesaner monorepo:

```bash
# Run tests for a specific plugin
pnpm nx test plugin-my-plugin

# Run tests for all affected plugins (CI-friendly)
pnpm nx affected -t test

# Type-check a plugin
pnpm nx type-check plugin-my-plugin

# Lint a plugin
pnpm nx lint plugin-my-plugin
```

Each plugin in the monorepo has a `project.json` with NX targets:

```json
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
```

---

## 9. Submitting to the Plugin Registry

### 9.1 Registry Architecture

Notesaner uses a GitHub-based plugin registry. There is no central package
registry server. Instead:

1. Plugin authors publish their plugins as **public GitHub repositories** tagged
   with the `notesaner-plugin` topic.
2. The Notesaner backend searches GitHub for repositories with this topic when
   users browse the plugin store.
3. Plugin installation downloads the `.zip` asset from a GitHub Release,
   verifies it, extracts it, and reads the `plugin.json` manifest.
4. The frontend plugin browser (`apps/web/src/features/plugins/`) provides
   search, filtering, installation, and management UI.

### 9.2 Prepare Your Repository

1. **Create a public GitHub repository** for your plugin.

2. **Add the `notesaner-plugin` topic** to the repository
   (Settings > General > Topics).

3. **Include `plugin.json`** at the repository root with all required fields
   (see [Section 2](#2-plugin-manifest-reference)).

4. **Write a `README.md`** that describes:
   - What the plugin does
   - How to use it (commands, settings, UI)
   - Screenshots (optional but recommended)
   - Changelog or link to releases

5. **Add relevant topics** to your repository for discoverability. The plugin
   browser supports searching by tags that map to GitHub topics.

### 9.3 Create a GitHub Release

The installation system expects a `.zip` asset attached to a GitHub Release.

1. Build your plugin:

   ```bash
   pnpm build
   ```

2. Create a `.zip` containing your built assets and `plugin.json`:

   ```bash
   # Recommended: name the zip "plugin.zip"
   zip -r plugin.zip dist/ plugin.json icon.svg
   ```

3. Create a GitHub Release:
   - Tag format: `v1.0.0` or `1.0.0` (both are supported)
   - Attach the `plugin.zip` file as a release asset
   - Write release notes describing changes

4. The server preferentially looks for an asset named `plugin.zip`. If not found,
   it falls back to any `.zip` file attached to the release.

**Size limit:** Plugin archives must not exceed **50 MB**.

### 9.4 Release Checklist

Before publishing a release, verify:

- [ ] `plugin.json` has the correct `version` matching the release tag
- [ ] `plugin.json` has the correct `minSdkVersion` and `minAppVersion`
- [ ] All required permissions are declared in the manifest
- [ ] Built assets (`dist/`) are included in the `.zip`
- [ ] `plugin.json` is at the root of the `.zip` (or in a single top-level directory)
- [ ] Repository has the `notesaner-plugin` topic
- [ ] `README.md` describes usage and configuration
- [ ] Plugin has been tested against the target `minAppVersion`
- [ ] No debug code (`console.log`, `debugger`) in the build output
- [ ] No hardcoded secrets or API keys in the build

### 9.5 Auto-Update Mechanism

The server can check for plugin updates using the `GitHubReleaseService`:

```typescript
interface PluginUpdateInfo {
  pluginId: string;
  repository: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}
```

The update check:

1. Fetches the latest non-prerelease GitHub Release for the plugin's repository.
2. Compares the installed version against the latest release version using
   semver comparison (major.minor.patch).
3. Returns `updateAvailable: true` if the latest version is newer.

Users can opt into automatic update checking on a per-plugin basis via the
`autoUpdate` flag on the installation DTO.

### 9.6 Server-Side Installation Flow

When a user installs a plugin through the browser, the server performs these
steps:

1. **Fetch release metadata** from GitHub API
   (`GET /repos/:owner/:repo/releases/latest` or by tag).
2. **Validate the `.zip` asset** exists and is under 50 MB.
3. **Download the `.zip`** to a local cache directory.
4. **Compute SHA-256 checksum** of the downloaded file.
5. **Verify checksum** if one was provided by the user (optional security
   measure).
6. **Extract the archive** using system `unzip`.
7. **Resolve the plugin root** (handles GitHub's pattern of wrapping files in a
   single top-level directory).
8. **Parse and validate `plugin.json`** (all required fields must be present).
9. **Return the installation result** with manifest, install path, checksum,
   and version.

If any step fails, the operation is rolled back (downloaded files are cleaned
up) and a descriptive error is returned.

---

## 10. SDK Version Changelog

The Plugin SDK (`@notesaner/plugin-sdk`) follows semantic versioning. The
current version is `0.0.0`, indicating the API is in initial development and
subject to change.

### v0.0.0 (Initial Development)

- Exported `PLUGIN_SDK_VERSION` constant.
- Defined the `PluginContext` interface with the following namespaces:
  - `editor` -- TipTap extension registration, node views, markdown serializers
  - `workspace` -- commands, views, sidebar panels, status bar items, keybindings
  - `storage` -- plugin-scoped key-value persistence
  - `settings` -- schema registration and value access
  - `events` -- event subscription, emission, and lifecycle hooks
  - `notes` -- note CRUD operations (getActive, getById, search, create, update)
  - `ui` -- notices, modals, ribbon icons
- Established the iframe sandbox + postMessage bridge architecture.
- Defined the `plugin.json` manifest format.
- Implemented 14 built-in plugins as reference implementations.
- Server-side: GitHub Release-based installation, checksum verification,
  hot-reload for development, WebSocket change notifications.
- Frontend: Plugin browser with search/filter/pagination, plugin settings
  renderer with JSON Schema to form conversion, installed plugin management.

### Planned for v0.1.0

- Stabilized `PluginContext` API with full TypeScript definitions.
- Plugin lifecycle events (`plugin:activated`, `plugin:deactivated`).
- Inter-plugin communication API.
- Versioned postMessage protocol.

### Planned for v1.0.0

- Stable, backward-compatible API surface.
- Published `@notesaner/plugin-sdk` package on npm.
- Plugin development CLI scaffolding tool.
- Formal plugin review process for the registry.

**Version compatibility:** When the SDK reaches v1.0.0, plugins declaring
`minSdkVersion: "1.0.0"` will be guaranteed backward compatibility within the
1.x range. Until then, expect breaking changes between minor versions.

---

## 11. Security Model and Permissions

### 11.1 Iframe Sandbox

Every plugin runs in its own `<iframe>` with the `sandbox` attribute:

```html
<iframe sandbox="allow-scripts allow-same-origin" />
```

This sandbox enforces:

| Capability           | Allowed? | Notes                                        |
| -------------------- | -------- | -------------------------------------------- |
| Execute JavaScript   | Yes      | `allow-scripts`                              |
| Same-origin access   | Yes      | `allow-same-origin` (needed for postMessage) |
| Access host DOM      | No       | Blocked by iframe boundary                   |
| Navigate top window  | No       | Blocked by sandbox                           |
| Open popups          | No       | Blocked by sandbox                           |
| Submit forms         | No       | Blocked by sandbox                           |
| Access host cookies  | No       | Blocked by origin isolation                  |
| Access other plugins | No       | Each plugin is in its own iframe             |

The sandbox ensures that a malicious or buggy plugin cannot:

- Steal user credentials or session tokens
- Modify the host application UI
- Interfere with other plugins
- Navigate the user to phishing pages

### 11.2 postMessage Protocol

All communication between the plugin iframe and the host application uses a
structured postMessage protocol.

**Plugin to host (request):**

```typescript
interface PluginMessage {
  type: 'plugin-request';
  pluginId: string; // Identifies which plugin sent the message
  requestId: string; // Unique ID for correlating request/response
  method: string; // API method (e.g. 'notes.getActive', 'ui.showNotice')
  params: unknown[]; // Method arguments
}
```

**Host to plugin (response):**

```typescript
interface HostMessage {
  type: 'plugin-response';
  requestId: string; // Matches the request
  result?: unknown; // Successful result
  error?: {
    // Error (only on failure)
    code: string;
    message: string;
  };
}
```

**Host to plugin (event):**

```typescript
interface HostEvent {
  type: 'plugin-event';
  event: string; // Event name (e.g. 'note:changed')
  data: unknown; // Event payload
}
```

The Plugin SDK abstracts these messages into clean async function calls. You
never need to work with raw postMessage unless you are debugging.

**Permission enforcement:** The host checks every incoming `plugin-request`
against the plugin's declared permissions. If a method requires a permission
that was not declared in the manifest, the host responds with an error:

```typescript
{
  type: 'plugin-response',
  requestId: '...',
  error: {
    code: 'PERMISSION_DENIED',
    message: 'Plugin "my-plugin" does not have permission "storage:notes-write"'
  }
}
```

### 11.3 Permission System

Permissions follow the principle of least privilege. A plugin must declare every
permission it needs in the manifest. Users see the requested permissions before
installing a plugin.

Permissions are namespaced by category:

- `storage:*` -- data access (notes, files, local key-value)
- `ui:*` -- UI registration (commands, sidebar, views, modals, notices)
- `editor:*` -- editor manipulation (inserting blocks)
- `network:*` -- HTTP access (scoped or unrestricted)

### 11.4 Permission Reference

| Permission                 | Category | Description                                        |
| -------------------------- | -------- | -------------------------------------------------- |
| `storage:notes-read`       | Storage  | Read note content and metadata                     |
| `storage:notes-write`      | Storage  | Create, update, and delete notes                   |
| `storage:files-write`      | Storage  | Upload images and file attachments                 |
| `storage:local`            | Storage  | Use plugin-scoped key-value storage                |
| `ui:register-command`      | UI       | Register commands in the command palette           |
| `ui:register-sidebar`      | UI       | Register a sidebar panel                           |
| `ui:register-sidebar-item` | UI       | Register a sidebar badge/indicator                 |
| `ui:register-view`         | UI       | Register a standalone workspace view               |
| `ui:register-modal`        | UI       | Open modal dialogs                                 |
| `ui:show-notice`           | UI       | Show notification toasts                           |
| `ui:show-modal`            | UI       | Show modal dialogs (alias for `ui:register-modal`) |
| `editor:insert-block`      | Editor   | Insert blocks into the editor                      |
| `network:fetch`            | Network  | Make HTTP requests to allowed origins              |
| `network:external`         | Network  | Make HTTP requests to any origin (use sparingly)   |

**Built-in plugin permission usage examples:**

| Plugin       | Permissions                                                      |
| ------------ | ---------------------------------------------------------------- |
| Focus Mode   | `ui:register-command`, `ui:show-notice`, `storage:local`         |
| Daily Notes  | `storage:notes-read/write`, `ui:register-sidebar/command/notice` |
| AI Assistant | Same as Daily Notes, plus `network:fetch`                        |
| Web Clipper  | `storage:notes-write`, `storage:files-write`, `network:external` |
| Database     | All storage, most UI, plus `editor:insert-block`                 |

### 11.5 Network Access

Network permissions control whether a plugin can make HTTP requests:

- **`network:fetch`** -- the plugin can make requests to a predefined allowlist
  of origins. Use this when your plugin only needs to contact known APIs (e.g.,
  OpenAI, Anthropic endpoints).

- **`network:external`** -- the plugin can make requests to any origin. This is
  the most permissive network permission and should be used sparingly.
  Users will see a clear warning about unrestricted network access before
  installing.

**Recommendation:** Prefer `network:fetch` with specific origins over
`network:external` whenever possible. Only request `network:external` if your
plugin genuinely needs to contact arbitrary user-specified URLs (e.g., the Web
Clipper must fetch arbitrary web pages).

### 11.6 Secret Storage

Settings marked with `"secret": true` in the settings schema are encrypted at
rest by the host application. This is used for API keys, tokens, and other
sensitive values:

```json
{
  "settingsSchema": {
    "apiKey": {
      "type": "string",
      "default": "",
      "secret": true,
      "description": "API key for the external service"
    }
  }
}
```

Secret values:

- Are never exposed in the plugin browser or settings UI (shown as masked input)
- Are encrypted before persisting to disk or database
- Are decrypted only when the plugin reads them via `ctx.settings.get('apiKey')`

### 11.7 Asset Integrity

The server verifies plugin integrity during installation:

1. **Size limit:** Plugin archives must not exceed 50 MB, preventing denial-of-
   service via oversized uploads.

2. **SHA-256 checksum:** The server computes a SHA-256 hash of every downloaded
   `.zip` file. If the installer provides an expected checksum, the server
   verifies it matches. A mismatch causes the downloaded file to be immediately
   deleted:

   ```typescript
   // PluginInstallDto allows optional checksum verification
   {
     "repository": "author/plugin-name",
     "version": "1.2.0",
     "checksum": "a1b2c3d4..."  // Optional SHA-256 hex string (64 chars)
   }
   ```

3. **Manifest validation:** The extracted package must contain a valid
   `plugin.json` at the root. All required fields are validated. Invalid
   manifests cause the installation to fail.

4. **Tag format flexibility:** The server tries both `vX.Y.Z` and `X.Y.Z` tag
   formats when fetching a specific release version.

### 11.8 Security Best Practices

1. **Declare only the permissions you need.** Users see requested permissions
   before installing. Over-requesting erodes trust and reduces installation
   rates.

2. **Never store secrets in plugin code.** Use the `"secret": true` flag in
   settings schemas for API keys and tokens.

3. **Sanitize user input.** If your plugin renders HTML from note content or
   user input, sanitize it to prevent XSS. The iframe sandbox provides a layer
   of defense, but defense in depth is always better.

4. **Validate data at boundaries.** Use Zod or manual checks for data received
   via `postMessage`, from storage, or from external APIs.

5. **Avoid `network:external` when possible.** Use `network:fetch` with specific
   allowed origins if your plugin only needs to contact known APIs.

6. **Handle errors gracefully.** Wrap all async operations in try/catch. Never
   let unhandled promise rejections crash the plugin.

7. **Clean up on deactivate.** Clear timers, intervals, event subscriptions,
   and DOM mutations in your `deactivate()` function to prevent memory leaks.

8. **Keep dependencies minimal.** Fewer dependencies means a smaller attack
   surface. The built-in plugins demonstrate this: `plugin-daily-notes`
   implements date math without `date-fns`, and `plugin-templates` includes a
   minimal YAML parser instead of `js-yaml`.

---

## Further Reading

- **Built-in plugin source code** at `packages/plugin-*/` -- the best reference
  for real-world patterns and conventions
- **Server-side plugin system** at `apps/server/src/modules/plugins/` -- manifest
  validation, GitHub Release integration, hot-reload, WebSocket gateway
- **Frontend plugin feature** at `apps/web/src/features/plugins/` -- browser UI,
  settings renderer, registry API client, Zustand stores
- **Plugin SDK** at `libs/plugin-sdk/` -- SDK package and type definitions
- **Existing guide** at `docs/plugin-development.md` -- alternative reference
  with additional examples and walkthrough commentary
