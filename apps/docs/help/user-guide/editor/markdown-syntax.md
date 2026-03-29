---
title: Markdown Syntax Reference
description: Complete Markdown cheat sheet for the Notesaner editor.
---

# Markdown Syntax Reference

Notesaner uses standard CommonMark Markdown with several extensions (GFM tables, wikilinks, front matter).

## Headings

```markdown
# Heading 1

## Heading 2

### Heading 3

#### Heading 4
```

## Text Formatting

```markdown
**Bold**
_Italic_
~~Strikethrough~~
`Inline code`
==Highlight==
```

## Lists

```markdown
- Unordered item
- Another item
  - Nested item

1. Ordered item
2. Second item

- [ ] Task item (unchecked)
- [x] Task item (checked)
```

## Links

```markdown
[External link](https://example.com)
[[Internal wikilink]]
[[Note Title|Display Text]]
```

## Code Blocks

````markdown
```typescript
const message = 'Hello, Notesaner!';
console.log(message);
```
````

## Tables

```markdown
| Column A | Column B | Column C |
| -------- | -------- | -------- |
| Value 1  | Value 2  | Value 3  |
```

## Blockquotes

```markdown
> This is a blockquote.
> It can span multiple lines.
```

## Horizontal Rule

```markdown
---
```

## Images

```markdown
![Alt text](path/to/image.png)
![Alt text](path/to/image.png 'Title')
```

## Callouts

```markdown
:::note
A note callout.
:::

:::tip
A helpful tip.
:::

:::warning
A warning callout.
:::

:::danger
A danger/error callout.
:::
```

## Front Matter

```yaml
---
title: My Note Title
tags: [project, meeting]
date: 2026-03-29
author: Jane Doe
---
```
