import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../guards/roles.guard';

export const ROLES_KEY = 'roles';

/**
 * Declares the minimum workspace role(s) required to access a route.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * @Roles('OWNER', 'ADMIN')
 * @UseGuards(RolesGuard)
 * async deleteWorkspace(...) { ... }
 */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
