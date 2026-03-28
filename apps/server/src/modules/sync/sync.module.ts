import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { ConflictResolutionService } from './conflict-resolution.service';
import { WsConnectionLimitGuard } from '../../common/guards/ws-connection-limit.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * SyncModule — Yjs CRDT synchronization subsystem.
 *
 * Provides:
 *   - SyncGateway — WebSocket gateway for real-time collaborative editing
 *   - ConflictResolutionService — handles offline reconnection merges,
 *     frontmatter conflict resolution (last-write-wins per field),
 *     and conflict logging for audit
 *   - WsConnectionLimitGuard — enforces per-user WebSocket connection limits
 *
 * Imports AuditModule for recording merge events.
 * ValkeyModule is globally provided so no explicit import needed.
 */
@Module({
  imports: [AuditModule],
  providers: [SyncGateway, ConflictResolutionService, WsConnectionLimitGuard],
  exports: [SyncGateway, ConflictResolutionService],
})
export class SyncModule {}
