import type { CursorPaginatedResponse } from '../dto/cursor-pagination.dto';

// ─── Cursor payload ───────────────────────────────────────────────────────────

/**
 * The data encoded inside a cursor.
 * Using both `id` and `ts` allows Prisma queries to uniquely position the
 * cursor even when multiple rows share the same `createdAt` timestamp.
 */
export interface CursorPayload {
  /** Primary key of the last seen record. */
  id: string;
  /** Unix millisecond timestamp of the record (e.g. `createdAt.getTime()`). */
  ts: number;
}

// ─── Encoding / decoding ─────────────────────────────────────────────────────

/**
 * Encodes a `CursorPayload` into a URL-safe base64 string.
 *
 * The cursor is opaque to clients — they should treat it as a black box and
 * pass it unmodified to subsequent requests.
 *
 * @example
 * const cursor = encodeCursor({ id: 'note-abc', ts: Date.now() });
 * // → 'eyJpZCI6Im5vdGUtYWJjIiwidHMiOjE3MDAwMDAwMDB9'
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decodes a cursor string back to its `CursorPayload`.
 *
 * Returns `null` when the cursor is invalid or malformed so callers can
 * fall back to starting from the beginning of the list.
 *
 * @example
 * const payload = decodeCursor('eyJpZCI6Im5vdGUtYWJjIiwidHMiOjE3MDAwMDAwMDB9');
 * // → { id: 'note-abc', ts: 1700000000 }
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'id' in parsed &&
      'ts' in parsed &&
      typeof (parsed as Record<string, unknown>).id === 'string' &&
      typeof (parsed as Record<string, unknown>).ts === 'number'
    ) {
      return parsed as CursorPayload;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Prisma query builder ─────────────────────────────────────────────────────

/**
 * Options for building a cursor-based Prisma query.
 */
export interface BuildPrismaQueryOptions {
  /**
   * Raw cursor string from the request (may be `undefined` for the first page).
   * An invalid cursor is silently treated as "start from the beginning".
   */
  cursor?: string;
  /** Number of items to fetch (the requested page size). */
  limit: number;
  /**
   * Field used to order results and position the cursor.
   * Must be a unique field (typically `id`) or pair with a secondary sort key.
   * @default 'id'
   */
  orderField?: string;
  /**
   * Secondary field used for ordering when `orderField` timestamps are not unique.
   * @default 'createdAt'
   */
  secondaryOrderField?: string;
}

/**
 * Prisma query fragment for cursor-based pagination.
 *
 * Designed to be spread into a `prisma.model.findMany()` call:
 *
 * @example
 * const query = buildPrismaQuery({ cursor: dto.cursor, limit: dto.limit });
 * const notes = await prisma.note.findMany({
 *   ...query,
 *   where: { workspaceId },
 * });
 */
export interface PrismaQueryFragment {
  take: number;
  skip?: number;
  cursor?: { id: string };
  orderBy: Array<Record<string, 'asc' | 'desc'>>;
}

export function buildPrismaQuery(options: BuildPrismaQueryOptions): PrismaQueryFragment {
  const { cursor, limit, orderField = 'id', secondaryOrderField = 'createdAt' } = options;

  // Fetch one extra item to determine if there is a next page.
  const take = limit + 1;

  const orderBy: Array<Record<string, 'asc' | 'desc'>> = [
    { [secondaryOrderField]: 'desc' },
    { [orderField]: 'asc' },
  ];

  if (!cursor) {
    return { take, orderBy };
  }

  const payload = decodeCursor(cursor);

  if (!payload) {
    // Invalid cursor — start from the beginning.
    return { take, orderBy };
  }

  return {
    take,
    // Skip the cursor row itself (Prisma includes the cursor item).
    skip: 1,
    cursor: { id: payload.id },
    orderBy,
  };
}

// ─── Response builder ─────────────────────────────────────────────────────────

/**
 * Builds a `CursorPaginatedResponse<T>` from a raw Prisma result array.
 *
 * Pass `limit + 1` items from Prisma. This function uses the extra item to
 * detect whether more pages exist, then trims the result to exactly `limit`.
 *
 * The cursor is derived from `item.id` and `item.createdAt`.  Any entity that
 * has these fields can be paginated without a custom cursor factory.
 *
 * @example
 * const raw = await prisma.note.findMany({ ...buildPrismaQuery(...), take: limit + 1 });
 * return buildCursorPage(raw, limit);
 */
export function buildCursorPage<T extends { id: string; createdAt: Date }>(
  rawItems: T[],
  limit: number,
): CursorPaginatedResponse<T> {
  const hasMore = rawItems.length > limit;
  const items = hasMore ? rawItems.slice(0, limit) : rawItems;

  let nextCursor: string | null = null;

  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = encodeCursor({ id: last.id, ts: last.createdAt.getTime() });
  }

  return { items, nextCursor, hasMore };
}
