---
title: Layout Components
description: Box, Flex, Grid, Stack — building layouts with the component library.
---

# Layout Components

:::info Coming Soon
This page is under construction. Storybook integration will provide live examples.
:::

## Box

`Box` is the base layout primitive. Use it instead of raw `<div>`.

```tsx
import { Box } from '@notesaner/ui';

<Box p="4" bg="gray.50" rounded="md">
  Content
</Box>;
```

## Flex

`Flex` is a `Box` with `display: flex`.

```tsx
<Flex gap="3" align="center" justify="between">
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>
```

## Grid

```tsx
<Grid columns={3} gap="4">
  <Box>1</Box>
  <Box>2</Box>
  <Box>3</Box>
</Grid>
```

## Stack

`Stack` is a `Flex` with directional spacing.

```tsx
<Stack gap="3" direction="vertical">
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Stack>
```
