import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as Y from 'yjs';
import {
  ConflictLogEntry,
  ConflictMergeType,
  FrontmatterFieldConflict,
  FrontmatterResolutionResult,
  ReconnectPayload,
  ReconnectResponse,
  TimestampedField,
  TimestampedFrontmatter,
} from './conflict-resolution.types';
import { ValkeyService } from '../valkey/valkey.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';

// ─── Valkey key helpers ───────────────────────────────────────────────────────

/** Sorted-set for conflict log entries per workspace, scored by Unix ms. */
const conflictLogKey = (workspaceId: string) => `sync:conflict-log:ws:${workspaceId}`;

/** Hash key for the server's Yjs document state per note. */
const docStateKey = (noteId: string) => `sync:doc-state:${noteId}`;

/** Hash key for the server's frontmatter per note. */
const frontmatterKey = (noteId: string) => `sync:frontmatter:${noteId}`;

/** Default TTL for conflict log entries: 30 days. */
const CONFLICT_LOG_TTL_SECONDS = 30 * 24 * 60 * 60;

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * ConflictResolutionService handles merge operations when clients reconnect
 * after being offline.
 *
 * Content conflicts:
 *   Yjs CRDT handles text merges automatically. The server applies the client's
 *   pending updates to the canonical Yjs document and computes a diff to send
 *   back. No content is ever lost.
 *
 * Frontmatter conflicts:
 *   Per-field last-write-wins using timestamps attached to each field. The most
 *   recently written value for each key wins, regardless of which side (server
 *   or client) wrote it.
 *
 * All merge events are logged to a Valkey sorted-set (conflict log) for audit
 * and debugging.
 */
