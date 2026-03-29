---
title: Tags
description: Organize notes with tags using #hashtag syntax or front matter.
---

# Tags

Tags provide a flexible way to categorize notes across folders.

## Adding Tags

**Inline**: Type `#tagname` anywhere in your note content.

**Front matter**:

```yaml
---
tags: [project, meeting, Q1-2026]
---
```

## Nested Tags

Tags support hierarchy with `/`:

```
#project/alpha
#project/beta
```

## Tags Panel

The Tags panel in the left sidebar shows all tags in your workspace. Click a tag to filter notes by it.

## Removing Tags

Remove a tag by deleting the `#tagname` from the note content or the `tags` array in front matter.
