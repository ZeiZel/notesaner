---
title: UI Components API
description: Render React components into plugin panels and toolbar slots.
---

# UI Components API

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Registering a Sidebar Panel

```typescript
sdk.ui.registerSidebarPanel({
  id: 'my-panel',
  title: 'My Plugin',
  icon: '🔌',
  position: 'left', // or 'right'
  render: (container) => {
    // Render into the container element (vanilla JS, React, Vue, etc.)
    container.innerHTML = '<div>Plugin content</div>';
  },
});
```

## Registering a Toolbar Button

```typescript
sdk.ui.registerToolbarButton({
  id: 'my-button',
  title: 'My Action',
  icon: '<svg>...</svg>',
  onClick: async () => {
    const content = await sdk.editor.getSelectedText();
    // Process content
  },
});
```

## Showing a Modal

```typescript
sdk.ui.showModal({
  title: 'My Modal',
  width: 480,
  content: '<div>Modal content</div>',
  footer: [
    { label: 'Cancel', onClick: 'close' },
    { label: 'Confirm', onClick: handleConfirm, variant: 'primary' },
  ],
});
```
