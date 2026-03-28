/**
 * Shared types for the Yjs CRDT conflict resolution subsystem.
 *
 * These types are used by both the server (ConflictResolutionService) and
 * the client (sync provider) to ensure consistent wire format for
 * reconnection payloads and conflict log entries.
 */

// ─── Frontmatter ────────────────────────────────────────────────────────────

/**
 * A timestamped frontmatter field value.
 * Each field carries its own last-modified timestamp for per-field
 * last-write-wins resolution.
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
  /** Fields where the server value was kept. */
  serverWins: string[];
  /** Fields where the client value was kept. */
  clientWins: string[];
  /** Fields with no conflict. */
  noConflict: string[];
}

// ─── Conflict Log ───────────────────────────────────────────────────────────

export enum ConflictMergeType {
  CONTENT_CRDT = 'content.crdt',
  FRONTMATTER_LWW = 'frontmatter.lww',
}

export interface FrontmatterFieldConflict {
  field: string;
  serverValue: unknown;
  clientValue: unknown;
  resolvedValue: unknown;
  winner: 'server' | 'client' | 'equal';
}

export interface ConflictLogEntry {
  id: string;
  timestamp: string;
  noteId: string;
  workspaceId: string;
  userId: string;
  clientId: string;
  mergeType: ConflictMergeType;
  clientUpdateBytes: number;
  serverDiffBytes: number;
  frontmatterConflictCount: number;
  frontmatterConflicts: FrontmatterFieldConflict[];
  durationMs: number;
}

// ─── Reconnection ───────────────────────────────────────────────────────────

export interface ReconnectPayload {
  noteId: string;
  workspaceId: string;
  stateVector: number[];
  pendingUpdates: number[][];
  frontmatter?: TimestampedFrontmatter;
}

export interface ReconnectResponse {
  serverUpdate: number[];
  frontmatter: Record<string, unknown>;
  mergeInfo: {
    contentMerged: boolean;
    frontmatterFieldsResolved: number;
    conflictLogId: string;
  };
}

// ─── Server Document State ──────────────────────────────────────────────────

export interface ServerDocumentState {
  noteId: string;
  workspaceId: string;
  encodedState: Uint8Array;
  stateVector: Uint8Array;
  frontmatter: TimestampedFrontmatter;
  lastUpdatedAt: string;
}
