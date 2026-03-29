---
title: Import from Obsidian / Notion / Logseq
description: Step-by-step import guides for migrating your notes from other apps.
sidebar_position: 7
---

# Import from Obsidian / Notion / Logseq

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Importing from Obsidian

Since Obsidian vaults are just folders of Markdown files, importing is straightforward:

1. Go to **Settings → Import**
2. Select **Obsidian Vault**
3. Upload your vault folder (zipped) or point to the folder path (self-hosted)
4. Notesaner will preserve your `[[wikilinks]]`, tags, and folder structure

## Importing from Notion

1. In Notion, export your workspace as **Markdown & CSV**
2. Go to **Settings → Import** in Notesaner
3. Select **Notion Export**
4. Upload the exported `.zip` file

:::note
Notion database properties are converted to front matter fields. Some block types may not have a direct Markdown equivalent.
:::

## Importing from Logseq

1. In Logseq, go to **Settings → Export graph → Export as standard Markdown**
2. In Notesaner, go to **Settings → Import → Logseq**
3. Upload the exported folder
