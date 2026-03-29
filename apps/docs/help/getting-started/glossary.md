---
title: Glossary
description: Definitions of key terms used throughout Notesaner documentation.
sidebar_position: 10
---

# Glossary

| Term                | Definition                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Workspace**       | The top-level container for all notes, settings, and members. Equivalent to an Obsidian vault or a Notion workspace.      |
| **Note**            | A single Markdown file. Notes have a title, content, optional front matter, and tags.                                     |
| **Block**           | A structural unit within a note — a paragraph, heading, list item, code block, etc.                                       |
| **Front Matter**    | YAML metadata at the top of a note, enclosed in `---` delimiters. Used for properties like tags, date, and custom fields. |
| **Wikilink**        | An internal link using `[[Note Title]]` syntax that connects two notes.                                                   |
| **Backlink**        | A link from another note pointing to the current note. Shown in the Backlinks panel.                                      |
| **Graph**           | A visual representation of notes as nodes and links as edges.                                                             |
| **Plugin**          | An extension that adds features to Notesaner. Runs in an isolated iframe sandbox.                                         |
| **Workspace Admin** | A user with full permissions in a workspace — can invite members, manage settings, and install plugins.                   |
| **CRDT**            | Conflict-free Replicated Data Type. The algorithm (Yjs) that enables real-time collaboration without merge conflicts.     |
| **Tag**             | A label added to notes using `#tagname` syntax or front matter. Used for cross-folder organization.                       |
| **Property**        | A key-value pair in a note's front matter. Also shown in the Properties panel.                                            |
| **Template**        | A note that serves as a starting point for new notes. Supports variables like `{{date}}`.                                 |
| **Daily Note**      | A note automatically created for a specific date, typically following a template.                                         |
| **Plugin SDK**      | The developer library (`libs/plugin-sdk`) for building Notesaner plugins.                                                 |
