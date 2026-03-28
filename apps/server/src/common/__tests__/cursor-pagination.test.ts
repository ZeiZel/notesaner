/**
 * Unit tests for cursor-pagination utilities.
 *
 * Covers:
 * - encodeCursor / decodeCursor round-trips
 * - decodeCursor error handling (invalid, malformed, missing fields)
 * - buildPrismaQuery: no cursor (first page)
 * - buildPrismaQuery: valid cursor (subsequent page)
 * - buildPrismaQuery: invalid cursor treated as first page
 * - buildPrismaQuery: custom orderField / secondaryOrderField
 * - buildCursorPage: hasMore detection
 * - buildCursorPage: nextCursor generation
 * - buildCursorPage: last page (hasMore=false, nextCursor=null)
 * - buildCursorPage: empty results
 * - CursorPaginationQuery DTO defaults
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  buildPrismaQuery,
  buildCursorPage,
  type CursorPayload,
} from '../utils/cursor-pagination';
import { CursorPaginationQuery } from '../dto/cursor-pagination.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

// ─── encodeCursor / decodeCursor ──────────────────────────────────────────────

describe('encodeCursor', () => {
  it('returns a non-empty string', () => {
    const cursor = encodeCursor({ id: 'note-1', ts: 1700000000000 });
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeGreaterThan(0);
  });

  it('returns a URL-safe base64url string (no +, /, = characters)', () => {
    const cursor = encodeCursor({ id: 'abc-def-ghi', ts: 1700000000000 });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('encodes different payloads to different strings', () => {
    const a = encodeCursor({ id: 'note-1', ts: 1000 });
    const b = encodeCursor({ id: 'note-2', ts: 1000 });
    expect(a).not.toBe(b);
  });

  it('produces the same output for the same input (deterministic)', () => {
    const payload: CursorPayload = { id: 'stable-id', ts: 9999 };
    expect(encodeCursor(payload)).toBe(encodeCursor(payload));
  });

  it('handles special characters in id without throwing', () => {
    expect(() => encodeCursor({ id: 'abc/def+ghi=', ts: 0 })).not.toThrow();
  });
});

describe('decodeCursor', () => {
  it('round-trips: decode(encode(payload)) === payload', () => {
    const payload: CursorPayload = { id: 'note-abc', ts: 1700000000000 };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('returns null for empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for random garbage', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });

  it('returns null for valid base64 that is not JSON', () => {
    const notJson = Buffer.from('hello world').toString('base64url');
    expect(decodeCursor(notJson)).toBeNull();
  });

  it('returns null for JSON missing the id field', () => {
    const encoded = Buffer.from(JSON.stringify({ ts: 1000 })).toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('returns null for JSON missing the ts field', () => {
    const encoded = Buffer.from(JSON.stringify({ id: 'abc' })).toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('returns null for JSON where id is not a string', () => {
    const encoded = Buffer.from(JSON.stringify({ id: 42, ts: 1000 })).toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('returns null for JSON where ts is not a number', () => {
    const encoded = Buffer.from(JSON.stringify({ id: 'abc', ts: 'not-a-number' })).toString(
      'base64url',
    );
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('returns null for JSON null value', () => {
    const encoded = Buffer.from('null').toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('returns null for JSON array value', () => {
    const encoded = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });
});

// ─── buildPrismaQuery ─────────────────────────────────────────────────────────

describe('buildPrismaQuery', () => {
  // First page (no cursor)
  it('returns take = limit + 1 for first-page request', () => {
    const q = buildPrismaQuery({ limit: 20 });
    expect(q.take).toBe(21);
  });

  it('does not include cursor or skip for first-page request', () => {
    const q = buildPrismaQuery({ limit: 10 });
    expect(q.cursor).toBeUndefined();
    expect(q.skip).toBeUndefined();
  });

  it('includes default orderBy [createdAt desc, id asc] for first-page request', () => {
    const q = buildPrismaQuery({ limit: 10 });
    expect(q.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  // Subsequent page (valid cursor)
  it('includes cursor and skip=1 for subsequent-page request', () => {
    const cursor = encodeCursor({ id: 'note-42', ts: 1700000000000 });
    const q = buildPrismaQuery({ cursor, limit: 10 });
    expect(q.cursor).toEqual({ id: 'note-42' });
    expect(q.skip).toBe(1);
  });

  it('sets take = limit + 1 for subsequent-page request', () => {
    const cursor = encodeCursor({ id: 'note-1', ts: 0 });
    const q = buildPrismaQuery({ cursor, limit: 5 });
    expect(q.take).toBe(6);
  });

  // Invalid cursor — graceful fallback
  it('falls back to first-page query when cursor is invalid', () => {
    const q = buildPrismaQuery({ cursor: 'this-is-garbage', limit: 20 });
    expect(q.cursor).toBeUndefined();
    expect(q.skip).toBeUndefined();
    expect(q.take).toBe(21);
  });

  it('falls back to first-page query when cursor is empty string', () => {
    const q = buildPrismaQuery({ cursor: '', limit: 20 });
    expect(q.cursor).toBeUndefined();
  });

  // Custom order fields
  it('uses custom orderField and secondaryOrderField when provided', () => {
    const q = buildPrismaQuery({
      limit: 10,
      orderField: 'slug',
      secondaryOrderField: 'updatedAt',
    });
    expect(q.orderBy).toEqual([{ updatedAt: 'desc' }, { slug: 'asc' }]);
  });

  it('defaults orderField to id and secondaryOrderField to createdAt', () => {
    const q = buildPrismaQuery({ limit: 10 });
    expect(q.orderBy[0]).toHaveProperty('createdAt');
    expect(q.orderBy[1]).toHaveProperty('id');
  });
});

// ─── buildCursorPage ──────────────────────────────────────────────────────────

describe('buildCursorPage', () => {
  const makeItem = (id: string, offset = 0) => ({
    id,
    name: `Item ${id}`,
    createdAt: new Date(1700000000000 + offset),
  });

  it('returns hasMore=false and nextCursor=null on the last page', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')];
    const page = buildCursorPage(items, 5); // limit=5, got 3
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(3);
  });

  it('returns hasMore=true and nextCursor when more items exist', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]; // 3 items fetched for limit=2
    const page = buildCursorPage(items, 2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(page.items).toHaveLength(2); // extra item trimmed
  });

  it('trims the extra item from the response when hasMore=true', () => {
    const items = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2)];
    const page = buildCursorPage(items, 2);
    expect(page.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('nextCursor points to the last item in the returned page', () => {
    const items = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2)];
    const page = buildCursorPage(items, 2);
    const decoded = decodeCursor(page.nextCursor!);
    expect(decoded?.id).toBe('b');
  });

  it('returns empty items and no cursor for empty result set', () => {
    const page = buildCursorPage([], 10);
    expect(page.items).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('nextCursor is decodeable and contains correct timestamp', () => {
    const ts = 1700000000123;
    const items = [makeItem('x', ts - 1700000000000), makeItem('y', ts - 1700000000000 + 1)];
    const page = buildCursorPage(items, 1);
    const decoded = decodeCursor(page.nextCursor!);
    expect(decoded?.id).toBe('x');
    expect(decoded?.ts).toBe(new Date(1700000000000 + (ts - 1700000000000)).getTime());
  });

  it('full round-trip: nextCursor from page 1 used as cursor for page 2', () => {
    // Simulate two pages of 2 items each out of 4 total
    const allItems = [makeItem('a', 0), makeItem('b', 1), makeItem('c', 2), makeItem('d', 3)];

    // First page: fetch 3 (limit + 1) items
    const page1 = buildCursorPage(allItems.slice(0, 3), 2);
    expect(page1.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(page1.hasMore).toBe(true);

    // Decode cursor and build query for second page
    const cursor2 = page1.nextCursor!;
    const prismaQ = buildPrismaQuery({ cursor: cursor2, limit: 2 });
    expect(prismaQ.cursor).toEqual({ id: 'b' });
    expect(prismaQ.skip).toBe(1);
  });
});

// ─── CursorPaginationQuery DTO ────────────────────────────────────────────────

describe('CursorPaginationQuery DTO', () => {
  async function validate_dto(plain: Record<string, unknown>) {
    const instance = plainToInstance(CursorPaginationQuery, plain);
    return validate(instance);
  }

  it('defaults limit to 20 when not provided', () => {
    const dto = plainToInstance(CursorPaginationQuery, {});
    expect(dto.limit).toBe(20);
  });

  it('accepts a valid limit within range', async () => {
    const errors = await validate_dto({ limit: 50 });
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional cursor string', async () => {
    const errors = await validate_dto({ cursor: 'abc123', limit: 10 });
    expect(errors).toHaveLength(0);
  });

  it('fails validation when limit is 0', async () => {
    const errors = await validate_dto({ limit: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when limit exceeds 100', async () => {
    const errors = await validate_dto({ limit: 101 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when cursor is not a string', async () => {
    const errors = await validate_dto({ cursor: 12345 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('omitting cursor is valid (first-page request)', async () => {
    const errors = await validate_dto({ limit: 20 });
    expect(errors).toHaveLength(0);
  });
});
