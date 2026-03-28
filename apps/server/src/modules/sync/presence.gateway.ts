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
import type {
  PresenceUpdatePayload,
  PresenceRemoveBroadcast,
  PresenceSnapshotResponse,
} from '@notesaner/sync-engine';
import { PRESENCE_DEBOUNCE_MS } from '@notesaner/sync-engine';
import { PresenceService } from './presence.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Extended WebSocket with identity fields.
 * Must match the AuthenticatedSocket from SyncGateway.
 */
interface AuthenticatedSocket extends WebSocket {
  id: string;
  userId?: string;
  userName?: string;
  workspaceId?: string;
  noteId?: string;
  lastSeenAt?: string;
  isSynced?: boolean;
}

// ─── Gateway ────────────────────────────────────────────────────────────────

/**
 * WebSocket gateway for real-time presence (cursor positions, selections, user identity).
 *
 * Shares the same WebSocket path (/sync) as the SyncGateway. NestJS routes
 * `@SubscribeMessage` events independently, so both gateways receive messages
 * from the same underlying WebSocket connections.
 *
 * Protocol:
 *   - `presence:update` -- Client sends cursor position/selection changes
 *   - `presence:snapshot` -- Client requests current presence state for a note
 *   - `presence:state` -- Server broadcasts a user's presence to peers
 *   - `presence:remove` -- Server broadcasts that a user has left
 *
 * Debouncing (PRESENCE_DEBOUNCE_MS = 50ms) is expected to be handled on the
 * client side. The server processes and rebroadcasts all received updates
 * immediately to minimize perceived latency.
 */
@WebSocketGateway({
  path: '/sync',
  transports: ['websocket'],
})
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PresenceGateway.name);

  /**
   * Tracks which noteId each client is currently in, so we can broadcast
   * removal on disconnect without relying on the SyncGateway's room state.
   */
  private readonly clientNotes = new Map<string, string>();

  /**
   * Server-side debounce: tracks the last presence update timestamp per client.
   * Updates received faster than PRESENCE_DEBOUNCE_MS are silently dropped.
   */
  private readonly lastUpdateMs = new Map<string, number>();

  constructor(private readonly presenceService: PresenceService) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  handleConnection(client: AuthenticatedSocket): void {
    // Connection identity is assigned by SyncGateway.handleConnection.
    // We only need to ensure the client has an id for tracking.
    if (!client.id) {
      client.id = Math.random().toString(36).slice(2);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    this.logger.debug(`Presence cleanup for disconnected client: ${client.id}`);

    // Remove debounce tracking
    this.lastUpdateMs.delete(client.id);

    // Remove from per-client note tracking
    const noteId = this.clientNotes.get(client.id);
    this.clientNotes.delete(client.id);

    // Remove presence state and notify peers
    const affectedNotes = await this.presenceService.removeAllPresenceForClient(client.id);

    // Broadcast removal to all rooms this client was in
    for (const affectedNoteId of affectedNotes) {
      const removal: PresenceRemoveBroadcast = {
        noteId: affectedNoteId,
        clientId: client.id,
        userId: client.userId ?? 'anonymous',
      };

      this.broadcastToNote(affectedNoteId, client, 'presence:remove', removal);
    }

    // Also handle the tracked note if not already covered
    if (noteId && !affectedNotes.includes(noteId)) {
      const removal: PresenceRemoveBroadcast = {
        noteId,
        clientId: client.id,
        userId: client.userId ?? 'anonymous',
      };

      this.broadcastToNote(noteId, client, 'presence:remove', removal);
    }
  }

  // ─── Message Handlers ─────────────────────────────────────────────────

  /**
   * Handle a presence update from a client.
   * The client sends their current cursor position and selection range.
   *
   * Server-side debounce: updates arriving faster than PRESENCE_DEBOUNCE_MS
   * from the same client are dropped to prevent flooding.
   */
  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: PresenceUpdatePayload,
  ): Promise<void> {
    // Server-side debounce
    const now = Date.now();
    const lastUpdate = this.lastUpdateMs.get(client.id);
    if (lastUpdate !== undefined && now - lastUpdate < PRESENCE_DEBOUNCE_MS) {
      return;
    }
    this.lastUpdateMs.set(client.id, now);

    const userId = client.userId ?? 'anonymous';
    const userName = client.userName ?? userId;

    // Track which note this client is in
    this.clientNotes.set(client.id, payload.noteId);

    // Update presence state
    const broadcast = await this.presenceService.setPresence(
      payload.noteId,
      client.id,
      userId,
      userName,
      payload.cursor,
    );

    // Broadcast to all peers in the same note room
    this.broadcastToNote(payload.noteId, client, 'presence:state', broadcast);
  }

  /**
   * Handle a request for the current presence snapshot of a note.
   * Sent by a client when joining a note to learn about other active users.
   */
  @SubscribeMessage('presence:snapshot')
  handlePresenceSnapshot(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { noteId: string },
  ): WsResponse<PresenceSnapshotResponse> {
    const users = this.presenceService.getPresenceForNote(payload.noteId);

    return {
      event: 'presence:snapshot',
      data: {
        noteId: payload.noteId,
        users,
      },
    };
  }

  /**
   * Handle a client explicitly leaving presence for a note.
   * Called when the user navigates away from a note without disconnecting.
   */
  @SubscribeMessage('presence:leave')
  async handlePresenceLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { noteId: string },
  ): Promise<void> {
    this.logger.debug(`Client ${client.id} leaving presence for note ${payload.noteId}`);

    // Clean up tracking
    this.clientNotes.delete(client.id);
    this.lastUpdateMs.delete(client.id);

    // Remove presence state
    await this.presenceService.removePresence(payload.noteId, client.id);

    // Broadcast removal to peers
    const removal: PresenceRemoveBroadcast = {
      noteId: payload.noteId,
      clientId: client.id,
      userId: client.userId ?? 'anonymous',
    };

    this.broadcastToNote(payload.noteId, client, 'presence:remove', removal);
  }

  // ─── Broadcasting ─────────────────────────────────────────────────────

  /**
   * Broadcast a message to all clients connected to the WebSocket server
   * that are currently in the given note room, excluding the sender.
   *
   * Since this gateway shares the WebSocket server with SyncGateway,
   * we iterate all connected clients and filter by noteId.
   */
  private broadcastToNote(
    noteId: string,
    sender: AuthenticatedSocket,
    event: string,
    data: unknown,
  ): void {
    if (!this.server) return;

    const message = JSON.stringify({ event, data });

    for (const ws of this.server.clients) {
      const client = ws as AuthenticatedSocket;
      if (client !== sender && client.noteId === noteId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────

  /**
   * Get the number of users tracked in presence for a note.
   * Useful for health checks and tests.
   */
  getPresenceCount(noteId: string): number {
    return this.presenceService.getPresenceCount(noteId);
  }
}
