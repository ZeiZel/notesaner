import { Injectable, Logger } from '@nestjs/common';
import { ValkeyThrottlerStorage } from '../../common/throttler/valkey-throttler-storage.service';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { WsConnectionLimitGuard } from '../../common/guards/ws-connection-limit.guard';

export interface RateLimitStatus {
  userId: string;
  rateLimits: {
    global: { totalHits: number; ttlSeconds: number } | null;
    auth: { totalHits: number; ttlSeconds: number } | null;
    search: { totalHits: number; ttlSeconds: number } | null;
    upload: { totalHits: number; ttlSeconds: number } | null;
  };
  lockout: {
    isLocked: boolean;
    remainingLockoutSeconds: number;
    failedAttempts: number;
  };
  websocket: {
    activeConnections: number;
  };
}

/**
 * Service for admin rate-limit management.
 *
 * Aggregates data from the throttler storage, account lockout service,
 * and WebSocket connection guard to provide a unified view.
 */
@Injectable()
export class AdminRateLimitsService {
  private readonly logger = new Logger(AdminRateLimitsService.name);

  constructor(
    private readonly throttlerStorage: ValkeyThrottlerStorage,
    private readonly accountLockout: AccountLockoutService,
    private readonly wsConnectionGuard: WsConnectionLimitGuard,
  ) {}

  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    const [globalRecord, authRecord, searchRecord, uploadRecord, lockout, wsConnections] =
      await Promise.all([
        this.throttlerStorage.getRecord(`default-${userId}`),
        this.throttlerStorage.getRecord(`default-${userId}`),
        this.throttlerStorage.getRecord(`default-${userId}`),
        this.throttlerStorage.getRecord(`default-${userId}`),
        this.accountLockout.getLockoutStatus(userId),
        this.wsConnectionGuard.getConnectionCount(userId),
      ]);

    return {
      userId,
      rateLimits: {
        global: globalRecord
          ? { totalHits: globalRecord.totalHits, ttlSeconds: globalRecord.ttl }
          : null,
        auth: authRecord ? { totalHits: authRecord.totalHits, ttlSeconds: authRecord.ttl } : null,
        search: searchRecord
          ? { totalHits: searchRecord.totalHits, ttlSeconds: searchRecord.ttl }
          : null,
        upload: uploadRecord
          ? { totalHits: uploadRecord.totalHits, ttlSeconds: uploadRecord.ttl }
          : null,
      },
      lockout,
      websocket: {
        activeConnections: wsConnections,
      },
    };
  }

  async resetRateLimits(userId: string): Promise<void> {
    this.logger.log(`Admin resetting rate limits for userId=${userId}`);

    await Promise.all([
      this.throttlerStorage.reset(`default-${userId}`),
      this.accountLockout.unlockAccount(userId),
    ]);
  }
}
