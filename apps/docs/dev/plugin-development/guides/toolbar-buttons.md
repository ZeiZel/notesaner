---
title: Adding Toolbar Buttons
description: Register custom buttons in the TipTap editor toolbar from a plugin.
---

# Adding Toolbar Buttons

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

See [UI Components API](/docs/plugin-development/sdk/ui-api) for the full API.

```typescript
sdk.ui.registerToolbarButton({
  id: 'summarize',
  title: 'Summarize with AI',
  icon: '✨',
  position: 'end',
  onClick: async () => {
    const content = await sdk.editor.getContent('markdown');
    const summary = await callMyAiApi(content);
    await sdk.editor.appendContent(`\n\n---\n\n**Summary**: ${summary}`);
  },
});
```
