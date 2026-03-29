---
title: Internal Links
description: Create wikilinks between notes using [[double bracket]] syntax.
---

# Internal Links

Internal links (wikilinks) connect your notes to build a personal knowledge graph.

## Creating a Link

Type `[[` anywhere in the editor to trigger the link autocomplete. Start typing the note title and select from the suggestions.

```markdown
See my thoughts on [[Zettelkasten Method]].
```

## Link Aliases

Display a different text than the note title:

```markdown
[[Zettelkasten Method|Zettel]]
```

## Linking to Headings

Link to a specific section within a note:

```markdown
[[Note Title#Section Heading]]
```

## Link Preview

Hover over a wikilink to preview the linked note without opening it.

## Broken Links

If a linked note is deleted or renamed (and the rename wasn't propagated), the link is shown with a warning indicator. Click it to create the missing note or update the link.
