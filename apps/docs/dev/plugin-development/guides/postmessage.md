---
title: Communicating via postMessage (iframe sandbox)
description: The postMessage protocol between plugin iframe and the Notesaner host.
---

# Communicating via postMessage

The Plugin SDK handles postMessage communication automatically. This page documents the underlying protocol for advanced use cases.

## Message Format

All messages follow this structure:

### Plugin → Host (Request)

```typescript
interface PluginRequest {
  type: 'PLUGIN_REQUEST';
  pluginId: string;
  requestId: string; // UUID for response matching
  method: string; // e.g. 'notes.read'
  args: unknown;
}
```

### Host → Plugin (Response)

```typescript
interface PluginResponse {
  type: 'PLUGIN_RESPONSE';
  requestId: string; // Matches request
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}
```

### Host → Plugin (Event)

```typescript
interface PluginEvent {
  type: 'PLUGIN_EVENT';
  event: string; // e.g. 'note.saved'
  data: unknown;
}
```

## Sending a Request Manually

If you need to bypass the SDK:

```typescript
const requestId = crypto.randomUUID();

window.parent.postMessage(
  {
    type: 'PLUGIN_REQUEST',
    pluginId: 'my-plugin',
    requestId,
    method: 'notes.read',
    args: { noteId: 'note_123' },
  },
  '*',
);

// Wait for response
window.addEventListener('message', (event) => {
  if (event.data?.type === 'PLUGIN_RESPONSE' && event.data.requestId === requestId) {
    console.log(event.data.result);
  }
});
```

:::warning
Only use `origin: '*'` in development. In production, validate `event.origin` against the known host origin.
:::
