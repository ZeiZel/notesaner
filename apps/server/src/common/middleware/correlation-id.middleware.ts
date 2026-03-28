import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * Extracts or generates a correlation ID for every HTTP request.
 *
 * If the incoming request already carries an `X-Request-ID` header (e.g. from
 * an API gateway or load balancer), we reuse it. Otherwise a new UUID v4 is
 * generated.
 *
 * The correlation ID is:
 *   1. Stored on `req.id` so pino-http picks it up automatically.
 *   2. Echoed back in the response header so clients can reference it.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();

    // pino-http reads `req.id` for the `reqId` field
    (req as Request & { id: string }).id = correlationId;

    // Echo back to caller
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
