---
title: Storage API
description: Read and write note files, create notes, and access metadata via the Storage API.
---

# Storage API

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

The Storage API gives plugins access to notes as files.

```typescript
// List notes in a folder
const notes = await sdk.storage.list('Projects/');

// Read a note
const note = await sdk.storage.read('Projects/Meeting Notes.md');
console.log(note.content); // Markdown string
console.log(note.frontMatter); // Parsed YAML object

// Create a note
await sdk.storage.create({
  title: 'New Note',
  folder: 'Projects/',
  content: '# New Note\n\nContent here.',
});

// Update a note
await sdk.storage.update('note_id', {
  content: '# Updated Content',
});
```
