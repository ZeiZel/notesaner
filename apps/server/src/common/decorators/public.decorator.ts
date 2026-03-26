import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as publicly accessible, bypassing JwtAuthGuard.
 *
 * @example
 * @Public()
 * @Get('/health')
 * getHealth() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
