import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { WsConnectionLimitGuard } from '../../common/guards/ws-connection-limit.guard';
import { ConflictResolutionService } from './conflict-resolution.service';
import type { ReconnectPayload, ReconnectResponse } from './conflict-resolution.types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends WebSocket {
  id: string;
  userId?: string;
  workspaceId?: string;
  noteId?: string;
  /** ISO 8601 timestamp of last received message (heartbeat tracking). */
  lastSeenAt?: string;
  /** Whether the client has completed initial sync (sync-step1/step2). */
  isSynced?: boolean;
}

interface JoinPayload {
  workspaceId: string;
  noteId: string;
  token: string;
}

interface LeavePayload {
  noteId: string;
}

interface SyncStep1Payload {
  noteId: string;
  stateVector: number[];
}

interface SyncStep2Payload {
  noteId: string;
  update: number[];
}

interface UpdatePayload {
  noteId: string;
  update: number[];
}

interface AwarenessPayload {
  noteId: string;
  state: Record<string, unknown>;
}

// ─── Room tracking ───────────────────────────────────────────────────────────

/**
 * A "room" is a set of clients currently editing the same note.
 * Used for broadcasting updates and awareness states.
 */
interface NoteRoom {
  noteId: string;
  workspaceId: string;
  clients: Set<AuthenticatedSocket>;
}

/**
 * WebSocket gateway for Yjs CRDT synchronization.
 * Handles real-time collaborative editing with awareness (cursor positions)
 * and offline reconnection with conflict resolution.
 *
 * Protocol: y-protocol sync messages over WebSocket
 * Namespace: /sync
 */
