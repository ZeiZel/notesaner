import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Query parameters for searching published notes in a public vault.
 * No authentication required — validated purely from URL query string.
 */
export class PublicSearchQueryDto {
  /**
   * Full-text search query. Minimum 2 characters, maximum 500.
   */
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  /**
   * Number of results per page. Defaults to 10, maximum 50.
   * Kept smaller than the authenticated search limit to be cache-friendly
   * and reduce backend pressure on public endpoints.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  /**
   * Zero-based page index for pagination. Defaults to 0.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  page?: number;
}
