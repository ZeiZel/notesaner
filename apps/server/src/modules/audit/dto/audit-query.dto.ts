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
import { AuditAction } from '../audit.types';

/**
 * Query parameters for the paginated audit-log endpoint.
 * All filters are optional and combinable.
 */
export class AuditQueryDto {
  /**
   * Filter entries by a specific user ID.
   */
  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId?: string;

  /**
   * Filter by one or more action types. Repeat the parameter for multiple:
   *   ?actions=auth.login&actions=note.created
   */
  @IsOptional()
  @IsArray()
  @IsEnum(AuditAction, { each: true, message: 'Each action must be a valid AuditAction' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  actions?: AuditAction[];

  /**
   * Return only entries at or after this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO 8601 date-time string' })
  from?: string;

  /**
   * Return only entries at or before this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO 8601 date-time string' })
  to?: string;

  /**
   * Case-insensitive text to match against serialised metadata.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  /**
   * Opaque cursor returned from the previous page. Pass to fetch the next page.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum entries per page. Default 50, max 500.
   */
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
  /**
   * Number of days to retain audit entries (30–365).
   */
  @IsInt({ message: 'retentionDays must be an integer' })
  @Min(30, { message: 'retentionDays must be at least 30' })
  @Max(365, { message: 'retentionDays must not exceed 365' })
  retentionDays!: number;
}
