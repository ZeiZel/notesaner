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
