import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Supported analytics date range presets.
 */
export type DateRange = '7d' | '30d' | '90d' | 'all';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Date range window for analytics',
    enum: ['7d', '30d', '90d', 'all'],
    default: '30d',
    example: '30d',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  dateRange?: DateRange = '30d';

  @ApiPropertyOptional({
    description: 'Scope analytics to a specific note ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID(4, { message: 'noteId must be a valid UUID' })
  noteId?: string;
}
