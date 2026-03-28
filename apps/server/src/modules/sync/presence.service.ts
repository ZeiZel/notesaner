import { Injectable, Logger } from '@nestjs/common';
import {
  assignUserColor,
  presenceKey,
  PRESENCE_TTL_SECONDS,
  type PresenceState,
  type PresenceBroadcast,
} from '@notesaner/sync-engine';
import { ValkeyService } from '../valkey/valkey.service';

// ─── In-memory Presence State ───────────────────────────────────────────────

/**
 * Per-client presence entry tracked in memory.
 * The in-memory map is the authoritative source for real-time broadcasts;
 * ValKey acts as a read-through cache for cross-instance lookups.
 */
interface PresenceEntry {
  clientId: string;
  state: PresenceState;
  /** Unix ms of the last presence update (for staleness detection). */
  updatedAtMs: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * PresenceService manages per-note user presence (cursors, selections, identity).
 *
 * Responsibilities:
 *   - Track which users are present in each note room
 *   - Assign deterministic colors to users
 *   - Store/retrieve presence state from ValKey for cross-instance visibility
 *   - Clean up stale entries on disconnect or timeout
 *
 * The service is stateful: it maintains an in-memory map of active presence
 * entries keyed by noteId -> clientId, mirrored to ValKey for persistence
 * across server restarts and multi-instance deployments.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  /**
   * In-memory presence map: noteId -> Map<clientId, PresenceEntry>.
   * Fast path for broadcasting; ValKey is the durable store.
   */
  private readonly presence = new Map<string, Map<string, PresenceEntry>>();

  constructor(private readonly valkey: ValkeyService) {}

  // ─── Set / Update ───────────────────────────────────────────────────────

  /**
   * Set or update a user's presence in a note room.
   * Called when a client sends a presence update (cursor move, selection change).
   *
   * @returns The full PresenceBroadcast to forward to peers.
   */
  async setPresence(
    noteId: string,
    clientId: string,
    userId: string,
    userName: string,
    cursor: { index: number; length: number } | null,
  ): Promise<PresenceBroadcast> {
    const color = assignUserColor(userId);
    const now = new Date().toISOString();

    const state: PresenceState = {
      userName,
      userId,
      color,
      cursor,
      lastUpdatedAt: now,
    };

    // Update in-memory map
    let noteMap = this.presence.get(noteId);
    if (!noteMap) {
      noteMap = new Map();
      this.presence.set(noteId, noteMap);
    }

    noteMap.set(clientId, {
      clientId,
      state,
      updatedAtMs: Date.now(),
    });

    // Persist to ValKey (fire-and-forget for low-latency path)
    this.persistToValkey(noteId, clientId, state).catch((err) =>
      this.logger.error(`Failed to persist presence to ValKey: noteId=${noteId}`, err),
    );

    return {
      noteId,
      clientId,
      userId,
      userName,
      color,
      cursor,
      lastUpdatedAt: now,
    };
  }

  // ─── Remove ─────────────────────────────────────────────────────────────

  /**
   * Remove a client's presence from a note room.
   * Called on disconnect or when a client explicitly leaves a note.
   */
  async removePresence(noteId: string, clientId: string): Promise<void> {
    const noteMap = this.presence.get(noteId);
    if (noteMap) {
      noteMap.delete(clientId);

      // Clean up empty note entries
      if (noteMap.size === 0) {
        this.presence.delete(noteId);
      }
    }

    // Remove from ValKey
    try {
      const key = presenceKey(noteId);
      const client = this.valkey.getClient();
      await client.hdel(key, clientId);
    } catch (err) {
      this.logger.error(`Failed to remove presence from ValKey: noteId=${noteId}`, err);
    }
  }

  /**
   * Remove ALL presence entries for a given clientId across all notes.
   * Called when a WebSocket connection is fully disconnected.
   */
  async removeAllPresenceForClient(clientId: string): Promise<string[]> {
    const affectedNotes: string[] = [];

    for (const [noteId, noteMap] of this.presence) {
      if (noteMap.has(clientId)) {
        noteMap.delete(clientId);
        affectedNotes.push(noteId);

        if (noteMap.size === 0) {
          this.presence.delete(noteId);
        }
      }
    }

    // Clean up ValKey entries for affected notes
    for (const noteId of affectedNotes) {
      try {
        const key = presenceKey(noteId);
        const client = this.valkey.getClient();
        await client.hdel(key, clientId);
      } catch (err) {
        this.logger.error(
          `Failed to remove presence from ValKey: noteId=${noteId}, clientId=${clientId}`,
          err,
        );
      }
    }

    return affectedNotes;
  }

  // ─── Query ──────────────────────────────────────────────────────────────

  /**
   * Get all active presence entries for a note.
   * Returns the in-memory snapshot (fast path).
   */
  getPresenceForNote(noteId: string): PresenceBroadcast[] {
    const noteMap = this.presence.get(noteId);
    if (!noteMap) return [];

    const result: PresenceBroadcast[] = [];
    for (const entry of noteMap.values()) {
      result.push({
        noteId,
        clientId: entry.clientId,
        userId: entry.state.userId,
        userName: entry.state.userName,
        color: entry.state.color,
        cursor: entry.state.cursor,
        lastUpdatedAt: entry.state.lastUpdatedAt,
      });
    }

    return result;
  }

  /**
   * Get the number of users present in a note room.
   */
  getPresenceCount(noteId: string): number {
    return this.presence.get(noteId)?.size ?? 0;
  }

  /**
   * Load presence from ValKey for a note.
   * Useful when a new server instance needs to bootstrap its in-memory state,
   * or for diagnostics.
   */
  async loadPresenceFromValkey(noteId: string): Promise<PresenceBroadcast[]> {
    try {
      const key = presenceKey(noteId);
      const client = this.valkey.getClient();
      const entries = await client.hgetall(key);

      const result: PresenceBroadcast[] = [];
      const now = Date.now();

      for (const [clientId, raw] of Object.entries(entries)) {
        try {
          const state = JSON.parse(raw) as PresenceState;
          const entryAge = now - new Date(state.lastUpdatedAt).getTime();

          // Skip stale entries (older than TTL)
          if (entryAge > PRESENCE_TTL_SECONDS * 1000) {
            // Clean up stale entry in background
            client.hdel(key, clientId).catch(() => {
              /* best effort */
            });
            continue;
          }

          result.push({
            noteId,
            clientId,
            userId: state.userId,
            userName: state.userName,
            color: state.color,
            cursor: state.cursor,
            lastUpdatedAt: state.lastUpdatedAt,
          });
        } catch {
          // Skip corrupt entries
          this.logger.warn(
            `Corrupt presence entry in ValKey: noteId=${noteId}, clientId=${clientId}`,
          );
        }
      }

      return result;
    } catch (err) {
      this.logger.error(`Failed to load presence from ValKey: noteId=${noteId}`, err);
      return [];
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────

  /**
   * Persist a single presence entry to ValKey.
   * Uses a hash where each field is a clientId mapping to serialised PresenceState.
   */
  private async persistToValkey(
    noteId: string,
    clientId: string,
    state: PresenceState,
  ): Promise<void> {
    const key = presenceKey(noteId);
    const client = this.valkey.getClient();
    await client.hset(key, clientId, JSON.stringify(state));
    await client.expire(key, PRESENCE_TTL_SECONDS);
  }
}
