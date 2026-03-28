import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE_KEY = 'skipThrottle';

/**
 * Marks a route or controller to skip rate limiting entirely.
 * Use sparingly -- only for internal health checks or metrics endpoints.
 *
 * @example
 * @SkipThrottle()
 * @Get('/health')
 * healthCheck() { ... }
 */
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
