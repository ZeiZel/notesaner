import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for configuring the freshness thresholds on a workspace.
 *
 * freshnessThreshold: number of days after which a note is considered "aging".
 * warningThreshold:   number of days after which a note is considered "stale".
 *
 * Both thresholds are expressed in whole days and must be positive integers.
 * warningThreshold must be greater than freshnessThreshold.
 */
export class FreshnessConfigDto {
  /**
   * Days since last verified/edited before a note is considered "aging" (yellow).
   * Must be between 1 and 365.
   * Defaults to 60.
   */
  @ApiPropertyOptional({
    description: 'Days until a note is considered "aging" (yellow)',
    example: 60,
    minimum: 1,
    maximum: 365,
    default: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  freshnessThreshold?: number;

  /**
   * Days since last verified/edited before a note is considered "stale" (red).
   * Must be between 1 and 730.
   * Defaults to 90.
   */
  @ApiPropertyOptional({
    description: 'Days until a note is considered "stale" (red). Must be > freshnessThreshold.',
    example: 90,
    minimum: 1,
    maximum: 730,
    default: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  warningThreshold?: number;
}
