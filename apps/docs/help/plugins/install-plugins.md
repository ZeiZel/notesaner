---
title: Installing Community Plugins
description: Browse the plugin registry and install community plugins.
---

# Installing Community Plugins

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Plugin Registry

The Notesaner Plugin Registry is a GitHub-based catalog of community plugins.

## Installing a Plugin

1. Go to **Settings → Plugins → Community Plugins**
2. Browse or search for a plugin
3. Click **Install** — the plugin is downloaded and installed automatically
4. Toggle it on to enable it

## Trust Model

Community plugins run in an isolated iframe sandbox and cannot access:

- Other notes (without explicit permission)
- Network requests to unauthorized origins
- Your local filesystem directly

Each plugin declares its required permissions in its manifest. You're shown the permissions before installing.

## See Also

- [Plugin Development Guide](/docs/plugin-development/getting-started/architecture)
