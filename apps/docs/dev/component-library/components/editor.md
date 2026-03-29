---
title: Editor Components
description: EditorRoot, Toolbar, BubbleMenu — TipTap-based editor components.
---

# Editor Components

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

These components are part of the `libs/editor-core` library and expose TipTap's editor as a set of React components.

## EditorRoot

```tsx
import { EditorRoot, EditorContent } from '@notesaner/editor-core';

<EditorRoot>
  <EditorContent noteId={noteId} initialContent={content} onUpdate={handleUpdate} />
</EditorRoot>;
```

## Toolbar

The editor toolbar with formatting controls.

## BubbleMenu

The floating bubble menu that appears on text selection.
