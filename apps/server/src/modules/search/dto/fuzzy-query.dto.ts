import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class FuzzyQueryDto {
  /**
   * The search query string (typo-tolerant).
   */
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  /**
   * Trigram similarity threshold (0–1). Only notes whose title has
   * similarity >= threshold are returned. Default: 0.3.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  threshold?: number;

  /**
   * Maximum number of results to return. Defaults to 20, maximum 100.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;
}
