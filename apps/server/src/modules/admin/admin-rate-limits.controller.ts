import type { RateLimitStatus } from './admin-rate-limits.service';
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SkipThrottle } from '../../common/decorators/skip-throttle.decorator';
import { AdminRateLimitsService } from './admin-rate-limits.service';

/**
 * Admin API for monitoring and managing rate limits.
 *
 * All endpoints require super-admin privileges.
 * Rate limiting is skipped for admin endpoints (admin should not be rate-limited
 * when investigating rate-limit issues).
 */
@ApiTags('Admin - Rate Limits')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@SkipThrottle()
@Controller('admin/rate-limits')
export class AdminRateLimitsController {
  constructor(private readonly service: AdminRateLimitsService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get rate limit status for a user',
    description:
      'Returns the current rate-limit counters, lockout status, and WebSocket connection count for the specified user.',
  })
  @ApiParam({ name: 'userId', description: 'User ID or email', type: String })
  @ApiOkResponse({ description: 'Rate limit status for the user.' })
  @ApiForbiddenResponse({ description: 'Requires super-admin.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getRateLimitStatus(@Param('userId') userId: string): Promise<RateLimitStatus> {
    return this.service.getRateLimitStatus(userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset rate limits for a user',
    description: 'Clears all rate-limit counters and unlocks the account for the specified user.',
  })
  @ApiParam({ name: 'userId', description: 'User ID or email', type: String })
  @ApiNoContentResponse({ description: 'Rate limits reset successfully.' })
  @ApiForbiddenResponse({ description: 'Requires super-admin.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async resetRateLimits(@Param('userId') userId: string): Promise<void> {
    await this.service.resetRateLimits(userId);
  }
}
