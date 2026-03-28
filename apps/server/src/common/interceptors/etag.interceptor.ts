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
 * Computes a strong ETag from an updatedAt timestamp and optional content hash.
 *
 * This is more efficient than hashing the full response body — if the
 * resource has not been modified since the provided timestamp, the ETag
 * will remain stable. The content hash adds a secondary check in case
 * the timestamp is not sufficient (e.g. same-second updates).
 */
export function computeETagFromTimestamp(updatedAt: Date | string, contentHash?: string): string {
  const ts = typeof updatedAt === 'string' ? updatedAt : updatedAt.toISOString();
  const input = contentHash ? `${ts}:${contentHash}` : ts;
  const hash = createHash('md5').update(input).digest('hex').substring(0, 16);
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

/**
 * Returns `true` when the resource has not been modified since the client's
 * `If-Modified-Since` timestamp. Used as a secondary freshness check alongside
 * ETag-based validation.
 */
export function isNotModifiedSince(
  ifModifiedSince: string | undefined,
  lastModified: Date | string | undefined,
): boolean {
  if (!ifModifiedSince || !lastModified) return false;

  const clientDate = new Date(ifModifiedSince);
  const serverDate = typeof lastModified === 'string' ? new Date(lastModified) : lastModified;

  // If either date is invalid, cannot determine freshness — skip
  if (isNaN(clientDate.getTime()) || isNaN(serverDate.getTime())) return false;

  // HTTP dates have 1-second granularity; truncate to seconds for comparison
  return Math.floor(serverDate.getTime() / 1000) <= Math.floor(clientDate.getTime() / 1000);
}

/**
 * Extracts an `updatedAt` field from a response body if it exists.
 * Supports both Date objects and ISO 8601 strings.
 */
function extractUpdatedAt(body: unknown): Date | undefined {
  if (body === null || body === undefined || typeof body !== 'object') return undefined;

  const record = body as Record<string, unknown>;

  // Try common field names for last-modified timestamps
  for (const field of ['updatedAt', 'updated_at', 'modifiedAt', 'modified_at', 'lastModified']) {
    const value = record[field];
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  return undefined;
}

/**
 * Extracts a content hash field from a response body if it exists.
 * Some endpoints return a pre-computed content hash for efficient ETag generation.
 */
function extractContentHash(body: unknown): string | undefined {
  if (body === null || body === undefined || typeof body !== 'object') return undefined;

  const record = body as Record<string, unknown>;

  for (const field of ['contentHash', 'content_hash', 'hash', 'checksum']) {
    const value = record[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * Computes and sets ETag and Last-Modified headers on GET responses, enabling
 * conditional requests that return HTTP 304 Not Modified when the content has
 * not changed.
 *
 * ETag generation strategy (ordered by preference):
 * 1. If the response body contains `updatedAt` and/or `contentHash` fields,
 *    compute an ETag from those fields (avoids full-body serialisation).
 * 2. Fall back to hashing the serialised JSON body.
 *
 * Conditional request handling:
 * - `If-None-Match` — compared against the computed ETag (primary).
 * - `If-Modified-Since` — compared against the `updatedAt` field (secondary).
 * - Returns 304 when either condition indicates no change.
 *
 * Only applies to GET and HEAD requests. POST/PUT/PATCH/DELETE responses
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

        // --- Compute ETag ---

        let etag: string;
        let lastModified: Date | undefined;

        // Strategy 1: Use updatedAt and/or contentHash from the response body.
        const updatedAt = extractUpdatedAt(body);
        const contentHash = extractContentHash(body);

        if (updatedAt || contentHash) {
          // Prefer timestamp-based ETag — avoids full-body hashing
          if (updatedAt) {
            etag = computeETagFromTimestamp(updatedAt, contentHash);
            lastModified = updatedAt;
          } else {
            // contentHash only — use it directly
            etag = `W/"${contentHash}"`;
          }
        } else {
          // Strategy 2: Full-body hash fallback
          let serialised: string;
          try {
            serialised = typeof body === 'string' ? body : JSON.stringify(body);
          } catch (err) {
            this.logger.warn(`ETag serialisation failed: ${String(err)}`);
            return body;
          }
          etag = computeETag(serialised);
        }

        // --- Set Last-Modified header ---

        if (lastModified) {
          res.setHeader(LAST_MODIFIED_HEADER, lastModified.toUTCString());
        }

        // --- Conditional request evaluation ---

        const clientETag = req.headers[IF_NONE_MATCH_HEADER] as string | undefined;
        const clientIfModifiedSince = req.headers[IF_MODIFIED_SINCE_HEADER] as string | undefined;

        // Primary: ETag match
        if (clientETag && isETagMatch(clientETag, etag)) {
          res.status(304);
          res.setHeader(ETAG_HEADER, etag);
          res.end();
          return undefined;
        }

        // Secondary: If-Modified-Since (only when no If-None-Match was sent)
        if (!clientETag && clientIfModifiedSince && lastModified) {
          if (isNotModifiedSince(clientIfModifiedSince, lastModified)) {
            res.status(304);
            res.setHeader(ETAG_HEADER, etag);
            if (lastModified) {
              res.setHeader(LAST_MODIFIED_HEADER, lastModified.toUTCString());
            }
            res.end();
            return undefined;
          }
        }

        res.setHeader(ETAG_HEADER, etag);
        return body;
      }),
    );
  }
}
