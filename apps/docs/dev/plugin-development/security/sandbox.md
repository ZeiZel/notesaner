---
title: iframe Sandbox Restrictions
description: What is and isn't allowed in plugin iframes, including the CSP policy.
---

# iframe Sandbox Restrictions

Notesaner plugins run in iframes with strict sandbox attributes and Content Security Policy.

## Sandbox Attributes

```html
<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe>
```

**What is allowed:**

- Running JavaScript (`allow-scripts`)
- Submitting forms (`allow-forms`)
- Opening popup windows (`allow-popups`)
- Showing modal dialogs (`allow-modals`)

**What is NOT allowed (no attribute = blocked):**

- `allow-same-origin` — plugins cannot access the parent window
- `allow-top-navigation` — plugins cannot navigate the parent page
- `allow-downloads` — plugins cannot trigger downloads (must use host bridge)
- Storage access — localStorage and cookies of the host are inaccessible

## Content Security Policy

Default CSP for plugin iframes:

```
default-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
```

Plugins with the `network` capability get:

```
connect-src 'self' https:;
```

## What Plugins Cannot Do

1. Read other notes (without `notes.read` capability)
2. Access user authentication tokens
3. Read parent window DOM or JavaScript context
4. Make requests to arbitrary URLs (without `network` capability)
5. Access the filesystem directly
6. Execute native code

## Reporting Security Issues

If you find a security vulnerability in the plugin sandbox, report it to security@notesaner.com.
