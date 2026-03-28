import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './audit.types';

/**
 * Metadata key used by AuditInterceptor to find the target action on a route.
 */
export const AUDIT_ACTION_KEY = '__auditAction__';

/**
 * @Audited(action) — marks a controller method for automatic audit logging.
 *
 * When applied alongside AuditInterceptor the interceptor will call
 * AuditService.log() AFTER the handler returns successfully, capturing the
 * actor's userId, workspaceId (from route params), IP, and user-agent.
 *
 * Only successful responses (status < 400) generate an entry; errors that
 * propagate out of the handler are not logged by the interceptor so as not to
 * produce spurious failed-action noise.
 *
 * @example
 * @Post()
 * @Audited(AuditAction.NOTE_CREATED)
 * async createNote(...) { ... }
 */
export const Audited = (action: AuditAction) => SetMetadata(AUDIT_ACTION_KEY, action);
