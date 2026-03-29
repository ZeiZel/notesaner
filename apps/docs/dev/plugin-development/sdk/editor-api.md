---
title: Editor API
description: Reading and writing note content, cursor, selections, marks.
---

# Editor API

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

The Editor API allows plugins to interact with the TipTap editor when a note is open.

## Reading Content

```typescript
// Get current note's content as Markdown
const markdown = await sdk.editor.getContent('markdown');

// Get content as ProseMirror JSON
const json = await sdk.editor.getContent('json');
```

## Writing Content

```typescript
// Replace entire content
await sdk.editor.setContent('# New Content\n\nHello!', 'markdown');

// Insert at cursor position
await sdk.editor.insertAtCursor('Inserted text');

// Insert at end
await sdk.editor.appendContent('\n\n## Appended Section');
```

## Cursor and Selection

```typescript
// Get current cursor position
const { from, to } = await sdk.editor.getSelection();

// Set cursor position
await sdk.editor.setSelection({ from: 10, to: 10 });

// Get selected text
const selected = await sdk.editor.getSelectedText();
```