@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  /**
   * In-memory Yjs documents keyed by noteId.
   * Loaded from Valkey on first access.
   */
  private readonly documents = new Map<string, Y.Doc>();

  constructor(
    private readonly valkey: ValkeyService,
    private readonly audit: AuditService,
  ) {}

  // ─── Reconnection Merge ─────────────────────────────────────────────────────

  /**
   * Handle a client reconnection with offline changes.
   *
   * Steps:
   * 1. Load (or create) the server's canonical Yjs document
   * 2. Compute what the client is missing (server diff)
   * 3. Apply the client's pending updates to the server document
   * 4. Resolve frontmatter conflicts per-field via last-write-wins
   * 5. Persist updated state
   * 6. Log the merge event
   * 7. Return the server diff + merged frontmatter to the client
   */
  async handleReconnect(
    payload: ReconnectPayload,
    userId: string,
    clientId: string,
  ): Promise<ReconnectResponse> {
    const startMs = Date.now();
    const { noteId, workspaceId, stateVector, pendingUpdates, frontmatter } = payload;

    // 1. Get or create the server Yjs document
    const serverDoc = await this.getOrCreateDoc(noteId);

    // 2. Compute what the client is missing from the server
    const clientStateVector = new Uint8Array(stateVector);
    const serverDiff = Y.encodeStateAsUpdate(serverDoc, clientStateVector);

    // 3. Apply client's pending updates to the server document
    let clientUpdateBytes = 0;
    for (const updateArr of pendingUpdates) {
      const update = new Uint8Array(updateArr);
      clientUpdateBytes += update.byteLength;
      Y.applyUpdate(serverDoc, update);
    }

    // 4. Resolve frontmatter conflicts
    const serverFrontmatter = await this.loadFrontmatter(noteId);
    const frontmatterResult = this.resolveFrontmatter(serverFrontmatter, frontmatter ?? {});

    // 5. Persist updated state
    await this.persistDocState(noteId, workspaceId, serverDoc);
    await this.persistFrontmatter(noteId, frontmatterResult.mergedTimestamped);

    // 6. Log the merge event
    const durationMs = Date.now() - startMs;
    const conflictLog = await this.logConflict({
      noteId,
      workspaceId,
      userId,
      clientId,
      clientUpdateBytes,
      serverDiffBytes: serverDiff.byteLength,
      frontmatterResult,
      durationMs,
    });

    // Fire-and-forget audit entry
    this.audit
      .log(
        AuditAction.SYNC_MERGED,
        userId,
        workspaceId,
        {
          noteId,
          conflictLogId: conflictLog.id,
          clientUpdateBytes,
          serverDiffBytes: serverDiff.byteLength,
          frontmatterConflicts:
            frontmatterResult.serverWins.length + frontmatterResult.clientWins.length,
          durationMs,
        },
        '',
        '',
      )
      .catch(() => {
        /* audit is fire-and-forget */
      });

    this.logger.log(
      `Merge complete: noteId=${noteId}, user=${userId}, ` +
        `clientUpdates=${pendingUpdates.length}, serverDiff=${serverDiff.byteLength}B, ` +
        `frontmatterConflicts=${frontmatterResult.serverWins.length + frontmatterResult.clientWins.length}, ` +
        `duration=${durationMs}ms`,
    );

    // 7. Return response
    return {
      serverUpdate: Array.from(serverDiff),
      frontmatter: frontmatterResult.merged,
      mergeInfo: {
        contentMerged: pendingUpdates.length > 0 || serverDiff.byteLength > 0,
        frontmatterFieldsResolved:
          frontmatterResult.serverWins.length + frontmatterResult.clientWins.length,
        conflictLogId: conflictLog.id,
      },
    };
  }

  // ─── Yjs Document Management ───────────────────────────────────────────────

  /**
   * Get or create a Yjs document for a note.
   * Attempts to load from Valkey first, falls back to a new empty document.
   */
  async getOrCreateDoc(noteId: string): Promise<Y.Doc> {
    // Check in-memory cache first
    const cached = this.documents.get(noteId);
    if (cached) {
      return cached;
    }

    const doc = new Y.Doc();

    // Attempt to load persisted state from Valkey
    const key = docStateKey(noteId);
    const raw = await this.valkey.get(key);

    if (raw) {
      try {
        const state = Buffer.from(raw, 'base64');
        Y.applyUpdate(doc, new Uint8Array(state));
        this.logger.debug(`Loaded Yjs doc from Valkey: noteId=${noteId}`);
      } catch (error) {
        this.logger.warn(`Failed to load Yjs doc from Valkey: noteId=${noteId}, error=${error}`);
      }
    }

    this.documents.set(noteId, doc);
    return doc;
  }

  /**
   * Apply an incremental Yjs update to the server document.
   * Called during normal real-time sync (not reconnection).
   */
  async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const doc = await this.getOrCreateDoc(noteId);
    Y.applyUpdate(doc, update);
  }

  /**
   * Get the state vector of the server's Yjs document for a note.
   * Used by the sync protocol to determine what the client is missing.
   */
  async getStateVector(noteId: string): Promise<Uint8Array> {
    const doc = await this.getOrCreateDoc(noteId);
    return Y.encodeStateVector(doc);
  }

  /**
   * Encode the server diff needed to bring a client up-to-date,
   * given the client's state vector.
   */
  async encodeServerDiff(noteId: string, clientStateVector: Uint8Array): Promise<Uint8Array> {
    const doc = await this.getOrCreateDoc(noteId);
    return Y.encodeStateAsUpdate(doc, clientStateVector);
  }

  /**
   * Persist the Yjs document state to Valkey.
   */
  async persistDocState(noteId: string, _workspaceId: string, doc: Y.Doc): Promise<void> {
    const key = docStateKey(noteId);
    const state = Y.encodeStateAsUpdate(doc);
    const encoded = Buffer.from(state).toString('base64');

    await this.valkey.set(key, encoded);

    this.logger.debug(`Persisted Yjs doc: noteId=${noteId}, size=${state.byteLength}B`);
  }

  /**
   * Remove a document from the in-memory cache.
   * Called when all clients leave a note room.
   */
  evictDoc(noteId: string): void {
    const doc = this.documents.get(noteId);
    if (doc) {
      doc.destroy();
      this.documents.delete(noteId);
      this.logger.debug(`Evicted Yjs doc: noteId=${noteId}`);
    }
  }

  // ─── Frontmatter Resolution ───────────────────────────────────────────────

  /**
   * Resolve frontmatter conflicts between server and client versions using
   * per-field last-write-wins with timestamps.
   *
   * Rules:
   * - If a field exists only on one side, it is included in the merge.
   * - If a field exists on both sides with the same value, no conflict.
   * - If a field exists on both sides with different values, the one with the
   *   later `updatedAt` timestamp wins.
   * - If timestamps are equal, server wins (tie-breaker for determinism).
   */
  resolveFrontmatter(
    server: TimestampedFrontmatter,
    client: TimestampedFrontmatter,
  ): FrontmatterResolutionResult {
    const merged: Record<string, unknown> = {};
    const mergedTimestamped: TimestampedFrontmatter = {};
    const serverWins: string[] = [];
    const clientWins: string[] = [];
    const noConflict: string[] = [];

    // Collect all field keys from both sides
    const allKeys = new Set([...Object.keys(server), ...Object.keys(client)]);

    for (const key of allKeys) {
      const serverField: TimestampedField | undefined = server[key];
      const clientField: TimestampedField | undefined = client[key];

      if (serverField && !clientField) {
        // Only on server side
        merged[key] = serverField.value;
        mergedTimestamped[key] = serverField;
        noConflict.push(key);
        continue;
      }

      if (!serverField && clientField) {
        // Only on client side
        merged[key] = clientField.value;
        mergedTimestamped[key] = clientField;
        noConflict.push(key);
        continue;
      }

      if (serverField && clientField) {
        // Both sides have the field — check for conflict
        if (this.fieldsEqual(serverField.value, clientField.value)) {
          // Same value, no conflict — keep the more recent timestamp
          const latest =
            new Date(serverField.updatedAt).getTime() >= new Date(clientField.updatedAt).getTime()
              ? serverField
              : clientField;
          merged[key] = latest.value;
          mergedTimestamped[key] = latest;
          noConflict.push(key);
          continue;
        }

        // Different values — last-write-wins
        const serverTime = new Date(serverField.updatedAt).getTime();
        const clientTime = new Date(clientField.updatedAt).getTime();

        if (clientTime > serverTime) {
          // Client wins (strictly newer)
          merged[key] = clientField.value;
          mergedTimestamped[key] = clientField;
          clientWins.push(key);
        } else {
          // Server wins (newer or tie — server is tie-breaker)
          merged[key] = serverField.value;
          mergedTimestamped[key] = serverField;
          serverWins.push(key);
        }
      }
    }

    return { merged, mergedTimestamped, serverWins, clientWins, noConflict };
  }

  // ─── Frontmatter Persistence ──────────────────────────────────────────────

  /**
   * Load frontmatter from Valkey for a note.
   */
  async loadFrontmatter(noteId: string): Promise<TimestampedFrontmatter> {
    const key = frontmatterKey(noteId);
    const raw = await this.valkey.get(key);

    if (raw) {
      try {
        return JSON.parse(raw) as TimestampedFrontmatter;
      } catch {
        this.logger.warn(`Corrupt frontmatter in Valkey: noteId=${noteId}`);
      }
    }

    return {};
  }

  /**
   * Persist merged frontmatter to Valkey.
   */
  async persistFrontmatter(noteId: string, frontmatter: TimestampedFrontmatter): Promise<void> {
    const key = frontmatterKey(noteId);
    await this.valkey.set(key, JSON.stringify(frontmatter));
  }

  // ─── Conflict Logging ─────────────────────────────────────────────────────

  /**
   * Record a merge event in the conflict log (Valkey sorted-set).
   */
  async logConflict(params: {
    noteId: string;
    workspaceId: string;
    userId: string;
    clientId: string;
    clientUpdateBytes: number;
    serverDiffBytes: number;
    frontmatterResult: FrontmatterResolutionResult;
    durationMs: number;
  }): Promise<ConflictLogEntry> {
    const {
      noteId,
      workspaceId,
      userId,
      clientId,
      clientUpdateBytes,
      serverDiffBytes,
      frontmatterResult,
      durationMs,
    } = params;

    // Build per-field conflict details
    const frontmatterConflicts: FrontmatterFieldConflict[] = [];

    for (const field of frontmatterResult.serverWins) {
      frontmatterConflicts.push({
        field,
        serverValue: frontmatterResult.mergedTimestamped[field]?.value,
        clientValue: undefined,
        resolvedValue: frontmatterResult.mergedTimestamped[field]?.value,
        winner: 'server',
      });
    }

    for (const field of frontmatterResult.clientWins) {
      frontmatterConflicts.push({
        field,
        serverValue: undefined,
        clientValue: frontmatterResult.mergedTimestamped[field]?.value,
        resolvedValue: frontmatterResult.mergedTimestamped[field]?.value,
        winner: 'client',
      });
    }

    const entry: ConflictLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      noteId,
      workspaceId,
      userId,
      clientId,
      mergeType:
        frontmatterConflicts.length > 0
          ? ConflictMergeType.FRONTMATTER_LWW
          : ConflictMergeType.CONTENT_CRDT,
      clientUpdateBytes,
      serverDiffBytes,
      frontmatterConflictCount: frontmatterConflicts.length,
      frontmatterConflicts,
      durationMs,
    };

    try {
      const key = conflictLogKey(workspaceId);
      const score = Date.now();
      const serialised = JSON.stringify(entry);
      const client = this.valkey.getClient();
      await client.zadd(key, score, serialised);
      // Set TTL if not already set (only on first entry)
      await this.valkey.expire(key, CONFLICT_LOG_TTL_SECONDS);
    } catch (error) {
      // Fire-and-forget: conflict logging must never disrupt sync
      this.logger.error(`Failed to write conflict log: ${error}`);
    }

    return entry;
  }

  /**
   * Query conflict log entries for a workspace.
   * Returns entries in reverse chronological order.
   */
  async queryConflictLog(workspaceId: string, limit = 50): Promise<ConflictLogEntry[]> {
    const key = conflictLogKey(workspaceId);
    const client = this.valkey.getClient();
    const raw = await client.zrevrangebyscore(key, '+inf', '-inf', 'LIMIT', 0, limit);

    return raw
      .map((entry) => {
        try {
          return JSON.parse(entry) as ConflictLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is ConflictLogEntry => e !== null);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Deep equality check for frontmatter field values.
   * Handles primitives and JSON-serializable objects.
   */
  private fieldsEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }
}
