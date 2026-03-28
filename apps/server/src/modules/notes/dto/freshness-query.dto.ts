import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Freshness status filter values. */
export type FreshnessStatusFilter = 'fresh' | 'aging' | 'stale' | 'all';

/**
 * Query DTO for listing the needs-review queue.
 */
export class FreshnessQueueQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (note ID to start after)',
    example: 'abc-123-def',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Max items per page (1-100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by freshness status',
    enum: ['fresh', 'aging', 'stale', 'all'],
    default: 'stale',
  })
  @IsOptional()
  @IsEnum(['fresh', 'aging', 'stale', 'all'])
  status?: FreshnessStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter by document owner user ID',
    example: 'usr-abc-123',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by folder path prefix',
    example: 'projects/web',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
