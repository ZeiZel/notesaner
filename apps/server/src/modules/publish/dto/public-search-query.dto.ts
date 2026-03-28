import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for searching published notes in a public vault.
 * No authentication required.
 */
export class PublicSearchQueryDto {
  @ApiProperty({
    description: 'Full-text search query (min 2 chars)',
    example: 'getting started',
    minLength: 2,
    maxLength: 500,
  })
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  @ApiPropertyOptional({
    description: 'Results per page (1-50)',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Zero-based page index',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  page?: number;
}
