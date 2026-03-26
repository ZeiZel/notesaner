import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Extracts the authenticated user from the request object.
 * Use inside controllers that are protected by JwtAuthGuard.
 *
 * @example
 * async getProfile(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
