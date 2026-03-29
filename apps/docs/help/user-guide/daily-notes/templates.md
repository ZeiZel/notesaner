---
title: Journal Templates
description: Set up templates for your daily notes and journal entries.
---

# Journal Templates

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Create a note to use as the template for new daily notes. Use variables to automatically insert the date and other context.

## Example Daily Note Template

```markdown
---
date: { { date } }
tags: [journal, daily-note]
---

# {{date:MMMM D, YYYY}}

## Today's Focus

-

## Notes

## End of Day Reflection
```

## Template Variables in Daily Notes

| Variable                | Output                   |
| ----------------------- | ------------------------ |
| `{{date}}`              | `2026-03-29`             |
| `{{date:MMMM D, YYYY}}` | `March 29, 2026`         |
| `{{time}}`              | `14:30`                  |
| `{{yesterday}}`         | Link to yesterday's note |
| `{{tomorrow}}`          | Link to tomorrow's note  |
