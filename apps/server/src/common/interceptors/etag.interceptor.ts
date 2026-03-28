import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ETAG_HEADER = 'ETag';
export const IF_NONE_MATCH_HEADER = 'if-none-match';
export const IF_MODIFIED_SINCE_HEADER = 'if-modified-since';
export const LAST_MODIFIED_HEADER = 'Last-Modified';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Computes a weak ETag from a serialised response body.
 *
 * We use a weak ETag (`W/"..."`) because our JSON serialisation may differ
 * by whitespace or field order across minor code changes while the semantic
 * content remains identical.
 *
 * The hash uses the first 16 hex chars of an MD5 digest — sufficient for
 * collision resistance in this context while keeping the header short.
 */
export function computeETag(body: string): string {
  const hash = createHash('md5').update(body).digest('hex').substring(0, 16);
  return `W/"${hash}"`;
}

/**
 * Normalises an ETag value for comparison by stripping surrounding quotes
 * and the weak indicator prefix.
 */
function normaliseETag(etag: string): string {
  return etag.replace(/^W\//, '').replace(/"/g, '');
}

/**
 * Returns `true` when the client's `If-None-Match` value matches the given ETag.
 *
 * Handles:
 * - Exact match: `"abc123"` === `"abc123"`
 * - Weak match: `W/"abc123"` matches `"abc123"`
 * - Wildcard: `*` always matches
 * - Comma-separated list: `"abc", "xyz"` — any match is sufficient
 */
export function isETagMatch(clientETag: string, serverETag: string): boolean {
  if (clientETag.trim() === '*') return true;

  const serverNorm = normaliseETag(serverETag);
  return clientETag
    .split(',')
    .map((e) => normaliseETag(e.trim()))
    .some((e) => e === serverNorm);
}

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * Computes and sets ETag headers on GET responses, enabling conditional
 * requests that return HTTP 304 Not Modified when the content has not changed.
 *
 * Workflow:
 * 1. Allow the handler to produce a response body.
 * 2. Serialise the body to JSON.
 * 3. Hash the JSON to produce a weak ETag.
 * 4. Compare against the client's `If-None-Match` header.
 * 5. Return 304 (no body) when they match; otherwise attach the ETag header
 *    and return the full response.
 *
 * Only applies to GET and HEAD requests.  POST/PUT/PATCH/DELETE responses
 * are passed through unchanged.
 *
 * @example
 * // Apply globally in main.ts:
 * app.useGlobalInterceptors(new ETagInterceptor());
 *
 * // Or per-controller:
 * @UseInterceptors(ETagInterceptor)
 * @Controller('notes')
 * export class NotesController { ... }
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ETagInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Only handle GET/HEAD — other methods mutate state and must not return 304.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle();
    }

    return next.handle().pipe(
      map((body: unknown) => {
        // Skip when there is no body (e.g. 204 No Content).
        if (body === undefined || body === null) {
          return body;
        }

        let serialised: string;
        try {
          serialised = typeof body === 'string' ? body : JSON.stringify(body);
        } catch (err) {
          this.logger.warn(`ETag serialisation failed: ${String(err)}`);
          return body;
        }

        const etag = computeETag(serialised);
        const clientETag = req.headers[IF_NONE_MATCH_HEADER] as string | undefined;

        if (clientETag && isETagMatch(clientETag, etag)) {
          // Content has not changed — send a 304 with no body.
          res.status(304);
          res.setHeader(ETAG_HEADER, etag);
          res.end();
          // Return undefined so NestJS does not attempt to serialize a body.
          return undefined;
        }

        res.setHeader(ETAG_HEADER, etag);
        return body;
      }),
    );
  }
}
