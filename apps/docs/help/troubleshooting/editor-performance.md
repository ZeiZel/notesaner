---
title: Editor Performance
description: Troubleshoot slow editor performance and lag.
---

# Editor Performance

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Common Causes

| Issue                            | Solution                               |
| -------------------------------- | -------------------------------------- |
| Very large note (>500KB)         | Split into smaller notes               |
| Many embedded images             | Use linked images instead of inline    |
| Mermaid diagrams on every render | Disable auto-render in plugin settings |
| Too many open tabs               | Close unused tabs                      |

## Disable GPU Acceleration

If the editor is flickering, try disabling GPU acceleration in **Settings → Advanced → Disable hardware acceleration**.
