/**
 * Shared presence types and helpers for real-time cursor/selection broadcasting.
 *
 * Used by both the server (PresenceService/PresenceGateway) and the client
 * (editor awareness layer) to maintain a consistent wire format for
 * cursor positions, selection ranges, and user identity.
 *
 * Leverages the Yjs awareness protocol concept: each client announces its
 * local state (cursor, selection, user info) and the server rebroadcasts
 * to all peers in the same note room.
 */

// ─── Cursor & Selection ─────────────────────────────────────────────────────

/**
 * A zero-based cursor position within a Yjs text type.
 * Maps to a Y.RelativePosition internally on the client, but is transmitted
 * as an absolute index for simplicity in the wire protocol.
 */
export interface CursorPosition {
  /** Absolute character index within the document text. */
  index: number;
  /** Length of the selection from the cursor position. 0 means no selection. */
  length: number;
}

/**
 * The full presence state announced by a single user for a given note.
 * Sent from client to server and rebroadcast to peers.
 */
export interface PresenceState {
  /** The user's display name shown on the cursor label. */
  userName: string;
  /** Unique user identifier. */
  userId: string;
  /** Assigned cursor/highlight color (CSS hex, e.g. "#e06c75"). */
  color: string;
  /** Current cursor position and optional selection range. */
  cursor: CursorPosition | null;
  /** ISO 8601 timestamp of when this state was last updated by the client. */
  lastUpdatedAt: string;
}

// ─── Wire Protocol Payloads ─────────────────────────────────────────────────

/**
 * Payload sent by a client to update its presence in a note room.
 */
export interface PresenceUpdatePayload {
  noteId: string;
  cursor: CursorPosition | null;
}

/**
 * Payload broadcast to peers when a user's presence changes.
 */
export interface PresenceBroadcast {
  noteId: string;
  clientId: string;
  userId: string;
  userName: string;
  color: string;
  cursor: CursorPosition | null;
  lastUpdatedAt: string;
}

/**
 * Payload broadcast when a user leaves (disconnects or navigates away).
 */
export interface PresenceRemoveBroadcast {
  noteId: string;
  clientId: string;
  userId: string;
}

/**
 * Response to a client requesting the current presence snapshot for a note.
 */
export interface PresenceSnapshotResponse {
  noteId: string;
  users: PresenceBroadcast[];
}

// ─── Color Assignment ───────────────────────────────────────────────────────

/**
 * A curated palette of 16 distinct, accessible colors for cursor labels.
 * Chosen for contrast against both light and dark editor backgrounds.
 * When more than 16 users are present, colors wrap around.
 */
export const PRESENCE_COLORS: readonly string[] = [
  '#e06c75', // soft red
  '#61afef', // blue
  '#98c379', // green
  '#c678dd', // purple
  '#e5c07b', // yellow
  '#56b6c2', // cyan
  '#d19a66', // orange
  '#be5046', // dark red
  '#7ec8e3', // light blue
  '#a9dc76', // lime
  '#ab7967', // brown
  '#ff6b81', // coral
  '#6c5ce7', // indigo
  '#00b894', // teal
  '#fdcb6e', // gold
  '#e17055', // burnt orange
] as const;

/**
 * Assigns a deterministic color based on the user ID.
 * The same user always gets the same color across sessions and devices.
 *
 * Uses a simple string hash to map user IDs to palette indices.
 */
export function assignUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index];
}

// ─── Debounce ───────────────────────────────────────────────────────────────

/**
 * Recommended debounce interval for cursor update messages (milliseconds).
 * The client should throttle outgoing presence updates to this interval
 * to avoid flooding the WebSocket with high-frequency cursor movements.
 */
export const PRESENCE_DEBOUNCE_MS = 50;

// ─── ValKey Key Helpers ─────────────────────────────────────────────────────

/**
 * Returns the ValKey hash key for storing active presence state of a note.
 * The hash maps clientId -> serialised PresenceState JSON.
 */
export function presenceKey(noteId: string): string {
  return `sync:presence:${noteId}`;
}

/**
 * TTL for presence entries in ValKey (seconds).
 * Entries older than this are considered stale and can be cleaned up.
 * Set to 5 minutes — well above the expected heartbeat interval.
 */
export const PRESENCE_TTL_SECONDS = 300;
