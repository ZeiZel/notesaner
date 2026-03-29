---
title: Custom CSS
description: Override styles with your own CSS snippets.
---

# Custom CSS

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

You can apply custom CSS snippets to tweak Notesaner's appearance without creating a full theme.

## Enabling Custom CSS

Go to **Settings → Appearance → Custom CSS** and paste your CSS.

## CSS Variables

Notesaner exposes design tokens as CSS variables:

```css
:root {
  --ns-color-primary: #6c47ff;
  --ns-font-sans: 'Inter', sans-serif;
  --ns-font-mono: 'JetBrains Mono', monospace;
  --ns-sidebar-width: 280px;
  --ns-editor-max-width: 720px;
}
```
