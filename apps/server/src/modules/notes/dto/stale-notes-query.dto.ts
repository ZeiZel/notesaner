import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { FreshnessStatusFilter } from './freshness-query.dto';

/**
 * Query DTO for the GET /workspaces/:id/stale-notes endpoint.
 */
export class StaleNotesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by freshness status',
    enum: ['fresh', 'aging', 'stale', 'all'],
    default: 'stale',
  })
  @IsOptional()
  @IsEnum(['fresh', 'aging', 'stale', 'all'])
  status?: FreshnessStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter by folder path prefix',
    example: 'projects/web',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