@WebSocketGateway({
  path: '/sync',
  transports: ['websocket'],
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SyncGateway.name);

  /** Active note rooms keyed by noteId. */
  private readonly rooms = new Map<string, NoteRoom>();

  constructor(
    private readonly conflictResolution: ConflictResolutionService,
    private readonly wsConnectionLimit: WsConnectionLimitGuard,
  ) {}

  handleConnection(client: AuthenticatedSocket): void {
    client.id = Math.random().toString(36).slice(2);
    client.lastSeenAt = new Date().toISOString();
    client.isSynced = false;
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);

    // Remove WebSocket connection tracking from ValKey
    if (client.userId) {
      this.wsConnectionLimit
        .removeConnection(client.userId, client.id)
        .catch((err) => this.logger.error('Failed to remove WS connection tracking', err));
    }

    // Remove client from its room
    if (client.noteId) {
      this.removeFromRoom(client, client.noteId);
    }
  }

  // ─── Join / Leave ──────────────────────────────────────────────────────────

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinPayload,
  ): Promise<WsResponse<{ status: string }>> {
    this.logger.debug(`Client ${client.id} joining note ${payload.noteId}`);

    // TODO: validate token and extract userId
    client.userId = client.userId ?? 'anonymous';

    // Enforce per-user WebSocket connection limit
    if (client.userId !== 'anonymous') {
      const key = `ws:connections:${client.userId}`;
      try {
        // Clean up stale connections and check count
        const cutoff = Date.now() - 3600 * 1000;
        await this.wsConnectionLimit['client'].zremrangebyscore(key, 0, cutoff);
        const count = await this.wsConnectionLimit.getConnectionCount(client.userId);
        const maxConnections = this.wsConnectionLimit['maxConnectionsPerUser'] ?? 5;

        if (count >= maxConnections) {
          this.logger.warn(
            `WebSocket connection limit reached for user ${client.userId}: ${count}/${maxConnections}`,
          );
          return { event: 'error', data: { status: 'connection_limit_exceeded' } };
        }

        // Register this connection
        await this.wsConnectionLimit['client'].zadd(key, Date.now(), client.id);
        await this.wsConnectionLimit['client'].expire(key, 3600);
      } catch (err) {
        // Fail open: allow connection if ValKey is down
        this.logger.error('WS connection limit check failed', err);
      }
    }

    client.workspaceId = payload.workspaceId;
    client.noteId = payload.noteId;
    client.lastSeenAt = new Date().toISOString();

    this.addToRoom(client, payload.noteId, payload.workspaceId);

    return { event: 'joined', data: { status: 'ok' } };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeavePayload,
  ): void {
    this.logger.debug(`Client ${client.id} leaving note ${payload.noteId}`);
    this.removeFromRoom(client, payload.noteId);
    client.noteId = undefined;
  }

  // ─── Yjs Sync Protocol ────────────────────────────────────────────────────

  /**
   * Sync Step 1: Client sends its state vector.
   * Server responds with sync-step2 containing the diff the client needs.
   * Server also sends its own state vector back so the client can send its diff.
   */
  @SubscribeMessage('sync-step1')
  async handleSyncStep1(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SyncStep1Payload,
  ): Promise<void> {
    this.logger.debug(`Client ${client.id} sync-step1 for note ${payload.noteId}`);
    client.lastSeenAt = new Date().toISOString();

    const clientStateVector = new Uint8Array(payload.stateVector);

    // Compute what the client is missing from the server
    const serverDiff = await this.conflictResolution.encodeServerDiff(
      payload.noteId,
      clientStateVector,
    );

    // Get the server's state vector so the client can send its diff
    const serverStateVector = await this.conflictResolution.getStateVector(payload.noteId);

    // Send the server diff to the client
    this.sendToClient(client, 'sync-step2', {
      noteId: payload.noteId,
      update: Array.from(serverDiff),
    });

    // Send the server's state vector so the client can compute its diff
    this.sendToClient(client, 'sync-step1', {
      noteId: payload.noteId,
      stateVector: Array.from(serverStateVector),
    });
  }

  /**
   * Sync Step 2: Client sends its diff (update) based on the server's state vector.
   * Server applies the update and marks the client as synced.
   */
  @SubscribeMessage('sync-step2')
  async handleSyncStep2(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SyncStep2Payload,
  ): Promise<void> {
    this.logger.debug(`Client ${client.id} sync-step2 for note ${payload.noteId}`);
    client.lastSeenAt = new Date().toISOString();

    const update = new Uint8Array(payload.update);

    // Apply the client's update to the server document
    await this.conflictResolution.applyUpdate(payload.noteId, update);

    // Mark client as synced after completing the initial handshake
    client.isSynced = true;

    // Persist the updated state
    const workspaceId = client.workspaceId ?? '';
    const doc = await this.conflictResolution.getOrCreateDoc(payload.noteId);
    await this.conflictResolution.persistDocState(payload.noteId, workspaceId, doc);
  }

  // ─── Real-time Updates ─────────────────────────────────────────────────────

  /**
   * Handle an incremental Yjs update from a client.
   * Applied to the server doc and broadcast to all other clients in the room.
   */
  @SubscribeMessage('update')
  async handleUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdatePayload,
  ): Promise<void> {
    this.logger.debug(`Client ${client.id} update for note ${payload.noteId}`);
    client.lastSeenAt = new Date().toISOString();

    const update = new Uint8Array(payload.update);

    // Apply to server document
    await this.conflictResolution.applyUpdate(payload.noteId, update);

    // Broadcast to all other clients in the room
    this.broadcastToRoom(payload.noteId, client, 'update', {
      noteId: payload.noteId,
      update: payload.update,
    });
  }

  // ─── Reconnection with Conflict Resolution ────────────────────────────────

  /**
   * Handle client reconnection after being offline.
   * The client sends its state vector plus any pending offline updates.
   * Server merges via Yjs CRDT and resolves frontmatter conflicts.
   */
  @SubscribeMessage('reconnect')
  async handleReconnect(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReconnectPayload,
  ): Promise<WsResponse<ReconnectResponse>> {
    this.logger.log(
      `Client ${client.id} reconnecting for note ${payload.noteId} ` +
        `with ${payload.pendingUpdates.length} pending updates`,
    );
    client.lastSeenAt = new Date().toISOString();

    const userId = client.userId ?? 'anonymous';

    // Perform the merge
    const response = await this.conflictResolution.handleReconnect(payload, userId, client.id);

    // Update client state
    client.workspaceId = payload.workspaceId;
    client.noteId = payload.noteId;
    client.isSynced = true;

    // Ensure the client is in the room
    this.addToRoom(client, payload.noteId, payload.workspaceId);

    // Broadcast the merged content update to all other clients
    if (response.mergeInfo.contentMerged) {
      // Get the full server state to broadcast
      const serverDoc = await this.conflictResolution.getOrCreateDoc(payload.noteId);
      const fullState = Y.encodeStateAsUpdate(serverDoc);

      this.broadcastToRoom(payload.noteId, client, 'update', {
        noteId: payload.noteId,
        update: Array.from(fullState),
      });
    }

    return { event: 'reconnect-response', data: response };
  }

  // ─── Awareness ─────────────────────────────────────────────────────────────

  @SubscribeMessage('awareness')
  handleAwareness(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: AwarenessPayload,
  ): void {
    this.logger.debug(`Client ${client.id} awareness update for note ${payload.noteId}`);
    client.lastSeenAt = new Date().toISOString();

    // Broadcast awareness state to all other clients in the room
    this.broadcastToRoom(payload.noteId, client, 'awareness', {
      noteId: payload.noteId,
      clientId: client.id,
      userId: client.userId,
      state: payload.state,
    });
  }

  // ─── Room Management ──────────────────────────────────────────────────────

  private addToRoom(client: AuthenticatedSocket, noteId: string, workspaceId: string): void {
    let room = this.rooms.get(noteId);
    if (!room) {
      room = { noteId, workspaceId, clients: new Set() };
      this.rooms.set(noteId, room);
    }
    room.clients.add(client);
    this.logger.debug(`Room ${noteId}: ${room.clients.size} client(s)`);
  }

  private removeFromRoom(client: AuthenticatedSocket, noteId: string): void {
    const room = this.rooms.get(noteId);
    if (!room) return;

    room.clients.delete(client);
    this.logger.debug(`Room ${noteId}: ${room.clients.size} client(s) after removal`);

    // Clean up empty rooms and evict the cached document
    if (room.clients.size === 0) {
      this.rooms.delete(noteId);
      this.conflictResolution.evictDoc(noteId);
      this.logger.debug(`Room ${noteId} destroyed (empty)`);
    }
  }

  /**
   * Get the current number of clients in a room.
   * Useful for diagnostics and testing.
   */
  getRoomSize(noteId: string): number {
    return this.rooms.get(noteId)?.clients.size ?? 0;
  }

  // ─── Messaging Helpers ────────────────────────────────────────────────────

  private sendToClient(client: AuthenticatedSocket, event: string, data: unknown): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private broadcastToRoom(
    noteId: string,
    sender: AuthenticatedSocket,
    event: string,
    data: unknown,
  ): void {
    const room = this.rooms.get(noteId);
    if (!room) return;

    const message = JSON.stringify({ event, data });

    for (const client of room.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
