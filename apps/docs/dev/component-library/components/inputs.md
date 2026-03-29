---
title: Input Components
description: Button, Input, Select, Checkbox, and other form controls.
---

# Input Components

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

These components wrap Ant Design form controls with Notesaner's design tokens and Tailwind styling.

## Button

```tsx
import { Button } from '@notesaner/ui';

<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Edit</Button>
<Button variant="danger">Delete</Button>
```

## Input

```tsx
import { Input } from '@notesaner/ui';

<Input
  placeholder="Search notes..."
  prefix={<SearchIcon />}
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>;
```

## Select

```tsx
import { Select } from '@notesaner/ui';

<Select
  options={[
    { value: 'editor', label: 'Editor' },
    { value: 'admin', label: 'Admin' },
  ]}
  value={role}
  onChange={setRole}
/>;
```

## Checkbox

```tsx
import { Checkbox } from '@notesaner/ui';

<Checkbox checked={enabled} onChange={setEnabled}>
  Enable feature
</Checkbox>;
```
