---
title: Settings API
description: Create a settings panel for your plugin with typed settings.
---

# Settings API

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Defining Settings

```typescript
sdk.settings.define({
  schema: {
    apiKey: {
      type: 'string',
      label: 'API Key',
      description: 'Your service API key',
      required: true,
      secret: true,
    },
    maxResults: {
      type: 'number',
      label: 'Max Results',
      default: 10,
      min: 1,
      max: 100,
    },
    enabled: {
      type: 'boolean',
      label: 'Enable Feature',
      default: true,
    },
  },
});
```

## Reading Settings

```typescript
const settings = await sdk.settings.get();
console.log(settings.apiKey); // 'abc123'
console.log(settings.maxResults); // 10
```

## Watching for Changes

```typescript
sdk.settings.onChange((settings) => {
  reinitialize(settings);
});
```
