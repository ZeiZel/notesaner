import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for cursor-based pagination.
 *
 * Cursor-based pagination is more stable than offset-based for live data
 * because inserting/deleting rows does not shift items into different pages.
 *
 * @example
 * GET /notes?limit=20&cursor=eyJpZCI6ImFiYy0xMjMiLCJ0cyI6MTcwMDAwMDAwMH0=
 */
export class CursorPaginationQuery {
  /**
   * Opaque cursor string returned by a previous response's `nextCursor`.
   * Omit to start from the beginning.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum number of items to return.
   * Defaults to 20, capped at 100.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

/**
 * Wrapper returned by paginated list endpoints.
 *
 * `nextCursor` is `null` when there are no more items.
 * Pass it as `cursor` on the next request to fetch the following page.
 */
export interface CursorPaginatedResponse<T> {
  /** The page of results. */
  items: T[];

  /**
   * Opaque cursor pointing to the last item of this page.
   * `null` when this is the last page.
   */
  nextCursor: string | null;

  /** Convenience flag — `true` when more pages exist. */
  hasMore: boolean;
}
