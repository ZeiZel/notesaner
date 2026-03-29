---
title: Code Blocks
description: Syntax highlighting, language selection, and code copy in the editor.
---

# Code Blocks

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Creating a Code Block

Type triple backticks followed by a language name:

````markdown
```typescript
const greeting = (name: string) => `Hello, ${name}!`;
```
````

Or use the slash menu: type `/code` and select **Code Block**.

## Supported Languages

Notesaner supports syntax highlighting for 100+ languages via Prism.js, including:
`typescript`, `javascript`, `python`, `rust`, `go`, `java`, `bash`, `sql`, `yaml`, `json`, `dockerfile`, `nginx`, `markdown`

## Copy Button

Every code block includes a copy button in the top-right corner.

## Inline Code

Wrap text in backticks for inline code: `` `code here` ``
