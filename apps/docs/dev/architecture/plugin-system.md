---
title: Plugin System (iframe Sandbox)
description: iframe isolation model, postMessage protocol, capability permissions.
---

# Plugin System (iframe Sandbox)

Notesaner plugins run in isolated iframes with a strict Content Security Policy. This prevents plugins from accessing other notes, making arbitrary network requests, or modifying the host application directly.

## Sandbox Architecture

```
┌─────────────────────────────────────────┐
│              Host App (React)           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Plugin Host Bridge              │   │
│  │  (postMessage handler)          │   │
│  └───────────────┬─────────────────┘   │
│                  │ postMessage          │
│  ┌───────────────▼─────────────────┐   │
│  │  <iframe sandbox="...">         │   │
│  │                                 │   │
│  │  Plugin Code                    │   │
│  │  ├── Plugin SDK                 │   │
│  │  └── Plugin Logic               │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## iframe Sandbox Attributes

```html
<iframe
  sandbox="allow-scripts allow-forms allow-popups"
  csp="default-src 'self' 'unsafe-inline'; connect-src *"
/>
```

Notable restrictions:

- `allow-same-origin` is NOT included — plugins cannot access parent window
- Plugins cannot set cookies
- Plugins cannot access localStorage of the host

## postMessage Protocol

All communication between the plugin and host uses a typed message protocol:

```typescript
// Plugin → Host
{ type: 'API_CALL', method: 'notes.read', args: { noteId: '...' }, requestId: '...' }

// Host → Plugin (response)
{ type: 'API_RESPONSE', requestId: '...', result: { content: '...' } }

// Host → Plugin (event)
{ type: 'EVENT', event: 'note.changed', data: { noteId: '...' } }
```

## Capabilities / Permissions

Plugins declare required capabilities in their manifest:

```json
{
  "capabilities": ["notes.read", "notes.write", "ui.toolbar", "storage.local"]
}
```

The user is shown the requested permissions before installing a community plugin.

## See Also

- [Plugin Development Guide](/docs/plugin-development/getting-started/architecture)
- [iframe Sandbox Restrictions](/docs/plugin-development/security/sandbox)
