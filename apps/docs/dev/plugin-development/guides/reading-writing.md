---
title: Reading & Writing Notes
description: How to read note content and write changes back from a plugin.
---

# Reading & Writing Notes

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

See [Editor API](/docs/plugin-development/sdk/editor-api) and [Storage API](/docs/plugin-development/sdk/storage-api) for the full API reference.

## Read Current Note

```typescript
const content = await sdk.editor.getContent('markdown');
```

## Modify Current Note

```typescript
await sdk.editor.setContent(modifiedContent, 'markdown');
```

## Read Any Note

```typescript
const note = await sdk.storage.read('path/to/note.md');
```
