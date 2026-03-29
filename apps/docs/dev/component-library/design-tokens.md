---
title: Design Tokens
description: Colors, spacing, typography, and other design tokens.
---

# Design Tokens

Design tokens are the visual building blocks — colors, typography, spacing, radii — defined as CSS variables.

## Colors

```css
:root {
  /* Primary */
  --ns-color-primary-50: #f0ebff;
  --ns-color-primary-500: #6c47ff;
  --ns-color-primary-900: #2a1299;

  /* Neutral */
  --ns-color-gray-50: #f9fafb;
  --ns-color-gray-500: #6b7280;
  --ns-color-gray-950: #030712;

  /* Semantic */
  --ns-color-success: #22c55e;
  --ns-color-warning: #f59e0b;
  --ns-color-error: #ef4444;
  --ns-color-info: #3b82f6;
}
```

## Typography

```css
:root {
  --ns-font-sans: 'Inter', system-ui, sans-serif;
  --ns-font-mono: 'JetBrains Mono', monospace;

  --ns-text-xs: 0.75rem; /* 12px */
  --ns-text-sm: 0.875rem; /* 14px */
  --ns-text-base: 1rem; /* 16px */
  --ns-text-lg: 1.125rem; /* 18px */
  --ns-text-xl: 1.25rem; /* 20px */
  --ns-text-2xl: 1.5rem; /* 24px */
  --ns-text-3xl: 1.875rem; /* 30px */
  --ns-text-4xl: 2.25rem; /* 36px */
}
```

## Spacing

Based on a 4px grid:

```css
:root {
  --ns-space-1: 0.25rem; /* 4px */
  --ns-space-2: 0.5rem; /* 8px */
  --ns-space-3: 0.75rem; /* 12px */
  --ns-space-4: 1rem; /* 16px */
  --ns-space-6: 1.5rem; /* 24px */
  --ns-space-8: 2rem; /* 32px */
  --ns-space-12: 3rem; /* 48px */
  --ns-space-16: 4rem; /* 64px */
}
```

## Border Radius

```css
:root {
  --ns-radius-sm: 4px;
  --ns-radius-md: 8px;
  --ns-radius-lg: 12px;
  --ns-radius-xl: 16px;
  --ns-radius-full: 9999px;
}
```
