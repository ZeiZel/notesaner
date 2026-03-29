---
title: Permission System
description: Plugin capability permissions — what they grant and how they're enforced.
---

# Permission System

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

See [Plugin Manifest Reference](/docs/plugin-development/getting-started/manifest) for the full list of capabilities and what they grant.

## Permission Enforcement

Capabilities are enforced at the host bridge level. When a plugin makes a request (e.g. `sdk.notes.write()`), the host checks that the plugin declared the `notes.write` capability in its manifest before executing the operation.

Undeclared capabilities return an error: `{ code: 'PERMISSION_DENIED', message: '...' }`.

## User Consent

When a user installs a community plugin, they see a permissions dialog listing all requested capabilities. The user must explicitly approve before installation completes.
