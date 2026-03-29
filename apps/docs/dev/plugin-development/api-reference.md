---
title: Plugin API Reference (TypeScript)
description: Auto-generated TypeScript API reference for the @notesaner/plugin-sdk.
---

# Plugin API Reference (TypeScript)

:::info Coming Soon
The TypeScript API reference will be auto-generated from `libs/plugin-sdk` using TypeDoc.
Once available, it will be linked here and embedded via a Docusaurus plugin.
:::

## Manual Reference

Until auto-generation is set up, refer to the type definitions in the SDK source:

```
libs/plugin-sdk/src/
├── index.ts           # Main exports
├── types.ts           # Type definitions
├── registry.ts        # Plugin registration
└── hooks.ts           # Lifecycle hooks
```

## Key Types

```typescript
interface PluginContext {
  editor: EditorApi;
  storage: StorageApi;
  ui: UiApi;
  events: EventsApi;
  settings: SettingsApi;
  workspace: WorkspaceApi;
}

interface PluginDefinition {
  id: string;
  onLoad: (ctx: PluginContext) => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
  onNoteOpen?: (noteId: string) => void;
  onNoteClose?: (noteId: string) => void;
}
```
