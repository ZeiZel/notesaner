import { Module } from '@nestjs/common';
import { AdminRateLimitsController } from './admin-rate-limits.controller';
import { AdminRateLimitsService } from './admin-rate-limits.service';
import { ValkeyThrottlerStorage } from '../../common/throttler/valkey-throttler-storage.service';
import { AccountLockoutService } from '../../common/services/account-lockout.service';
import { WsConnectionLimitGuard } from '../../common/guards/ws-connection-limit.guard';

/**
 * AdminModule — super-admin endpoints for system management.
 *
 * Currently provides:
 * - Rate limit monitoring and reset (GET/DELETE /admin/rate-limits/:userId)
 *
 * All endpoints require super-admin JWT authentication.
 * ValkeyModule is @Global() so ValKey client is available via DI.
 */
@Module({
  controllers: [AdminRateLimitsController],
  providers: [
    AdminRateLimitsService,
    ValkeyThrottlerStorage,
    AccountLockoutService,
    WsConnectionLimitGuard,
  ],
})
export class AdminModule {}
