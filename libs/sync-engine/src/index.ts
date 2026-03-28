/**
 * @notesaner/sync-engine
 *
 * Yjs CRDT sync engine library.
 * Contains: SyncProvider, OfflineStore, ConflictResolver, Awareness protocol.
 *
 * This is the shared library used by both the server (NestJS) and client (Next.js)
 * for Yjs document management and conflict resolution utilities.
 */

export const SYNC_ENGINE_VERSION = '0.1.0';

// Re-export conflict resolution types for consumers
export type {
  TimestampedField,
  TimestampedFrontmatter,
  FrontmatterResolutionResult,
  ConflictLogEntry,
  FrontmatterFieldConflict,
  ReconnectPayload,
  ReconnectResponse,
  ServerDocumentState,
} from './types';

export { ConflictMergeType } from './types';

// Re-export utility functions
export {
  createTimestampedField,
  toTimestampedFrontmatter,
  fromTimestampedFrontmatter,
} from './frontmatter-utils';

// Re-export presence types and helpers
export type {
  CursorPosition,
  PresenceState,
  PresenceUpdatePayload,
  PresenceBroadcast,
  PresenceRemoveBroadcast,
  PresenceSnapshotResponse,
} from './presence';

export {
  PRESENCE_COLORS,
  assignUserColor,
  PRESENCE_DEBOUNCE_MS,
  presenceKey,
  PRESENCE_TTL_SECONDS,
} from './presence';
