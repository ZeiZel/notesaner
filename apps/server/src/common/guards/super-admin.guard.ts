import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../decorators/current-user.decorator';

/**
 * Guards routes that require super-admin privileges.
 *
 * Super-admins are system-level administrators (isSuperAdmin=true on the User record)
 * and have access to global admin panel endpoints regardless of workspace roles.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, SuperAdminGuard)
 * @Get('admin/...')
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Super-admin access required');
    }

    return true;
  }
}
