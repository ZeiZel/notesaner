import { CanActivate, ExecutionContext, Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from '../../modules/valkey/valkey.constants';

/**
 * WebSocket connection limit guard.
 *
 * Limits the number of concurrent WebSocket connections per user.
 * Default: 5 connections per user (configurable via RATE_LIMIT_WS_MAX_CONNECTIONS).
 *
 * Tracking is done in ValKey using a sorted set keyed by userId,
 * where each member is a connection ID and the score is the connection timestamp.
 * On disconnect, the connection is removed from the set.
 *
 * This guard should be applied to the SyncGateway or any WebSocket gateway.
 */
@Injectable()
export class WsConnectionLimitGuard implements CanActivate {
  private readonly logger = new Logger(WsConnectionLimitGuard.name);

  private readonly maxConnectionsPerUser: number;
  private readonly PREFIX = 'ws:connections:';

  /** TTL for connection entries (auto-cleanup if disconnect is missed). */
  private readonly CONNECTION_TTL_SECONDS = 3600; // 1 hour

  constructor(
    @Inject(VALKEY_CLIENT) private readonly client: Redis,
    private readonly config: ConfigService,
  ) {
    this.maxConnectionsPerUser = this.config.get<number>('rateLimit.wsMaxConnections', 5);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket context: extract client from the args
    const client = context.switchToWs().getClient() as {
      id?: string;
      userId?: string;
    };

    const userId = client.userId;
    if (!userId) {
      // Unauthenticated connections are handled at a different layer
      return true;
    }

    const key = `${this.PREFIX}${userId}`;

    try {
      // Clean up stale connections (older than CONNECTION_TTL_SECONDS)
      const cutoff = Date.now() - this.CONNECTION_TTL_SECONDS * 1000;
      await this.client.zremrangebyscore(key, 0, cutoff);

      // Count current connections
      const currentCount = await this.client.zcard(key);

      if (currentCount >= this.maxConnectionsPerUser) {
        this.logger.warn(
          `WebSocket connection limit reached for user ${userId}: ${currentCount}/${this.maxConnectionsPerUser}`,
        );
        return false;
      }

      // Register this connection
      const connectionId = client.id ?? Math.random().toString(36).slice(2);
      await this.client.zadd(key, Date.now(), connectionId);
      await this.client.expire(key, this.CONNECTION_TTL_SECONDS);

      return true;
    } catch (error) {
      // Fail open: allow the connection if ValKey is unreachable
      this.logger.error('WebSocket connection limit check failed', error);
      return true;
    }
  }

  /**
   * Removes a connection from the tracking set on disconnect.
   * Call this from the gateway's handleDisconnect method.
   */
  async removeConnection(userId: string, connectionId: string): Promise<void> {
    try {
      const key = `${this.PREFIX}${userId}`;
      await this.client.zrem(key, connectionId);
    } catch (error) {
      this.logger.error(
        `Failed to remove WebSocket connection tracking for ${userId}:${connectionId}`,
        error,
      );
    }
  }

  /**
   * Returns the current connection count for a user (admin diagnostics).
   */
  async getConnectionCount(userId: string): Promise<number> {
    try {
      const key = `${this.PREFIX}${userId}`;
      // Clean up stale first
      const cutoff = Date.now() - this.CONNECTION_TTL_SECONDS * 1000;
      await this.client.zremrangebyscore(key, 0, cutoff);
      return await this.client.zcard(key);
    } catch {
      return 0;
    }
  }
}
