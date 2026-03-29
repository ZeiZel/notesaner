---
title: Your First Plugin (Hello World)
description: Scaffold, manifest, register, and test a Notesaner plugin end-to-end in 10 minutes.
---

# Your First Plugin (Hello World)

Build a minimal Notesaner plugin that adds a "Hello World" panel to the sidebar.

## Prerequisites

- Node.js 20+
- pnpm 10+

## 1. Scaffold the Plugin

```bash
npx create-notesaner-plugin my-hello-plugin
cd my-hello-plugin
pnpm install
```

## 2. Plugin Structure

```
my-hello-plugin/
├── manifest.json       # Plugin metadata and permissions
├── src/
│   └── index.ts        # Plugin entry point
├── package.json
└── tsconfig.json
```

## 3. The Manifest

```json
{
  "id": "my-hello-plugin",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "A simple hello world plugin",
  "author": "Your Name",
  "capabilities": ["ui.sidebar-panel"],
  "entrypoint": "dist/index.js",
  "minAppVersion": "1.0.0"
}
```

## 4. The Plugin Code

```typescript
// src/index.ts
import { definePlugin, createPanel } from '@notesaner/plugin-sdk';

export default definePlugin({
  id: 'my-hello-plugin',

  onLoad(ctx) {
    const panel = createPanel({
      id: 'hello-panel',
      title: 'Hello World',
      icon: '👋',
      render: () => `<div style="padding: 16px">Hello, World!</div>`,
    });

    ctx.ui.registerSidebarPanel(panel);
  },
});
```

## 5. Build

```bash
pnpm build
```

## 6. Test Locally

```bash
pnpm dev
```

Open Notesaner, go to **Settings → Plugins → Developer Mode** and load the plugin from your local path.

## Next Steps

- [Plugin SDK Overview](/docs/plugin-development/sdk/overview)
- [Development Environment Setup](/docs/plugin-development/getting-started/dev-setup)
- [Plugin Manifest Reference](/docs/plugin-development/getting-started/manifest)
