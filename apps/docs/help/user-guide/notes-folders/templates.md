---
title: Templates
description: Create and use note templates with variable substitution.
---

# Templates

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Creating a Template

1. Create a note with the content you want to reuse
2. In the note menu, select **Save as Template**
3. Give the template a name

## Using a Template

- Press `Cmd+T` / `Ctrl+T` to open the template picker
- Select a template to create a new note from it

## Template Variables

Templates support dynamic variables:

| Variable     | Output                            |
| ------------ | --------------------------------- |
| `{{date}}`   | Today's date (`2026-03-29`)       |
| `{{time}}`   | Current time (`14:30`)            |
| `{{title}}`  | Note title (prompted at creation) |
| `{{author}}` | Current user's display name       |

See also: [Templates Plugin](/help/plugins/templates)
