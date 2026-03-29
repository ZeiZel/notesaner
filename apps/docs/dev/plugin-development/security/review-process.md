---
title: Plugin Review Process
description: How community plugins are reviewed before appearing in the registry.
---

# Plugin Review Process

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Community plugins go through a review process before being listed in the public registry.

## Automated Checks

- Manifest schema validation
- Dependency vulnerability scan
- Bundle size check (< 5 MB)
- CSP compliance check

## Manual Review

Maintainers review:

- Declared capabilities vs actual usage
- Code for suspicious patterns (data exfiltration, etc.)
- Privacy policy (required for plugins with `network` capability)

## Review Timeline

Expect 2–7 business days for initial review. Updates to existing approved plugins are reviewed faster (1–3 days).
