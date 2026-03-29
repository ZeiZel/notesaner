---
title: Theming & CSS Variables
description: Override design tokens via CSS variables for custom themes.
---

# Theming & CSS Variables

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

All Notesaner design tokens are CSS variables. Override them in your custom CSS to create themes.

## Theme Structure

```css
/* Light theme (default) */
:root {
  --ns-color-bg: white;
  --ns-color-text: #111;
  --ns-color-border: #e5e7eb;
  --ns-color-primary: #6c47ff;
}

/* Dark theme */
[data-theme='dark'] {
  --ns-color-bg: #0f0f13;
  --ns-color-text: #f9fafb;
  --ns-color-border: #374151;
  --ns-color-primary: #a888ff;
}
```

## Ant Design Token Override

```typescript
// Ant Design ConfigProvider tokens
const antdTheme = {
  token: {
    colorPrimary: '#6c47ff',
    borderRadius: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};
```
