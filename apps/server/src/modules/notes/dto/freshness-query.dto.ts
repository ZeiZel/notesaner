import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Freshness status filter values. */
export type FreshnessStatusFilter = 'fresh' | 'aging' | 'stale' | 'all';

/**
 * Query DTO for listing the needs-review queue.
 *
 * Supports cursor-based pagination and optional filtering by:
 * - freshness status
 * - document owner
 * - folder prefix
 */
export class FreshnessQueueQueryDto {
  /**
   * Cursor for pagination: the note ID to start after (exclusive).
   * Omit to get the first page.
   */
  @IsOptional()
  @IsString()
  @IsUUID()
  cursor?: string;

  /**
   * Maximum number of items per page. Capped at 100.
   * Defaults to 20.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * Filter by freshness status.
   * Defaults to 'stale' (only truly stale notes) when omitted.
   */
  @IsOptional()
  @IsEnum(['fresh', 'aging', 'stale', 'all'])
  status?: FreshnessStatusFilter;

  /**
   * Filter by document owner user ID.
   */
  @IsOptional()
  @IsString()
  ownerId?: string;

  /**
   * Filter by folder path prefix (e.g. "projects/web").
   */
  @IsOptional()
  @IsString()
  folder?: string;
}
