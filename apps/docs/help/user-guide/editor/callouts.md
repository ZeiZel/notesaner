---
title: Callouts
description: Info, warning, tip, and danger callout block types in Notesaner.
---

# Callouts

Callouts (also called admonitions) are highlighted blocks used to draw attention to important information.

## Types

| Type      | When to use                            |
| --------- | -------------------------------------- |
| `note`    | General supplementary information      |
| `tip`     | Helpful suggestions and best practices |
| `info`    | Neutral informational content          |
| `warning` | Caution — something to be aware of     |
| `danger`  | Critical warnings, potential data loss |

## Syntax

```markdown
:::note
This is a note.
:::

:::tip My Custom Title
This is a tip with a custom title.
:::

:::warning
Watch out for this!
:::

:::danger
This action cannot be undone.
:::
```

## Nested Content

Callouts can contain any Markdown content, including code blocks, lists, and links.

```markdown
:::tip Pro Tip
You can use `[[wikilinks]]` inside callouts:

- [Create your first note](/help/getting-started/first-note)
- [Keyboard shortcuts](/help/getting-started/keyboard-shortcuts)
  :::
```
