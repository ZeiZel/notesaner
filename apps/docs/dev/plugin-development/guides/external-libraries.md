---
title: Using External Libraries
description: Bundle external npm packages into your Notesaner plugin.
---

# Using External Libraries

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Since plugins run in iframes with their own JS context, you can bundle any npm package.

## Bundling with the Default Setup

The `create-notesaner-plugin` scaffolder uses Vite. Add dependencies normally:

```bash
pnpm add lodash-es dayjs
```

They'll be bundled into `dist/index.js` automatically.

## Network Capability for CDN Imports

If you use dynamic CDN imports (`https://cdn.jsdelivr.net/...`), add the `network` capability to your manifest and declare the allowed origins.

## Size Considerations

Plugin bundles are cached by the browser but users download them on first install. Keep bundle size reasonable:

- Target: < 500 KB
- Use tree-shaking (ES modules)
- Avoid bundling large assets
