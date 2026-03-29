---
title: Plugin Guidelines & Policies
description: Rules and best practices for plugins in the Notesaner registry.
---

# Plugin Guidelines & Policies

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Required

- Plugins must be open-source (MIT, Apache 2.0, or similar)
- Plugins must not collect user data without explicit consent and a privacy policy
- Plugins must not use more capabilities than necessary
- Plugins must work offline if they don't require `network`

## Prohibited

- Data exfiltration
- Cryptocurrency mining
- Advertising injection
- Impersonating other plugins
- Obfuscated code (source must be human-readable or build from open source)

## Quality Standards

- Plugin must work with the declared `minAppVersion`
- README must include screenshots or a demo GIF
- Must have a way to report bugs (GitHub issues or email)
