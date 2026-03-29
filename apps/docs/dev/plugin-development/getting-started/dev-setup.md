---
title: Development Environment Setup
description: pnpm, NX, hot reload, and the plugin dev server.
---

# Development Environment Setup

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Requirements

- Node.js 20+
- pnpm 10+
- A running Notesaner instance (local or remote)

## Running the Plugin Dev Server

```bash
pnpm dev
```

The dev server runs at `http://localhost:5173` and provides hot module reload.

## Loading a Dev Plugin

1. Enable Developer Mode in Notesaner: **Settings → Plugins → Developer Mode**
2. Click **Load Dev Plugin**
3. Enter your dev server URL: `http://localhost:5173`

The plugin reloads automatically when you save changes.

## Debugging

Open the plugin iframe's DevTools by right-clicking the plugin panel → **Inspect**. This opens a separate DevTools window for the iframe context.
