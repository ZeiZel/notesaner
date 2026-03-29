---
title: Kanban Board
description: Card-based task tracking on tagged notes.
---

# Kanban Board

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

The Kanban Board plugin displays notes as cards organized in columns based on a front matter property.

## Setup

1. Create a folder for your tasks (e.g. `Tasks/`)
2. Add `status` front matter to each task note:
   ```yaml
   ---
   status: 'todo'
   ---
   ```
3. Open the folder → click the **Kanban** view button

## Columns

Columns are defined by the unique values of the configured property (default: `status`). Drag cards between columns to update the property.

## Common Workflow

Columns: `todo` → `in-progress` → `review` → `done`
