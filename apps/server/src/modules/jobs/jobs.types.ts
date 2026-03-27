/** Payload for the INDEX_NOTE_JOB BullMQ job. */
export interface IndexNoteJobData {
  noteId: string;
  workspaceId: string;
  /** Absolute filesystem path to the note's .md file. */
  filePath: string;
}

/** Payload for the REINDEX_WORKSPACE_JOB BullMQ job. */
export interface ReindexWorkspaceJobData {
  workspaceId: string;
}

/** Structured result returned by the note-indexing processor. */
export interface IndexNoteJobResult {
  noteId: string;
  indexed: boolean;
  durationMs: number;
}

/** Structured result returned by the workspace reindex processor. */
export interface ReindexWorkspaceJobResult {
  workspaceId: string;
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}
