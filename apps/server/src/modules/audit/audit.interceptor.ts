import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import type { AuditAction } from './audit.types';

interface RequestWithUser extends Request {
  user?: JwtPayload;
  params: Record<string, string>;
}

/**
 * AuditInterceptor — automatically emits an audit-log entry after a
 * successfully executed route handler that carries the @Audited() decorator.
 *
 * Extraction logic:
 *   - Actor:       request.user.sub (populated by JwtAuthGuard)
 *   - Workspace:   request.params.workspaceId (present on workspace-scoped routes)
 *   - IP address:  X-Forwarded-For header or socket remote address
 *   - User agent:  User-Agent header
 *   - Metadata:    workspaceId + noteId (if present) for traceability
 *
 * Entries are written fire-and-forget via AuditService.log() — any Valkey
 * failure is swallowed there, so this interceptor never disrupts the response.
 *
 * Attach globally in AppModule or per-controller:
 * @example
 * // Per controller
 * @UseInterceptors(AuditInterceptor)
 * export class NotesController { ... }
 *
 * // Global (AppModule)
 * providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }]
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<AuditAction | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Audited() decorator on this route — pass through immediately.
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    return next.handle().pipe(
      tap({
        next: () => {
          // Run asynchronously — we never await so the response is not delayed
          this.writeEntry(action, request).catch((err) => {
            this.logger.error(`AuditInterceptor write error: ${err}`);
          });
        },
      }),
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async writeEntry(action: AuditAction, request: RequestWithUser): Promise<void> {
    const userId = request.user?.sub ?? 'anonymous';
    const workspaceId = request.params?.['workspaceId'] ?? null;
    const ipAddress = this.resolveIp(request);
    const userAgent = request.headers['user-agent'] ?? '';

    // Include key route params as metadata for traceability
    const metadata: Record<string, unknown> = {};
    if (workspaceId) metadata['workspaceId'] = workspaceId;
    if (request.params?.['noteId']) metadata['noteId'] = request.params['noteId'];
    if (request.params?.['userId']) metadata['targetUserId'] = request.params['userId'];

    await this.auditService.log(action, userId, workspaceId, metadata, ipAddress, userAgent);
  }

  /**
   * Resolve the client IP from the X-Forwarded-For header (set by reverse
   * proxies) or fall back to the socket remote address.
   */
  private resolveIp(request: RequestWithUser): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return request.socket?.remoteAddress ?? '';
  }
}
