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

interface AuthenticatedSocket extends WebSocket {
  id: string;
  userId?: string;
  workspaceId?: string;
  noteId?: string;
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

/**
 * WebSocket gateway for Yjs CRDT synchronization.
 * Handles real-time collaborative editing with awareness (cursor positions).
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

  handleConnection(client: AuthenticatedSocket): void {
    client.id = Math.random().toString(36).slice(2);
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinPayload,
  ): WsResponse<{ status: string }> {
    this.logger.debug(`Client ${client.id} joining note ${payload.noteId}`);
    // Full implementation in Wave 2 sync module
    return { event: 'joined', data: { status: 'ok' } };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeavePayload,
  ): void {
    this.logger.debug(`Client ${client.id} leaving note ${payload.noteId}`);
    // Full implementation in Wave 2 sync module
  }

  @SubscribeMessage('sync-step1')
  handleSyncStep1(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SyncStep1Payload,
  ): void {
    this.logger.debug(
      `Client ${client.id} sync-step1 for note ${payload.noteId}`,
    );
    // Full implementation: respond with sync-step2 containing missing updates
  }

  @SubscribeMessage('sync-step2')
  handleSyncStep2(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SyncStep2Payload,
  ): void {
    this.logger.debug(
      `Client ${client.id} sync-step2 for note ${payload.noteId}`,
    );
    // Full implementation: apply update to server Yjs doc
  }

  @SubscribeMessage('update')
  handleUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdatePayload,
  ): void {
    this.logger.debug(`Client ${client.id} update for note ${payload.noteId}`);
    // Full implementation: broadcast update to all other clients in the room
  }

  @SubscribeMessage('awareness')
  handleAwareness(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: AwarenessPayload,
  ): void {
    this.logger.debug(
      `Client ${client.id} awareness update for note ${payload.noteId}`,
    );
    // Full implementation: broadcast awareness state to all other clients in the room
  }
}
