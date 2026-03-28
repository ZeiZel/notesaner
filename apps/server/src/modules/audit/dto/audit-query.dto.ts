import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '../audit.types';

/**
 * Query parameters for the paginated audit-log endpoint.
 */
export class AuditQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action types (repeat for multiple)',
    type: [String],
    enum: AuditAction,
    example: ['auth.login', 'note.created'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AuditAction, { each: true, message: 'Each action must be a valid AuditAction' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  actions?: AuditAction[];

  @ApiPropertyOptional({
    description: 'Entries at or after this ISO 8601 date-time',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO 8601 date-time string' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Entries at or before this ISO 8601 date-time',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO 8601 date-time string' })
  to?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive text match against serialised metadata',
    example: 'login',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @ApiPropertyOptional({ description: 'Opaque cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Max entries per page (1-500)',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;
}

/**
 * Body shape for updating the audit-log retention configuration.
 */
export class AuditRetentionConfigDto {
  @ApiProperty({
    description: 'Number of days to retain audit entries (30-365)',
    example: 90,
    minimum: 30,
    maximum: 365,
  })
  @IsInt({ message: 'retentionDays must be an integer' })
  @Min(30, { message: 'retentionDays must be at least 30' })
  @Max(365, { message: 'retentionDays must not exceed 365' })
  retentionDays!: number;
}
