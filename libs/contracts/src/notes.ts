export interface NoteDto {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  contentHash: string | null;
  wordCount: number;
  frontmatter: Record<string, unknown>;
  isPublished: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  lastEditedById: string;
}

export interface NoteLinkDto {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  linkType: LinkType;
  context: string | null;
}

export type LinkType = 'WIKI' | 'MARKDOWN' | 'EMBED' | 'BLOCK_REF';

export interface NoteVersionDto {
  id: string;
  noteId: string;
  version: number;
  content: string;
  diff: string | null;
  message: string | null;
  createdAt: string;
  createdById: string;
}

export interface TagDto {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  noteCount: number;
}

export interface AttachmentDto {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
}

export interface CreateNoteDto {
  path: string;
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateNoteDto {
  title?: string;
  path?: string;
  content?: string;
  isPublished?: boolean;
  tags?: string[];
}

export interface NoteSearchParams {
  query: string;
  tags?: string[];
  folder?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'relevance' | 'updatedAt' | 'createdAt' | 'title';
  limit?: number;
  offset?: number;
}

export interface NoteSearchResult {
  notes: NoteDto[];
  total: number;
  highlights: Record<string, string[]>;
}

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  tags: string[];
  connectionCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  linkType: LinkType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ==========================================
// Block References
// ==========================================

/** A single block extracted from a note's markdown content. */
export interface BlockDto {
  /** The block identifier (without the ^ prefix). */
  blockId: string;
  /** The full text content of the block (without the ^blockId suffix). */
  content: string;
  /** 1-based line number where this block starts in the source file. */
  line: number;
}

/** Response for GET /workspaces/:workspaceId/notes/:noteId/blocks */
export interface BlockListResponse {
  /** UUID of the note. */
  noteId: string;
  /** All blocks found in the note, ordered by line number. */
  blocks: BlockDto[];
}

/** Request body for POST /workspaces/:workspaceId/notes/:noteId/blocks */
export interface CreateBlockReferenceRequest {
  /** 1-based line number of the paragraph to tag with a block ID. */
  line: number;
  /** Optional custom block ID. Auto-generated when omitted. */
  blockId?: string;
}

/** Response for POST /workspaces/:workspaceId/notes/:noteId/blocks */
export interface CreateBlockResponse {
  /** The block ID that was assigned (generated or user-provided). */
  blockId: string;
  /** The content of the block. */
  content: string;
  /** The 1-based line number where the block ID was inserted. */
  line: number;
  /** Whether a new block ID was created (false if the line already had one). */
  created: boolean;
}
