---
title: Advanced Search Syntax
description: Powerful search operators for filtering notes by tags, dates, properties, and more.
---

# Advanced Search Syntax

Notesaner supports a rich search query language for precise filtering.

## Operators

| Operator    | Example                   | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `tag:`      | `tag:meeting`             | Notes with a specific tag         |
| `folder:`   | `folder:Projects`         | Notes in a specific folder        |
| `property:` | `property:status = draft` | Notes where property equals value |
| `before:`   | `before:2026-01-01`       | Notes modified before date        |
| `after:`    | `after:2026-01-01`        | Notes modified after date         |
| `-`         | `-tag:archive`            | Exclude notes matching operator   |
| `"..."`     | `"exact phrase"`          | Exact phrase match                |

## Boolean Operators

```
meeting AND project
meeting OR standup
project NOT archived
```

## Examples

```
tag:meeting after:2026-01-01
"quarterly review" folder:Work
property:status = "in-progress" tag:project
```

## Saving Searches

See [Saved Searches](/help/user-guide/search/saved-searches) to bookmark queries you run frequently.
