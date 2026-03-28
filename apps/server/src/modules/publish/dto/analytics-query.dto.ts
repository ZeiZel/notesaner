import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Supported analytics date range presets.
 *
 * - '7d'  — last 7 days
 * - '30d' — last 30 days
 * - '90d' — last 90 days
 * - 'all' — all-time (no lower bound)
 */
export type DateRange = '7d' | '30d' | '90d' | 'all';

export class AnalyticsQueryDto {
  /**
   * Pre-defined date range window for the analytics query.
   * Defaults to '30d' when not provided.
   */
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  dateRange?: DateRange = '30d';

  /**
   * Optional note ID to scope analytics to a specific note.
   * When omitted, workspace-level aggregates are returned.
   */
  @IsOptional()
  @IsString()
  @IsUUID(4, { message: 'noteId must be a valid UUID' })
  noteId?: string;
}
