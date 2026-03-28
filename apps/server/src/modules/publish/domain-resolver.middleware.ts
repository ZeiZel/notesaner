import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DomainService } from './domain.service';

/**
 * The key under which the resolved workspace context is attached to the
 * request when the domain-resolver middleware successfully maps the Host
 * header to a workspace.
 */
export const DOMAIN_WORKSPACE_KEY = '__domainWorkspace__';

/**
 * Shape of the workspace context attached by this middleware.
 */
export interface DomainWorkspaceContext {
  id: string;
  publicSlug: string | null;
  name: string;
}

export type RequestWithDomainWorkspace = Request & {
  [DOMAIN_WORKSPACE_KEY]?: DomainWorkspaceContext;
};

/**
 * DomainResolverMiddleware
 *
 * Runs early in the NestJS request pipeline (registered in the module via
 * `configure(consumer: MiddlewareConsumer)`). It reads the `Host` header of
 * every incoming request and attempts to map it to a workspace:
 *
 *  1. Wildcard subdomain pattern: `<slug>.notesaner.app`
 *     → resolved by `workspace.publicSlug`
 *  2. Custom domain pattern: `docs.mycompany.com`
 *     → resolved by `workspace.settings.customDomain` (verified only)
 *
 * When a workspace is found it is attached to `request[DOMAIN_WORKSPACE_KEY]`
 * for downstream handlers and guards to use via the `@DomainWorkspace()`
 * decorator (or by reading the property directly).
 *
 * When no workspace is found the request proceeds unmodified — the downstream
 * handler is responsible for deciding whether to respond or fall through.
 *
 * This middleware is intentionally lightweight and does NOT throw; resolution
 * failures are silently ignored so that internal API traffic (e.g. /api/*)
 * is unaffected.
 *
 * @example
 * // In PublishModule:
 * export class PublishModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(DomainResolverMiddleware)
 *       .forRoutes({ path: 'public/*', method: RequestMethod.GET });
 *   }
 * }
 */
@Injectable()
export class DomainResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DomainResolverMiddleware.name);

  constructor(private readonly domainService: DomainService) {}

  async use(req: RequestWithDomainWorkspace, _res: Response, next: NextFunction): Promise<void> {
    // Already resolved for this request (guards / other middleware ran first)
    if (DOMAIN_WORKSPACE_KEY in req) {
      return next();
    }

    const host = req.headers.host ?? '';

    if (!host) {
      return next();
    }

    try {
      const workspace = await this.domainService.resolveHostToWorkspace(host);
      if (workspace) {
        req[DOMAIN_WORKSPACE_KEY] = workspace;
        this.logger.debug(
          `Host "${host}" resolved to workspace "${workspace.id}" (slug: "${workspace.publicSlug}")`,
        );
      }
    } catch (err) {
      // Never block the request — log and continue
      this.logger.warn(`Domain resolution error for host "${host}": ${String(err)}`);
    }

    return next();
  }
}
