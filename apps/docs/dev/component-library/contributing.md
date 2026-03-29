---
title: Contributing to the Component Library
description: How to add, modify, and test components in @notesaner/ui.
---

# Contributing to the Component Library

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Adding a New Component

1. Create the component file in `packages/ui/src/components/`
2. Export it from `packages/ui/src/index.ts`
3. Add a Storybook story (when Storybook is set up)
4. Document the props and usage on this docs site

## Component Standards

- Use TypeScript for all components
- Props must have explicit TypeScript types (no `any`)
- Use `cn()` for conditional class names
- Expose `className` and `style` props for customization
- Test with Vitest + React Testing Library

## Code Style

Follow the project's TypeScript guidelines in [Contributing Standards](/docs/contributing/standards/typescript).
