/**
 * DTOs for the content-hash service — used in API responses and WebSocket
 * event payloads.
 */

/**
 * Included in every note-read response so clients can detect external
 * changes without issuing a separate request.
 */
export interface ContentHashResponse {
  /** SHA-256 hex digest of the current file content on disk. */
  contentHash: string;
  /** Whether the hash stored in the database matched the on-disk hash. */
  hashMatched: boolean;
  /**
   * `true` when the on-disk hash differs from the database record, meaning
   * the file was modified outside the application.
   */
  externalChangeDetected: boolean;
}

/**
 * Payload emitted over WebSocket when an external change is detected for a
 * note. Clients should reload the note content when they receive this event.
 */
export interface ExternalChangeEvent {
  /** WebSocket event name subscribers should listen for. */
  event: 'note.external_change';
  /** Workspace that contains the changed note. */
  workspaceId: string;
  /** ID of the note whose on-disk content changed externally. */
  noteId: string;
  /** New SHA-256 hex digest computed from the current on-disk content. */
  newHash: string;
  /**
   * SHA-256 hex digest that was previously stored in the database. May be
   * `null` when the note has never been hashed (e.g. newly detected files).
   */
  previousHash: string | null;
  /** ISO 8601 timestamp of when the external change was detected. */
  detectedAt: string;
}

/**
 * Result returned by `ContentHashService.batchValidateHashes`.
 * Callers can iterate the results to handle changed notes in bulk.
 */
export interface BatchHashValidationResult {
  /** Notes whose on-disk hash matches the database record — no action needed. */
  unchanged: string[];
  /** Notes whose on-disk hash differs from the database record. */
  changed: BatchHashChange[];
  /** Notes that could not be validated (file missing, DB record absent, etc.). */
  errors: BatchHashError[];
}

export interface BatchHashChange {
  noteId: string;
  storedHash: string | null;
  currentHash: string;
}

export interface BatchHashError {
  noteId: string;
  reason: string;
}
