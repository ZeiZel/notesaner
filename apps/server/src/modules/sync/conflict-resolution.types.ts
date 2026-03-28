/**
 * conflict-resolution.types.ts
 *
 * Types for the Yjs CRDT conflict resolution subsystem.
 *
 * Yjs handles text-level conflict resolution automatically via CRDT semantics.
 * This module focuses on:
 *   - Detecting when a reconnecting client has diverged from the server
 *   - Merging Yjs document states (content)
 *   - Resolving frontmatter (metadata) conflicts via last-write-wins per field
 *   - Logging merge events for audit/debugging
 */

// ─── Frontmatter ────────────────────────────────────────────────────────────

/**
 * A timestamped frontmatter field value.
 * Each field in frontmatter carries its own last-modified timestamp so we can
 * do per-field last-write-wins resolution.
 */
export interface TimestampedField {
  value: unknown;
  /** ISO 8601 timestamp of the last write. */
  updatedAt: string;
  /** ID of the user who last wrote this field. */
  updatedBy: string;
}

/**
 * Frontmatter with per-field timestamps.
 * Used during conflict resolution to determine which field value wins.
 */
export type TimestampedFrontmatter = Record<string, TimestampedField>;

/**
 * Result of resolving frontmatter conflicts between two versions.
 */
export interface FrontmatterResolutionResult {
  /** The merged frontmatter (flat key-value, no timestamps). */
  merged: Record<string, unknown>;
  /** The merged frontmatter with per-field timestamps preserved. */
  mergedTimestamped: TimestampedFrontmatter;
  /** Fields where the server value was kept (client was stale). */
  serverWins: string[];
  /** Fields where the client value was kept (client was newer). */
  clientWins: string[];
  /** Fields that existed on both sides with identical values (no conflict). */
  noConflict: string[];
}

// ─── Conflict Log ───────────────────────────────────────────────────────────

/**
 * The type of merge that occurred.
 */
export enum ConflictMergeType {
  /** Yjs CRDT content merge — automatic, no data loss. */
  CONTENT_CRDT = 'content.crdt',
  /** Frontmatter per-field last-write-wins. */
  FRONTMATTER_LWW = 'frontmatter.lww',
}

/**
 * A single field-level conflict entry for frontmatter resolution.
 */
export interface FrontmatterFieldConflict {
  field: string;
  serverValue: unknown;
  clientValue: unknown;
  resolvedValue: unknown;
  /** Which side won: 'server' | 'client' | 'equal'. */
  winner: 'server' | 'client' | 'equal';
}

/**
 * An immutable conflict-log entry recording a merge event.
 * Stored in Valkey for audit purposes.
 */
export interface ConflictLogEntry {
  /** Unique ID for this merge event. */
  id: string;
  /** ISO 8601 timestamp of when the merge occurred. */
  timestamp: string;
  /** The note that was being edited. */
  noteId: string;
  /** Workspace context. */
  workspaceId: string;
  /** The user who reconnected (triggering the merge). */
  userId: string;
  /** Client socket ID for traceability. */
  clientId: string;
  /** Type of merge performed. */
  mergeType: ConflictMergeType;
  /** Size of the client's pending update in bytes. */
  clientUpdateBytes: number;
  /** Size of the server's diff (state vector delta) in bytes. */
  serverDiffBytes: number;
  /** Number of frontmatter fields that had conflicts. */
  frontmatterConflictCount: number;
  /** Per-field conflict details (frontmatter only). */
  frontmatterConflicts: FrontmatterFieldConflict[];
  /** Duration of the merge operation in milliseconds. */
  durationMs: number;
}

// ─── Reconnection ───────────────────────────────────────────────────────────

/**
 * Payload sent by a client when reconnecting after being offline.
 * Contains the client's Yjs state vector and any pending frontmatter changes.
 */
export interface ReconnectPayload {
  noteId: string;
  workspaceId: string;
  /** The client's Yjs state vector (encoded as Uint8Array serialised to number[]). */
  stateVector: number[];
  /** Pending Yjs updates accumulated while offline (encoded). */
  pendingUpdates: number[][];
  /** Client's version of the frontmatter with per-field timestamps. */
  frontmatter?: TimestampedFrontmatter;
}

/**
 * Response sent back to the reconnecting client after merge.
 */
export interface ReconnectResponse {
  /** Server diff to bring the client up to date (Yjs update). */
  serverUpdate: number[];
  /** Merged frontmatter after last-write-wins resolution. */
  frontmatter: Record<string, unknown>;
  /** Summary of what happened during the merge. */
  mergeInfo: {
    contentMerged: boolean;
    frontmatterFieldsResolved: number;
    conflictLogId: string;
  };
}

// ─── Server Document State ──────────────────────────────────────────────────

/**
 * In-memory representation of a Yjs document managed by the server.
 * One per active note.
 */
export interface ServerDocumentState {
  /** The note ID this document belongs to. */
  noteId: string;
  /** Workspace context. */
  workspaceId: string;
  /** The Yjs document binary state. Stored as Uint8Array. */
  encodedState: Uint8Array;
  /** The current state vector for fast comparison. */
  stateVector: Uint8Array;
  /** Current frontmatter with per-field timestamps. */
  frontmatter: TimestampedFrontmatter;
  /** Last time this document was updated. */
  lastUpdatedAt: string;
}
