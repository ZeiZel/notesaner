import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { createGzip, createDeflate, createBrotliCompress, constants as zlibConstants } from 'zlib';
import type { Request, Response, NextFunction } from 'express';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum response body size (in bytes) to bother compressing. */
export const COMPRESSION_THRESHOLD_BYTES = 1024; // 1 KB

/** Header names as constants to avoid typos. */
export const ACCEPT_ENCODING_HEADER = 'accept-encoding';
export const CONTENT_ENCODING_HEADER = 'Content-Encoding';
export const VARY_HEADER = 'Vary';

/**
 * Content types that are already compressed — skipping re-compression
 * saves CPU and can actually increase payload size.
 */
const ALREADY_COMPRESSED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml', // svg is text-based but often pre-compressed at rest
  'audio/',
  'video/',
  'application/zip',
  'application/gzip',
  'application/x-brotli',
  'application/octet-stream',
]);

// ─── Encoding negotiation ─────────────────────────────────────────────────────

export type SupportedEncoding = 'br' | 'gzip' | 'deflate' | 'identity';

/**
 * Parses the `Accept-Encoding` request header and returns the best supported
 * encoding, respecting quality values (q-factors).
 *
 * Priority: brotli > gzip > deflate > identity
 * Returns `'identity'` (no compression) when the header is absent or no
 * shared encoding exists.
 */
export function negotiateEncoding(acceptEncoding: string | undefined): SupportedEncoding {
  if (!acceptEncoding) {
    return 'identity';
  }

  // Parse directives like "gzip;q=1.0, br;q=0.9, deflate;q=0.8, *;q=0"
  const parsed = acceptEncoding.split(',').map((part) => {
    const [encoding, qPart] = part.trim().split(';');
    const q = qPart ? parseFloat(qPart.trim().replace('q=', '')) : 1.0;
    return { encoding: encoding.trim().toLowerCase(), q: isNaN(q) ? 1.0 : q };
  });

  // Build a quality map. For each of our supported encodings, determine the
  // effective q-value by checking for an explicit entry first, then wildcard.
  const supported: SupportedEncoding[] = ['br', 'gzip', 'deflate'];

  const wildcard = parsed.find((e) => e.encoding === '*');

  const candidates = supported
    .map((enc) => {
      const explicit = parsed.find((e) => e.encoding === enc);
      // Explicit entry takes precedence over wildcard.
      const q = explicit !== undefined ? explicit.q : (wildcard?.q ?? 0);
      return { enc, q };
    })
    .filter((c) => c.q > 0)
    // Sort by q descending, then by our preferred order (br > gzip > deflate)
    .sort((a, b) => {
      if (b.q !== a.q) return b.q - a.q;
      return supported.indexOf(a.enc) - supported.indexOf(b.enc);
    });

  return candidates[0]?.enc ?? 'identity';
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Compression middleware that compresses HTTP responses using gzip, deflate,
 * or brotli based on the client's `Accept-Encoding` header.
 *
 * Features:
 * - Content negotiation via `Accept-Encoding` with q-factor support
 * - Brotli (br) preferred over gzip for better compression ratios
 * - Minimum size threshold: responses < 1 KB are sent uncompressed
 * - Already-compressed content types are skipped
 * - Sets `Vary: Accept-Encoding` to prevent cache poisoning
 *
 * @example
 * // In AppModule or a feature module:
 * consumer
 *   .apply(CompressionMiddleware)
 *   .forRoutes({ path: '*', method: RequestMethod.ALL });
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CompressionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const acceptEncoding = req.headers[ACCEPT_ENCODING_HEADER] as string | undefined;
    const encoding = negotiateEncoding(acceptEncoding);

    // Always advertise that encoding varies so proxies/CDNs cache correctly.
    res.setHeader(VARY_HEADER, 'Accept-Encoding');

    if (encoding === 'identity') {
      next();
      return;
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    let compressor:
      | ReturnType<typeof createGzip>
      | ReturnType<typeof createDeflate>
      | ReturnType<typeof createBrotliCompress>
      | null = null;
    let headersSent = false;

    const getOrCreateCompressor = (): typeof compressor => {
      if (compressor) return compressor;

      const contentType = res.getHeader('Content-Type') as string | undefined;
      if (shouldSkipCompression(contentType)) {
        return null;
      }

      if (encoding === 'br') {
        compressor = createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 4, // balance between speed and ratio
          },
        });
      } else if (encoding === 'gzip') {
        compressor = createGzip({ level: 6 });
      } else {
        compressor = createDeflate({ level: 6 });
      }

      return compressor;
    };

    const ensureHeaders = (): boolean => {
      if (headersSent) return true;

      const c = getOrCreateCompressor();
      if (!c) return false;

      // Remove Content-Length — it is no longer valid after compression.
      res.removeHeader('Content-Length');
      res.setHeader(CONTENT_ENCODING_HEADER, encoding);
      headersSent = true;

      // Pipe compressor output to the original socket/writable
      c.on('data', (chunk: Buffer) => {
        originalWrite(chunk);
      });
      c.on('end', () => {
        originalEnd();
      });
      c.on('error', (err: Error) => {
        this.logger.error(`Compression error: ${err.message}`);
        originalEnd();
      });

      return true;
    };

    // Override res.write to intercept body chunks.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).write = function (
      chunk: Buffer | string,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ): boolean {
      const buf = toBuffer(chunk, encodingOrCb as BufferEncoding | undefined);

      // Below threshold — skip compression even if encoding was negotiated.
      if (!headersSent && buf.length < COMPRESSION_THRESHOLD_BYTES) {
        return originalWrite(chunk, encodingOrCb as BufferEncoding, cb);
      }

      if (!ensureHeaders()) {
        return originalWrite(chunk, encodingOrCb as BufferEncoding, cb);
      }

      const callbackFn = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
      if (!compressor) {
        return originalWrite(chunk, encodingOrCb as BufferEncoding, cb);
      }
      return compressor.write(buf, callbackFn);
    };

    // Override res.end to flush and close the compressor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = function (
      chunk?: Buffer | string,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void,
    ): Response {
      if (chunk) {
        const buf = toBuffer(chunk, encodingOrCb as BufferEncoding | undefined);

        if (!headersSent && buf.length < COMPRESSION_THRESHOLD_BYTES) {
          return originalEnd(chunk, encodingOrCb as BufferEncoding, cb);
        }

        if (!ensureHeaders()) {
          return originalEnd(chunk, encodingOrCb as BufferEncoding, cb);
        }

        const callbackFn = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
        if (compressor) {
          compressor.end(buf, callbackFn as (() => void) | undefined);
        }
      } else {
        if (compressor && headersSent) {
          compressor.end();
        } else {
          return originalEnd();
        }
      }

      return res;
    };

    next();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldSkipCompression(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const type = contentType.split(';')[0].trim().toLowerCase();
  for (const skip of ALREADY_COMPRESSED_TYPES) {
    if (type === skip || type.startsWith(skip)) {
      return true;
    }
  }
  return false;
}

function toBuffer(chunk: Buffer | string, encodingOrCb?: BufferEncoding | undefined): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  const enc = typeof encodingOrCb === 'string' ? encodingOrCb : 'utf8';
  return Buffer.from(chunk, enc);
}
