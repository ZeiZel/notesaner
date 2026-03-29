---
title: Front Matter & Properties
description: YAML front matter, the property panel, and custom fields.
---

# Front Matter & Properties

Front matter is YAML metadata placed at the very top of a note, between `---` delimiters.

## Basic Syntax

```yaml
---
title: Meeting Notes
date: 2026-03-29
tags: [meeting, project-alpha]
author: Jane Doe
status: draft
---
```

## Built-in Properties

| Property      | Description                                    |
| ------------- | ---------------------------------------------- |
| `title`       | Overrides the note's filename as display title |
| `date`        | Creation or publication date (ISO 8601)        |
| `tags`        | Array of tag strings                           |
| `description` | Short description, shown in search results     |
| `aliases`     | Alternative names for wikilink autocomplete    |

## Custom Properties

You can define any custom key-value pairs. They appear in the **Properties panel** in the right sidebar.

## Properties Panel

The properties panel provides a visual form for editing front matter without writing YAML directly. Toggle it with `Cmd+P` / `Ctrl+P`.

## Filtering by Properties

Use [Advanced Search](/help/user-guide/search/advanced-syntax) to filter notes by property values:

```
property:status = "published"
property:date > 2026-01-01
```
