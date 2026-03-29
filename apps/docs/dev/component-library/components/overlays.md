---
title: Overlay Components
description: Modal, Drawer, Tooltip, Popover.
---

# Overlay Components

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Modal

```tsx
import { Modal } from '@notesaner/ui';

<Modal
  open={isOpen}
  onClose={() => setOpen(false)}
  title="Confirm Delete"
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Delete
      </Button>
    </>
  }
>
  <Text>Are you sure you want to delete this note?</Text>
</Modal>;
```

## Drawer

```tsx
<Drawer open={isOpen} onClose={onClose} placement="right" title="Settings">
  {/* Drawer content */}
</Drawer>
```

## Tooltip

```tsx
<Tooltip content="Bold (⌘B)">
  <Button icon={<BoldIcon />} />
</Tooltip>
```
