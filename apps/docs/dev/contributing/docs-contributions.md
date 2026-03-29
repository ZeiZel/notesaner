---
title: Documentation Contributions
description: How to contribute to the Notesaner documentation.
---

# Documentation Contributions

The documentation lives in `apps/docs/` in the main repository.

## Running Docs Locally

```bash
pnpm nx serve docs
```

Open `http://localhost:3000`.

## File Structure

```
apps/docs/
├── help/          # User Help Center (/help/...)
└── dev/           # Developer Docs (/docs/...)
```

## Adding a Page

1. Create a `.md` file in the appropriate directory
2. Add frontmatter: `title`, `description`
3. Add the page ID to the appropriate sidebar in `sidebars.ts` or `sidebars-dev.ts`
4. Write content following the [page template](/docs/DOCS_STRUCTURE#recurring-page-template)

## Style Guide

- Use sentence case for headings (not Title Case)
- Code blocks must specify the language
- Use admonitions (`:::note`, `:::tip`, `:::warning`) for callouts
- Link to related pages using relative paths
- Screenshots should be `1280×720px` PNG

## Common Markdown Patterns

```markdown
:::info Coming Soon
This page is under construction.
:::

:::tip
Use `Cmd+N` to create a new note.
:::

| Column | Column |
| ------ | ------ |
| Value  | Value  |
```
