---
title: Built-in Auth
description: Email and password authentication configuration.
---

# Built-in Authentication

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Notesaner ships with email/password authentication enabled by default.

## Configuration

```env
AUTH_LOCAL_ENABLED=true
JWT_SECRET=your-32-char-minimum-secret
JWT_EXPIRES_IN=7d
```

## User Registration

By default, registration is open. To restrict to invite-only:

```env
AUTH_REGISTRATION_OPEN=false
```

With `AUTH_REGISTRATION_OPEN=false`, new users can only join via workspace invite links.
