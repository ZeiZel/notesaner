import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsDateString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ActivityType } from '@prisma/client';
import { DEFAULT_ACTIVITY_PAGE_LIMIT, MAX_ACTIVITY_PAGE_LIMIT } from '../activity.constants';

export class GetActivityDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of activity items to return',
    minimum: 1,
    maximum: MAX_ACTIVITY_PAGE_LIMIT,
    default: DEFAULT_ACTIVITY_PAGE_LIMIT,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITY_PAGE_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by activity type',
    enum: ActivityType,
  })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
