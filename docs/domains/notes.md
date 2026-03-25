# Domain: Notes

## Overview

Core domain responsible for creating, editing, storing, versioning, and searching markdown notes with Zettelkasten linking.

## Entities

### Note
```typescript
interface Note {
  id: string;                  // UUID
  workspaceId: string;         // belongs to workspace
  path: string;                // relative path in vault (e.g., "folder/note.md")
  title: string;               // extracted from first H1 or filename
  content: string;             // markdown content (source of truth: filesystem)
  contentHash: string;         // SHA-256 of content for change detection
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;           // user ID
  lastEditedBy: string;        // user ID
  wordCount: number;
  isPublished: boolean;        // visible to public
  isTrashed: boolean;
  trashedAt: Date | null;
  frontmatter: Record<string, unknown>; // YAML frontmatter parsed
}
```

### NoteLink (Zettelkasten)
```typescript
interface NoteLink {
  id: string;
  sourceNoteId: string;        // note containing the link
  targetNoteId: string;        // linked note
  linkType: 'wiki' | 'markdown' | 'embed'; // [[link]], [text](url), ![[embed]]
  context: string;             // surrounding text for preview
  position: { line: number; col: number }; // position in source
}
```

### NoteVersion
```typescript
interface NoteVersion {
  id: string;
  noteId: string;
  version: number;             // incrementing version number
  content: string;             // full content snapshot
  diff: string;                // diff from previous version
  createdAt: Date;
  createdBy: string;
  message: string | null;      // optional version message
}
```

### Tag
```typescript
interface Tag {
  id: string;
  workspaceId: string;
  name: string;                // tag name (e.g., "project/alpha")
  color: string | null;        // optional color
  noteCount: number;           // cached count
}
```

### Attachment
```typescript
interface Attachment {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;                // bytes
  path: string;                // storage path
  createdAt: Date;
}
```

## Operations

### Write Path
1. User edits in TipTap editor
2. Yjs generates CRDT update
3. Update broadcast via WebSocket to other clients
4. Server debounces updates (500ms)
5. Server serializes Yjs doc → Markdown
6. Server writes MD file to filesystem
7. Server updates metadata in PostgreSQL (hash, wordCount, updatedAt)
8. Server extracts and updates links in `NoteLink` table
9. Server creates `NoteVersion` snapshot (configurable interval)

### Read Path
1. User opens note → request to server
2. Server reads MD file from filesystem
3. Server creates Yjs document from MD content
4. Yjs doc sent to client via WebSocket
5. TipTap renders from Yjs doc
6. Client subscribes to updates on this document

### Search
- **Full-text**: PostgreSQL `tsvector` + GIN index on note content
- **Fuzzy**: `pg_trgm` extension for typo-tolerant search
- **Tag filter**: Junction table `note_tags`
- **Link search**: Graph traversal on `NoteLink` table
- **Frontmatter**: JSONB queries on parsed frontmatter

## Zettelkasten Support

### Link Types
- `[[Note Title]]` — wiki-style link (Obsidian compatible)
- `[[Note Title|Display Text]]` — aliased wiki link
- `[[Note Title#Heading]]` — heading link
- `[[Note Title#^block-id]]` — block reference
- `![[Note Title]]` — note embed (transclusion)
- `![[image.png]]` — image embed

### Backlinks
- Automatic backlink detection via `NoteLink` table
- "Unlinked mentions" — find note titles mentioned in text without explicit link
- Backlinks panel shows context around each link

### Graph
- Nodes = Notes
- Edges = NoteLinks
- Node size = number of connections
- Color coding by folder/tag
- Interactive: click to navigate, hover for preview
- Filters: by tag, folder, date range, link type
