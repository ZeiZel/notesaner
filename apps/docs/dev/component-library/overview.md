---
title: Component Library Overview
description: The @notesaner/ui shared component library — installation, usage, and Storybook.
---

# Component Library Overview

The `@notesaner/ui` package (`packages/ui`) provides shared React UI components used across the Notesaner web application.

:::info Storybook
An interactive component browser is planned via Storybook. This will be linked here when available.
:::

## Installation

The component library is internal to the monorepo. Import components in any workspace package:

```typescript
import { Button, Box, Flex } from '@notesaner/ui';
```

## Design Foundation

The component library is built on:

- **shadcn/ui** — headless, accessible primitives
- **Ant Design** — primary UI library for complex components (forms, tables, menus)
- **Tailwind CSS 4** — utility-first styling
- **CSS Variables** — design tokens for theming

## Usage Guidelines

- Use `Box` instead of raw `<div>` or `<span>`
- Use `Flex` / `Grid` / `Stack` for layout
- Never use raw HTML elements for UI — always use a component

## See Also

- [Design Tokens](/docs/component-library/design-tokens)
- [Theming & CSS Variables](/docs/component-library/theming)
- [Contributing to the Component Library](/docs/component-library/contributing)
