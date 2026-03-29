---
title: Zettelkasten Method
description: How to implement the Zettelkasten note-linking methodology in Notesaner.
---

# Zettelkasten Method

The Zettelkasten ("slip box") is a personal knowledge management method developed by sociologist Niklas Luhmann. It emphasizes atomic notes, explicit connections, and emergent structure.

## Core Principles

1. **Atomic notes**: Each note contains exactly one idea
2. **Explicit links**: Connect related ideas with wikilinks
3. **Emergent structure**: Avoid rigid hierarchies — let structure emerge from links
4. **Permanent IDs**: Each note has a unique, stable identifier

## Implementing in Notesaner

### Note IDs

Use a date-based prefix for unique IDs:

```
202603291430 - The Zettelkasten Method.md
```

Or use the front matter:

```yaml
---
id: '202603291430'
tags: [zettelkasten, method]
---
```

### Types of Notes

| Type                 | Description                                 |
| -------------------- | ------------------------------------------- |
| **Fleeting notes**   | Quick captures, processed daily             |
| **Literature notes** | Summaries of sources you consume            |
| **Permanent notes**  | Processed, atomic ideas in your own words   |
| **Index notes**      | Entry points into clusters of related notes |

### Workflow

1. Capture fleeting notes throughout the day
2. Process them into permanent notes each evening
3. Link each permanent note to existing related notes
4. Create index notes when clusters emerge

## Resources

- [Internal Links](/help/user-guide/linking/internal-links)
- [Graph View](/help/user-guide/linking/graph-view)
- [Backlinks](/help/user-guide/linking/backlinks)
